/**
 * Telling "the node is rate-limiting us" apart from every other failed read.
 *
 * ⚠️ A RATE LIMIT DOES NOT LOOK LIKE ONE BY THE TIME IT REACHES A SCREEN. The read endpoint is a
 *    public one with a per-visitor allowance. When it is used up the node answers HTTP 429, or
 *    HTTP 200 carrying a JSON-RPC error ("over rate limit", -32016), and ethers then re-labels
 *    that by the kind of request it was: a contract read comes back as CALL_EXCEPTION "missing
 *    revert data", a retried request as SERVER_ERROR "exceeded maximum retry limit". Shown raw,
 *    those send a user (and us) looking for a broken contract that is not broken.
 *
 *    So the read provider recognises it at the one place every read passes through, logs it
 *    once in plain words, and throws RpcRateLimitedError, whose message is fit to show.
 */

export const RATE_LIMIT_MESSAGE =
  'The network is limiting how often this page can read from it. Wait a few seconds and try again.';

export class RpcRateLimitedError extends Error {
  readonly method?: string;

  constructor(method?: string, cause?: unknown) {
    super(RATE_LIMIT_MESSAGE);
    // Matched by name across module boundaries (see explainTransactionFailure).
    this.name = 'RpcRateLimitedError';
    this.method = method;
    (this as any).cause = cause;
  }
}

const CODES = new Set([429, -32016, -32005, -32029]);
const WORDS = /rate.?limit|too many requests|exceeded maximum retry limit|request limit|\b429\b/i;

/** Whether this failure, or anything it wraps, is the node refusing us for asking too often. */
export function isRateLimited(e: unknown): boolean {
  const seen = new Set<unknown>();
  const look = (x: any, depth: number): boolean => {
    if (x == null || depth > 5 || seen.has(x)) return false;
    if (typeof x === 'string') return WORDS.test(x);
    if (typeof x !== 'object') return false;
    seen.add(x);
    if (x.name === 'RpcRateLimitedError') return true;
    if (CODES.has(Number(x.code)) || CODES.has(Number(x.status)) || CODES.has(Number(x.statusCode))) return true;
    if (typeof x.message === 'string' && WORDS.test(x.message)) return true;
    if (typeof x.shortMessage === 'string' && WORDS.test(x.shortMessage)) return true;
    return (
      look(x.error, depth + 1) ||
      look(x.info, depth + 1) ||
      look(x.cause, depth + 1) ||
      look(x.response, depth + 1) ||
      look(x.responseBody, depth + 1) ||
      look(x.body, depth + 1) ||
      look(x.data, depth + 1)
    );
  };
  return look(e, 0);
}

/** The host of an endpoint, for a log line: never the path, which can carry a key. */
export function hostOf(rpcUrl: string): string {
  try {
    return new URL(rpcUrl).host;
  } catch {
    return '(unknown endpoint)';
  }
}
