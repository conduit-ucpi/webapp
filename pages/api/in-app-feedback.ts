import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';
import { signedInAccount } from '@/lib/server/signedInAccount';

/**
 * A message from the feedback button on every page, sent to our inbox through emailservice.
 *
 * ⚠️ PUBLIC: signed in or not. What makes that safe is on the emailservice side: its
 *    /api/email/in-app-feedback has no recipient field and always delivers to our own inbox
 *    (a constant there). This route adds the limits a public form needs (a rate limit per
 *    address, a small body) and forwards only the fields that endpoint takes.
 *
 * ⚠️ THE ACCOUNT IS LOOKED UP HERE, NEVER TAKEN FROM THE BROWSER. The wallet and email in the
 *    message come from userservice, asked with the visitor's own session, so nobody can send
 *    feedback that claims to be from someone else's account. Not signed in means none is attached.
 *
 * ⚠️ ITS OWN CALL, NOT proxyToService. emailservice gets neither the visitor's cookies nor this
 *    app's X_API_KEY: it gets TO_EMAILSERVICE_API_KEY, which it accepts only on its webapp paths.
 */

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

/** Up to 10 messages per address per hour. */
export const allow = rateLimiter(10, 60 * 60 * 1000);

const FAILED = 'Your message could not be sent. Try again in a minute.';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const base = process.env.EMAIL_SERVICE_URL;
  const key = process.env.TO_EMAILSERVICE_API_KEY;
  if (!base || !key) {
    return res.status(503).json({ error: 'Feedback cannot be sent right now. Try again later.' });
  }

  if (!allow(clientAddress(req))) {
    return res.status(429).json({ error: 'Too many messages from here. Try again in an hour.' });
  }

  const b = req.body ?? {};
  if (typeof b.contactEmail !== 'string' || typeof b.message !== 'string') {
    return res.status(400).json({ error: 'contactEmail and message are required.' });
  }

  const account = await signedInAccount(req);
  const userAgent = req.headers['user-agent'];

  // Only the fields the endpoint takes, by name. Anything else in the body is dropped here.
  const body = {
    contactEmail: b.contactEmail,
    message: b.message,
    pageUrl: typeof b.pageUrl === 'string' ? b.pageUrl : null,
    walletAddress: account.walletAddress,
    accountEmail: account.accountEmail,
    userAgent: typeof userAgent === 'string' ? userAgent : null,
  };

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/api/email/in-app-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify(body),
    });
    if (response.ok) return res.status(200).json({ sent: true });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }
    // emailservice states what was wrong with the request (400); anything else is ours.
    const message = typeof payload.message === 'string' ? payload.message : null;
    return res.status(response.status === 400 ? 400 : 502).json({ error: response.status === 400 && message ? message : FAILED });
  } catch {
    return res.status(502).json({ error: FAILED });
  }
}
