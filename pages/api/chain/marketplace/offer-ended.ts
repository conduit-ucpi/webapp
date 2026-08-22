import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Tell chainservice an offer has ended (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ THIS IS THE HALF OF THE LOOP THE CONTRACTS FORCE ON US. accept, reject and withdraw are
 *    sent from the party's OWN wallet because the contracts require it — `accept` pays
 *    `msg.sender`, and the other two check the caller — so chainservice never sees them. It
 *    creates offers and knows when they are funded; it can only learn how they END by being
 *    told, and this is where we tell it.
 *
 * Advisory, and deliberately fire-and-forget at the call site: the transaction has already
 * landed by the time this runs, and a notification that fails must never present itself as a
 * failed accept. The cost of a lost one is a stale cache entry until it expires.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/offer-ended',
    method: 'POST',
    body: req.body
  });
}
