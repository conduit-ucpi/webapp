import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';

/**
 * A white-label partner's request from the /white-label form, sent to us through emailservice.
 *
 * ⚠️ PUBLIC: no sign-in. What makes that safe is on the emailservice side — its
 *    /api/email/white-label-request has no recipient field and always delivers to our own inbox
 *    (a constant there). This route adds the limits a public form needs: a rate limit per address,
 *    a body cap, and forwarding only the fields that endpoint takes.
 *
 * ⚠️ ITS OWN CALL, NOT proxyToService. That helper forwards the visitor's cookies and this app's
 *    X_API_KEY; emailservice gets neither. It gets TO_EMAILSERVICE_API_KEY, which emailservice
 *    (as FROM_WEBAPP_API_KEY) accepts on this one path and no other.
 */

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

/** Up to 5 requests per address per hour. */
export const allow = rateLimiter(5, 60 * 60 * 1000);

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const base = process.env.EMAIL_SERVICE_URL;
  const key = process.env.TO_EMAILSERVICE_API_KEY;
  if (!base || !key) {
    return res.status(503).json({ error: 'Requests cannot be sent from here right now. Email us instead.' });
  }

  if (!allow(clientAddress(req))) {
    return res.status(429).json({ error: 'Too many requests from here. Try again in an hour, or email us.' });
  }

  const b = req.body ?? {};
  if (typeof b.contactEmail !== 'string' || typeof b.config !== 'string') {
    return res.status(400).json({ error: 'contactEmail and config are required.' });
  }

  // Only the fields the endpoint takes, by name. Anything else in the body is dropped here.
  const body = {
    contactName: typeof b.contactName === 'string' ? b.contactName : null,
    contactEmail: b.contactEmail,
    productionDomains: strings(b.productionDomains),
    testDomains: strings(b.testDomains),
    config: b.config,
    notes: typeof b.notes === 'string' ? b.notes : null,
    attachments: (Array.isArray(b.attachments) ? b.attachments : [])
      .filter((a: unknown): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map((a: Record<string, unknown>) => ({
        filename: String(a.filename ?? ''),
        contentType: String(a.contentType ?? ''),
        contentBase64: String(a.contentBase64 ?? ''),
      })),
  };

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/api/email/white-label-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }
    if (response.ok) return res.status(200).json({ sent: true });
    // emailservice states what was wrong with the request (400); anything else is ours.
    const message = typeof payload.message === 'string' ? payload.message : typeof payload.error === 'string' ? payload.error : null;
    return res
      .status(response.status === 400 ? 400 : 502)
      .json({ error: response.status === 400 && message ? message : 'The request could not be sent. Try again, or email us.' });
  } catch {
    return res.status(502).json({ error: 'The request could not be sent. Try again, or email us.' });
  }
}
