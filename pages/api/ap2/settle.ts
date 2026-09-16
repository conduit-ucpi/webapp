import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Settle an AP2 Payment Mandate into an escrow with a dispute window.
 *
 * Note what a caller does NOT supply: anything that decides the escrow's address. That is
 * derived from the verified mandate's own terms, including the checkout hash, so a request
 * cannot steer where the payment lands.
 *
 * A PURE PROXY. Mandate verification is SD-JWT over a chain of ES256 signatures bound to a
 * checkout hash, and it happens exactly once — in ap2service, behind this. Re-checking any of
 * it here would mean a second implementation of the thing that decides whether money moves,
 * kept in step by hand with a spec that made a breaking change in April.
 *
 * ⚠️ requiresAuth: false, deliberately. The callers are merchants and agent platforms with no
 *    Conduit session, and the VERIFIED MANDATE IS THE CREDENTIAL — it is signed, bound to one
 *    checkout, and carries a nonce that cannot be replayed. Same posture as resultservice.
 *
 * ⚠️ That makes this unauthenticated AND gas-spending, so it needs rate limiting at the edge.
 *    Not optional: without it, anyone can make the relayer attempt transactions.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  // Named so the error says which field, rather than leaving a caller to bisect their payload.
  const required = [
    'mandate_chain',
    'payment_nonce',
    'checkout_jwt_hash',
    'open_checkout_hash',
    'eip3009',
    'seller'
  ];
  const missing = required.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  // dispute_window_seconds is NOT checked here, and its absence is not defaulted. ap2service
  // refuses a mandate that does not say whether it wants a window, because the difference
  // between "instant, deliberately" and "nobody said" decides whether anyone can get their
  // money back. Filling it in at the edge would destroy exactly that distinction.
  return proxyToService(req, res, {
    service: 'ap2',
    path: '/settle',
    method: 'POST',
    body: req.body,
    requiresAuth: false
  });
}
