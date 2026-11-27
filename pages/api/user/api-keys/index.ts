import { NextApiRequest, NextApiResponse } from 'next';
import { proxyToService } from '@/lib/server/serviceProxy';

/** A white-label partner's id, as userservice accepts it. */
const BRAND_ID = /^[a-z0-9-]{2,32}$/;

/**
 * The signed-in merchant's API keys: list them (GET) or make one (POST `{ label, brand? }`).
 *
 * A key is what the merchant's own backend sends as `Authorization: Bearer sd_live_...` to create
 * payment requests without a browser session. userservice owns them and scopes every call to the
 * session's user, so this route only carries the session across and passes userservice's answer
 * back untouched: its 400 (no wallet yet, bad label), 401 and 409 (ten keys already) are what the
 * page explains to the merchant.
 *
 * ⚠️ THE FULL KEY IS IN THE POST RESPONSE AND NOWHERE ELSE. Nothing here logs or caches the body.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return proxyToService(req, res, { service: 'user', path: '/api/user/api-keys', method: 'GET' });
  }

  if (req.method === 'POST') {
    // Only the label and brand: whatever else the browser sends is not ours to forward.
    // userservice validates the label (1-60 characters) and says why when it refuses. The brand is
    // the partner page the key was made on; anything that is not a slug is dropped rather than
    // refused, so a stray value costs the branding, not the key.
    const brand = req.body?.brand;
    return proxyToService(req, res, {
      service: 'user',
      path: '/api/user/api-keys',
      method: 'POST',
      body: {
        label: req.body?.label ?? null,
        ...(typeof brand === 'string' && BRAND_ID.test(brand) ? { brand } : {}),
      },
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
