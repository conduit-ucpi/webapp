import { apiFetch } from './apiFetch';

/**
 * Call one of ap2service's MCP tools, the same ones an AI agent is given.
 *
 * The /pay page is built on these on purpose: it dogfoods the agent surface, so a payment a
 * person pushes from the site and one an agent pushes go through exactly the same code, and a
 * gap in the tools shows up here first. Nothing is decided in the browser — the escrow address,
 * the fee, who can dispute and the signature data all come back from the tool.
 *
 * /api/ap2/mcp is a plain passthrough to a stateless server answering JSON, so one POST per call.
 * A tool refusal comes back as an `error` field in its own result, which the caller shows; only a
 * transport or protocol failure throws.
 *
 * ⚠️ THE TOOLS NEED A SIGNED-IN SESSION (or an access code), like every call to the payment API.
 *    Pass the page's `authenticatedFetch` as `fetcher`: it carries the session, and when a tool
 *    answers `api_access_required` — a wallet connected but not yet signed in, or a session from
 *    before the terms changed — asking it for the user's identity makes it sign them in (a 401 is
 *    what triggers that), after which the tool is called once more.
 */

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface Ap2ToolOptions {
  /** The page's authenticatedFetch; plain apiFetch (cookies only, no sign-in) when omitted. */
  fetcher?: Fetcher;
}

export interface Ap2ToolError {
  error: string;
  message?: string;
  retryable?: boolean;
}

export async function callAp2Tool<T extends object>(
  name: string,
  args: Record<string, unknown>,
  options: Ap2ToolOptions = {}
): Promise<T | Ap2ToolError> {
  const result = await callOnce<T>(name, args, options.fetcher ?? apiFetch);
  if (options.fetcher && isAp2ToolError(result) && result.error === 'api_access_required') {
    // Signs the user in when they are not (the identity route answers 401, which authenticatedFetch
    // answers with a sign-in); a no-op when they already are.
    await options.fetcher('/api/auth/identity');
    return callOnce<T>(name, args, options.fetcher);
  }
  return result;
}

async function callOnce<T extends object>(
  name: string,
  args: Record<string, unknown>,
  fetcher: Fetcher
): Promise<T | Ap2ToolError> {
  const response = await fetcher('/api/ap2/mcp', {
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
