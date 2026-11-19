import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Return a lapsed offer's capital to its LP, sent by chainservice (MARKETPLACE_OPENSPEC §15.6d).
 *
 * The platform may send it because `withdraw()` is permissionless BY CONSTRUCTION: it takes no
 * arguments, the destination is the `lp` fixed when the vault was deployed, and the amount is
 * fixed by the vault's state. Whoever sends it, the same money goes to the same LP — so relaying
 * it costs them no gas and asks them for no signature.
 *
 * A 400 with `notWithdrawable` is not a fault: the offer is still standing, or its capital has
 * already been returned. chainservice checks before it sends, so a refusal costs nothing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/withdraw-offer',
    method: 'POST',
    body: { vaultAddress: req.body?.vaultAddress }
  });
}
