import { NextApiRequest } from 'next';

/**
 * Extracts authentication token from either cookie or Authorization header
 * Supports both cookie-based auth (regular web) and bearer token auth (Farcaster mini-apps)
 */
export function extractAuthToken(req: NextApiRequest): string | null {
  // First try Authorization header (for Farcaster mini-apps)
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    return token;
  }

  // Fallback to AUTH-TOKEN cookie (for regular web apps)
  const cookies = req.headers.cookie || '';
  const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
  
  if (authTokenMatch) {
    return authTokenMatch[1];
  }
  
  return null;
}

/**
 * Standard auth validation for API routes
 * Returns the token if found, throws 401 error response if not
 */
export function requireAuth(req: NextApiRequest): string {
  const authToken = extractAuthToken(req);
  
  if (!authToken) {
    throw new Error('Authentication required');
  }
  
  return authToken;
}

/** True for what [requireAuth] throws when a request carries no session. */
export function isMissingSession(error: unknown): boolean {
  return error instanceof Error && error.message === 'Authentication required';
}

/**
 * Logs what a route's catch block caught: a fault as an error, a missing session as one plain
 * line.
 *
 * ⚠️ A REQUEST WITH NO SESSION IS A REFUSAL, NOT A FAULT. The route answers 401 and that is
 *    the system working. It used to be logged with console.error and the word "error", and on
 *    production (2026-11-20, 01:30 UTC) one scan of thirty routes by somebody without a session
 *    paged the error alert. The line written for it must not contain "error", "failed" or
 *    "exception": the alert counts those words, so the route's own label is trimmed of them.
 */
export function logApiFailure(label: string, error: unknown): void {
  if (isMissingSession(error)) {
    const what = label.replace(/\s*(API\s+)?(fetch\s+|lookup\s+)?(error|failed)\s*:?\s*$/i, '').trim();
    console.log(`Refused, no session (401): ${what}`);
    return;
  }
  console.error(label, error);
}

/**
 * Logs a backend's answer that was not a success, when the route passes that answer on.
 *
 * ⚠️ A 4xx IS THE BACKEND REFUSING THE CALLER, NOT A FAULT: no session, not an admin, not their
 *    contract, nothing at that address, a body it cannot read. Each is the check working, and
 *    each used to be console.error. A 5xx is a fault and still is.
 *    The refusal line carries the backend's own reason but not its raw body: that body is
 *    usually `{"error": ...}`, and the alert counts the word.
 */
export function logBackendAnswer(what: string, status: number, bodyText?: string): void {
  if (status < 400 || status >= 500) {
    console.error(`${what} error:`, status, bodyText ?? '');
    return;
  }
  let reason = '';
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const said = parsed?.message ?? parsed?.error;
      if (typeof said === 'string') reason = said;
    } catch {
      // Not JSON: the status says enough.
    }
  }
  const safe = reason.replace(/\b(error|failed|exception)\b/gi, '').replace(/\s+/g, ' ').trim().substring(0, 200);
  console.log(`${what} refused the request (${status})${safe ? `: ${safe}` : ''}`);
}
