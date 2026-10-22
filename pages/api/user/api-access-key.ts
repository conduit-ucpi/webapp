import { NextApiRequest, NextApiResponse } from 'next';
import { proxyToService } from '@/lib/server/serviceProxy';

/**
 * The signed-in user's free access code for the payment API and MCP server: read it (GET, never
 * the secret), get a new one (POST, replacing the last) or stop it working (DELETE).
 *
 * userservice makes the code only for a terms version the user's wallet has signed. Which version
 * that must be is ours to say — the one this deployment serves (TERMS_VERSION, the same value
 * /api/config gives the sign-in message) — so the browser sends nothing: whatever it sent would
 * not be ours to forward.
 *
 * ⚠️ "TERMS NOT ACCEPTED" GOES BACK AS 401, NOT userservice's 409. The user's session is from
 *    before the terms changed, so it does not vouch for the terms a code needs. A 401 is what makes
 *    the page's authenticatedFetch ask the wallet for a fresh sign-in — whose message names the
 *    current terms, which is the acceptance — and then retry, so the user gets their code without
 *    having to work out that they must sign out and in again.
 *
 * ⚠️ THE FULL CODE IS IN THE POST RESPONSE AND NOWHERE ELSE. Nothing here logs or caches the body.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET' || req.method === 'DELETE') {
    return proxyToService(req, res, { service: 'user', path: '/api/user/api-access-key', method: req.method });
  }

  if (req.method === 'POST') {
    return proxyToService(req, res, {
      service: 'user',
      path: '/api/user/api-access-key',
      method: 'POST',
      body: { termsVersion: process.env.TERMS_VERSION || null },
      statusFor: (status, body) =>
        status === 409 && (body as { reason?: unknown } | null)?.reason === 'TERMS_NOT_ACCEPTED' ? 401 : status,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
