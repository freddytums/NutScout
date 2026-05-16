import { auth } from '@/lib/firebase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCallEvent {
  id: string;
  name: string;
  input?: unknown;
  result?: string;
}

export interface ChatStreamHandlers {
  onText: (delta: string) => void;
  onToolStart: (event: { id: string; name: string }) => void;
  onToolResult: (event: ToolCallEvent) => void;
  onMeta?: (meta: { rateRemaining: number }) => void;
  onError?: (message: string) => void;
  onDone?: (info: { stopReason: string | null }) => void;
}

export class AiBackendNotConfiguredError extends Error {
  constructor() {
    super('VITE_AI_API_URL is not set. Add it to .env.local to enable the AI chat.');
  }
}

function backendUrl(): string {
  const base = import.meta.env.VITE_AI_API_URL as string | undefined;
  if (!base) throw new AiBackendNotConfiguredError();
  return base.replace(/\/$/, '');
}

export async function streamChat(
  messages: ChatMessage[],
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();

  const res = await fetch(`${backendUrl()}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok) {
    let detail = await res.text().catch(() => '');
    try {
      const j = JSON.parse(detail);
      detail = j.error ?? detail;
    } catch { /* keep raw text */ }
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  if (!res.body) throw new Error('No response body from chat backend');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE messages are separated by a blank line
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = parseSseChunk(raw);
      if (!event) continue;
      dispatchSse(event, handlers);
    }
  }

  // Flush any trailing event
  if (buffer.trim()) {
    const event = parseSseChunk(buffer);
    if (event) dispatchSse(event, handlers);
  }
}

function parseSseChunk(raw: string): { event: string; data: unknown } | null {
  const lines = raw.split('\n');
  let event = 'message';
  let dataLine = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

function dispatchSse(
  { event, data }: { event: string; data: unknown },
  h: ChatStreamHandlers
) {
  const d = data as Record<string, unknown>;
  switch (event) {
    case 'meta':
      h.onMeta?.({ rateRemaining: Number(d.rateRemaining ?? 0) });
      return;
    case 'text':
      h.onText(String(d.delta ?? ''));
      return;
    case 'tool_use_start':
      h.onToolStart({ id: String(d.id), name: String(d.name) });
      return;
    case 'tool_result':
      h.onToolResult({
        id: String(d.id),
        name: String(d.name),
        input: d.input,
        result: typeof d.result === 'string' ? d.result : JSON.stringify(d.result),
      });
      return;
    case 'error':
      h.onError?.(String(d.message ?? 'Unknown error'));
      return;
    case 'done':
      h.onDone?.({ stopReason: (d.stopReason as string | null) ?? null });
      return;
  }
}
