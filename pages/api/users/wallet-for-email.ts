import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { fetchIdentity } from '@/lib/server/coinbaseCdp';
import { extractAuthToken } from '@/utils/api-auth';

/**
 * The wallet an email address names. With `create: true`, one is made for it if its owner has
 * never signed in; without, an email nobody has signed in with is a 404 and nothing is made.
 *
 * The dispute screen's: a party nominating a tiebreaker by email nominates the wallet this
 * returns. userservice owns the mapping and the same email always answers with the same wallet,
 * so two parties who type the same email name the same person, who reaches the seat by signing
 * in with it. The screen looks up as the party types (no `create`, so a half-typed address never
 * gets a wallet) and only creates on Nominate.
 *
 * ⚠️ SIGNED IN, NOT SCOPED. The caller must hold a session userservice recognises, but is not
 *    checked against any contract: any signed-in user may resolve any email (and so have a
 *    wallet made for it).
 *
 * ⚠️ ITS OWN CALL, NOT proxyToService. That helper forwards the visitor's cookies and this app's
 *    X_API_KEY; userservice's /api/service/** takes neither. It gets TO_USERSERVICE_API_KEY, which
 *    userservice accepts as FROM_WEBAPP_API_KEY. Nothing from the visitor's request is forwarded,
 *    and that matters: userservice refuses a lookup carrying proxy headers.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const base = process.env.USER_SERVICE_URL;
  const key = process.env.TO_USERSERVICE_API_KEY;
  if (!base || !key) {
    console.error('wallet-for-email: USER_SERVICE_URL or TO_USERSERVICE_API_KEY is not configured');
    return res.status(503).json({ error: 'Email addresses cannot be looked up here right now. Use a wallet address instead.' });
  }

  const authToken = extractAuthToken(req);
  if (!authToken || !(await fetchIdentity(req, authToken))) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const create = req.body?.create === true;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'That is not a valid email address.' });
  }

  try {
    const response = await fetch(
      `${base.replace(/\/$/, '')}/api/service/wallet-for-email?email=${encodeURIComponent(email)}&create=${create}`,
      { headers: { 'Accept': 'application/json', 'X-API-Key': key } }
    );
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({ email: data.email, walletAddress: data.walletAddress });
    }
    // A 404 is an answer, not a fault: nobody has signed in with that email (and, with create,
    // none could be made).
    if (response.status === 404) {
      return res.status(404).json({ error: create ? `No wallet could be found or made for ${email}.` : `Nobody has signed in with ${email} yet.` });
    }
    // userservice's own errors name its side (a 401 is a key mismatch, a 502 is Privy); log them
    // in full, and tell the visitor only what they can act on.
    console.error(`wallet-for-email: userservice answered ${response.status}: ${(await response.text()).substring(0, 500)}`);
    return res.status(502).json({ error: 'Could not look up that email right now. Try again, or use a wallet address.' });
  } catch (error) {
    console.error('wallet-for-email: userservice unreachable:', error);
    return res.status(502).json({ error: 'Could not look up that email right now. Try again, or use a wallet address.' });
  }
}
