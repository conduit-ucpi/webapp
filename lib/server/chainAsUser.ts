import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

/** A 0x address. The services decide whose it is; this only stops junk leaving the building. */
export const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** A non-negative whole number, as a decimal string: how a nonce and a deadline travel. */
export const WHOLE_NUMBER = /^\d{1,78}$/;

/** A hex string with its 0x prefix and at least one byte. */
export const HEX = /^0x([0-9a-fA-F]{2})+$/;

/**
 * Forward a call to chainservice AS THE SIGNED-IN USER: their session, and nothing else.
 *
 * ⚠️ NO SERVICE KEY, ON PURPOSE. These are a party's own actions and reads. chainservice accepts
 *    a Bearer token on them, and a key the browser-facing app does not need to send is one
 *    fewer place for it to leak from (the arbiter read set this precedent).
 *
 * chainservice's status and body are passed through unchanged: for a signed action a 400 is
 * "refused, nothing was sent" and a 502 is "sent, and it failed", and the screen tells them apart.
 */
export async function forwardToChainAsUser(
  req: NextApiRequest,
  res: NextApiResponse,
  options: { path: string; method: 'GET' | 'POST'; body?: unknown; what: string }
): Promise<void> {
  try {
    const authToken = requireAuth(req);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
      Cookie: req.headers.cookie || '',
      Accept: 'application/json'
    };
    if (options.method === 'POST') headers['Content-Type'] = 'application/json';

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}${options.path}`, {
      method: options.method,
      headers,
      body: options.method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined
    });

    const text = await response.text();
    if (!text) return void res.status(response.status).end();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text.substring(0, 500) };
    }
    res.status(response.status).json(body);
  } catch (error) {
    console.error(`${options.what} API error:`, error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * The part of a signed message every signed action carries, or the reason it is not one.
 * `nonce` and `deadline` are decimal strings; a number is accepted and sent on as a string.
 */
export function signedMessageOf(
  body: any
): { ok: true; message: { nonce: string; deadline: string; signature: string } } | { ok: false; error: string } {
  const text = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value);
  const nonce = text(body?.nonce);
  const deadline = text(body?.deadline);
  const signature = body?.signature;
  if (typeof nonce !== 'string' || !WHOLE_NUMBER.test(nonce)) return { ok: false, error: 'nonce must be a whole number' };
  if (typeof deadline !== 'string' || !WHOLE_NUMBER.test(deadline)) {
    return { ok: false, error: 'deadline must be a whole number of seconds' };
  }
  if (typeof signature !== 'string' || !HEX.test(signature)) return { ok: false, error: 'signature must be hex' };
  return { ok: true, message: { nonce, deadline, signature } };
}
