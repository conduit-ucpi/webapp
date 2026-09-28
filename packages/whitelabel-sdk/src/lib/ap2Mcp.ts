import { apiFetch } from './apiFetch';

/**
 * Call one of ap2service's MCP tools, the same ones an AI agent is given.
 *
 * The /pay page is built on these on purpose: it dogfoods the agent surface, so a payment a
 * person pushes from the site and one an agent pushes go through exactly the same code, and a
 * gap in the tools shows up here first. Nothing is decided in the browser — the escrow address,
 * the fee, who can dispute and the signature data all come back from the tool.
 *
 * /api/ap2/mcp is a plain passthrough to a stateless server answering JSON, so one POST per call
 * with no session. A tool refusal comes back as an `error` field in its own result, which the
 * caller shows; only a transport or protocol failure throws.
 */

export interface Ap2ToolError {
  error: string;
  message?: string;
  retryable?: boolean;
}

export async function callAp2Tool<T extends object>(
  name: string,
  args: Record<string, unknown>
): Promise<T | Ap2ToolError> {
  const response = await apiFetch('/api/ap2/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  if (!response.ok) {
    throw new Error(`The payment service answered ${response.status}`);
  }
  const body = await response.json();
  if (body.error) {
    throw new Error(body.error.message || 'The payment service refused the request');
  }
  const result = body.result;
  // A tool that raised: the text is its message.
  if (result?.isError) {
    return { error: 'tool_error', message: result.content?.[0]?.text };
  }
  return (result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? '{}')) as T;
}

export function isAp2ToolError(value: object): value is Ap2ToolError {
  return typeof (value as Ap2ToolError).error === 'string';
}
