import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import type { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool as AnthropicTool, MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { AuthError, verifyAuth, type AuthContext } from '../auth';
import { allTools, toolsByName } from '../mcp/tools/index';
import { SYSTEM_PROMPT } from './system-prompt';
import { checkAndIncrementRateLimit } from './rate-limit';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const DEFAULT_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 2048;
const MAX_TOOL_TURNS = 6;

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
}

function buildAnthropicTools(): AnthropicTool[] {
  return allTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.inputSchema as unknown as Parameters<typeof zodToJsonSchema>[0], {
      target: 'openApi3',
    }) as AnthropicTool['input_schema'],
  }));
}

async function runTool(name: string, input: unknown, ctx: AuthContext): Promise<string> {
  const tool = toolsByName[name];
  if (!tool) return JSON.stringify({ error: `Unknown tool: ${name}` });
  const parsed = tool.inputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return JSON.stringify({ error: 'Invalid arguments', issues: parsed.error.flatten() });
  }
  try {
    const result = await tool.handler(ctx, parsed.data);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export const chat = onRequest(
  { cors: true, region: 'us-central1', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    let auth: AuthContext;
    try {
      auth = await verifyAuth(req);
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Auth failed' });
      return;
    }

    const limit = await checkAndIncrementRateLimit(auth.uid);
    if (!limit.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded. Try again later.',
        resetAt: limit.resetAt,
      });
      return;
    }

    const body = req.body as ChatRequestBody | undefined;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({ error: 'Body must be { messages: [{ role, content }, ...] }' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const tools = buildAnthropicTools();
    const messages: MessageParam[] = body.messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      writeSse(res, 'meta', { rateRemaining: limit.remaining });

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const stream = client.messages.stream({
          model: body.model ?? DEFAULT_MODEL,
          max_tokens: MAX_TOKENS,
          system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: `Current user: ${auth.displayName} (role: ${auth.role}${auth.teamKey ? `, team ${auth.teamKey}` : ''}).` },
          ],
          messages,
          tools,
        });

        for await (const event of stream) {
          if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
            writeSse(res, 'tool_use_start', {
              id: event.content_block.id,
              name: event.content_block.name,
            });
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            writeSse(res, 'text', { delta: event.delta.text });
          }
        }

        const finalMessage = await stream.finalMessage();
        messages.push({ role: 'assistant', content: finalMessage.content });

        if (finalMessage.stop_reason !== 'tool_use') {
          writeSse(res, 'done', { stopReason: finalMessage.stop_reason });
          break;
        }

        const toolUses = finalMessage.content.filter(
          (b): b is ToolUseBlock => b.type === 'tool_use'
        );
        const toolResults = await Promise.all(
          toolUses.map(async (use) => {
            const result = await runTool(use.name, use.input, auth);
            writeSse(res, 'tool_result', { id: use.id, name: use.name, input: use.input, result });
            return {
              type: 'tool_result' as const,
              tool_use_id: use.id,
              content: result,
            };
          })
        );
        messages.push({ role: 'user', content: toolResults });
      }
    } catch (err) {
      logger.error('chat handler error', err);
      writeSse(res, 'error', { message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      res.end();
    }
  }
);
