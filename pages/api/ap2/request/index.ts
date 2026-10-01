import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * A payment request: terms without a buyer, and a link whoever opens it can pay. What /create
 * makes. ap2service stores it in contractservice AS THE SIGNED-IN SELLER, so it needs their
 * session — the request is in their name and pays into their wallet.
 *
 * A PURE PROXY, like /api/ap2/prepare.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const required = ['amount', 'expiry_timestamp', 'description'];
  const missing = required.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  return proxyToService(req, res, {
    service: 'ap2',
    path: '/request',
    method: 'POST',
    body: req.body
  });
}
