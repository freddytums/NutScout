import { onRequest, type Request } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AuthError, verifyAuth } from '../auth';
import { allTools, toolsByName } from './tools/index';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'nutscout-mcp', version: '0.1.0' };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string, data?: unknown): JsonRpcError {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } };
}

function rpcSuccess(id: JsonRpcRequest['id'], result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function listToolsResult() {
  // Cast the schema export through unknown — its inferred type tree is gigantic
  // (zod's recursive types) and triggers "instantiation is excessively deep".
  const tools = allTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema as unknown as Parameters<typeof zodToJsonSchema>[0], {
      target: 'openApi3',
    }) as Record<string, unknown>,
  }));
  return { tools };
}

async function dispatch(rpc: JsonRpcRequest, req: Request) {
  switch (rpc.method) {
    case 'initialize':
      return rpcSuccess(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      });

    case 'initialized':
    case 'notifications/initialized':
      return null;

    case 'ping':
      return rpcSuccess(rpc.id, {});

    case 'tools/list':
      return rpcSuccess(rpc.id, listToolsResult());

    case 'tools/call': {
      const params = rpc.params as { name?: string; arguments?: unknown } | undefined;
      const name = params?.name;
      if (!name) return rpcError(rpc.id, -32602, 'Missing tool name');
      const tool = toolsByName[name];
      if (!tool) return rpcError(rpc.id, -32601, `Unknown tool: ${name}`);

      const parsed = tool.inputSchema.safeParse(params?.arguments ?? {});
      if (!parsed.success) {
        return rpcError(rpc.id, -32602, 'Invalid tool arguments', parsed.error.flatten());
      }

      let auth;
      try {
        auth = await verifyAuth(req);
      } catch (err) {
        if (err instanceof AuthError) return rpcError(rpc.id, -32001, err.message);
        throw err;
      }

      try {
        const result = await tool.handler(auth, parsed.data);
        return rpcSuccess(rpc.id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return rpcSuccess(rpc.id, {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }
}

export const mcp = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
    if (req.method === 'GET') {
      // Health/probe endpoint — useful for confirming the URL responds.
      res.json({ ok: true, server: SERVER_INFO, protocolVersion: PROTOCOL_VERSION });
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = req.body as JsonRpcRequest | JsonRpcRequest[] | undefined;
    if (!body) {
      res.status(400).json({ error: 'Empty request body' });
      return;
    }

    try {
      if (Array.isArray(body)) {
        const responses = await Promise.all(body.map((b) => dispatch(b, req)));
        res.json(responses.filter((r) => r !== null));
      } else {
        const response = await dispatch(body, req);
        if (response === null) {
          res.status(204).end();
        } else {
          res.json(response);
        }
      }
    } catch (err) {
      logger.error('mcp dispatch error', err);
      const message = err instanceof Error ? err.message : 'Internal error';
      res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message } });
    }
  }
);
