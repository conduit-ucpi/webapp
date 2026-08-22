import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService, routeParam } from '@/lib/server/serviceProxy';

/**
 * What an escrow pays its recipient at maturity — `AMOUNT − CREATOR_FEE` (§8.5a).
 *
 * This is the figure an LP is bidding against, shown at the moment they are about to commit
 * capital. It comes from chainservice rather than being read in the browser: the webapp does
 * not talk to a node, and chainservice caches this indefinitely-stable figure so every LP
 * looking at the same escrow shares one read.
 *
 * A null payout means the escrow could not be read — unknown, not zero. A caller must not
 * present it as a real figure to bid against.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const escrowContract = routeParam(req, 'escrowContract');
  if (!escrowContract) {
    return res.status(400).json({ error: 'Escrow contract address is required' });
  }

  await proxyToService(req, res, {
    service: 'chain',
    path: `/api/chain/marketplace/escrows/${escrowContract}/payout-amount`
  });
}
