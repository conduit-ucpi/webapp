import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Where a payment must go, and how to fund it — or how to ask somebody else for it — before
 * anybody signs or sends anything. ap2service's `prepare_escrow_payment`, the same function its
 * MCP tool is, over plain HTTP.
 *
 * A PURE PROXY, like /api/ap2/settle and /reserve.
 *
 * ⚠️ requiresAuth: false, for the reason /reserve is: nothing here moves money. It sends no email
 *    either — the result's `share_with_payer.pay_link` is for the caller to send. Emailing a buyer
 *    is /api/escrow-records/[id]/request-email, which needs the seller signed in.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const required = ['seller', 'amount', 'expiry_timestamp', 'nominal_buyer', 'description'];
  const missing = required.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  return proxyToService(req, res, {
    service: 'ap2',
    path: '/prepare',
    method: 'POST',
    body: req.body,
    requiresAuth: false
  });
}
