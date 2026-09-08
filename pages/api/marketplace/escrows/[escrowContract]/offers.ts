import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService, routeParam } from '@/lib/server/serviceProxy';

/**
 * The offer book for one escrow — the seller's view (MARKETPLACE_OPENSPEC §15.6e).
 *
 * Two fields on the response carry obligations the caller must honour:
 *
 *   - ⚠️ `PENDING` is not an offer. The vault has been deployed but the LP has not funded it
 *     (§5.0), so showing it would advertise an offer nobody has committed to.
 *   - `lastReconciledAt` is what lets a UI say "no offers as of an hour ago" rather than
 *     "no offers".
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const escrowContract = routeParam(req, 'escrowContract');
  if (!escrowContract) {
    return res.status(400).json({ error: 'Escrow contract address is required' });
  }

  await proxyToService(req, res, {
    service: 'contract',
    path: `/api/marketplace/escrows/${escrowContract}/offers`
  });
}
