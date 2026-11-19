import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Settle a sold position's reserve, sent by chainservice (MARKETPLACE_OPENSPEC §6.7).
 *
 * The platform may send it because `releaseHoldback()` is permissionless BY CONSTRUCTION: the
 * funder was fixed at deployment, the beneficiary is read live off the escrow, and the split
 * falls out of the escrow's final state. Whoever sends it, the same amounts land in the same two
 * places — so relaying it costs neither party gas or a signature.
 *
 * A 400 with `notReleasable` is not a fault: the escrow has not settled yet, or the reserve has
 * already been paid out. chainservice checks before it sends, so a refusal costs nothing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/release-holdback',
    method: 'POST',
    body: { vaultAddress: req.body?.vaultAddress }
  });
}
