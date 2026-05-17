import { useCallback, useRef, useState } from 'react';
import { AiBackendNotConfiguredError, streamChat, type ChatMessage, type ToolCallEvent } from '@/lib/aiClient';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallEvent[];
}

interface UseChatStreamResult {
  turns: ChatTurn[];
  isStreaming: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useChatStream(): UseChatStreamResult {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setError(null);

    const userTurn: ChatTurn = { role: 'user', content: text };
    setTurns((prev) => [...prev, userTurn, { role: 'assistant', content: '', toolCalls: [] }]);

    const history: ChatMessage[] = [...turns, userTurn].map((t) => ({
      role: t.role,
      content: t.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    try {
      await streamChat(history, {
        onText: (delta) => {
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + delta };
            }
            return next;
          });
        },
        onToolStart: ({ id, name }) => {
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                toolCalls: [...(last.toolCalls ?? []), { id, name }],
              };
            }
            return next;
          });
        },
        onToolResult: (event) => {
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === 'assistant') {
              const updated = (last.toolCalls ?? []).map((tc) =>
                tc.id === event.id ? { ...tc, ...event } : tc
              );
              next[next.length - 1] = { ...last, toolCalls: updated };
            }
            return next;
          });
        },
        onError: (msg) => setError(msg),
      }, controller.signal);
    } catch (err) {
      if (err instanceof AiBackendNotConfiguredError) {
        setError(err.message);
      } else if ((err as Error).name === 'AbortError') {
        setError('Cancelled');
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [turns, isStreaming]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setError(null);
  }, []);

  return { turns, isStreaming, error, send, cancel, reset };
}
