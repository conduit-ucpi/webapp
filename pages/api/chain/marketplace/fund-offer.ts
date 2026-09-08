import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Open an offer whose deposit has already landed in its vault (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ THIS MOVES NO MONEY, and takes no address but the vault's. Funding is a DIRECT TRANSFER:
 *    the LP sends the offer token straight to the vault from their own wallet — one plain
 *    ERC20 transfer, the only signature the flow needs and the one call every wallet can
 *    decode and display honestly — and `fund()` merely observes that the balance arrived and
 *    flips the offer live. It mirrors `checkAndActivate` on a directly-funded escrow.
 *
 *    The platform may send it because `fund()` is permissionless BY CONSTRUCTION: it takes no
 *    arguments, so there is no destination for a caller to choose, and the vault's `lp` was
 *    fixed when it was deployed. Relaying it gains us nothing and saves the LP a signature.
 *
 * A 400 here is usually not a fault — the LP's transfer may still be in flight, or the offer
 * may already be OPEN. Re-read the vault rather than surfacing it as an error. A 503 remains
 * the correct answer on an environment where the marketplace is not deployed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/fund-offer',
    method: 'POST',
    body: req.body
  });
}
