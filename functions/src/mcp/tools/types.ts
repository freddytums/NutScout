import { z } from 'zod';
import type { AuthContext } from '../../auth';

// Erased to ZodTypeAny for storage so each tool can keep its own
// strongly-typed input schema while still living in a homogeneous registry.
export interface McpTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: S;
  handler: (ctx: AuthContext, args: z.infer<S>) => Promise<unknown>;
}

export type AnyMcpTool = McpTool<z.ZodTypeAny>;

export function defineTool<S extends z.ZodTypeAny>(tool: McpTool<S>): AnyMcpTool {
  return tool as unknown as AnyMcpTool;
}
