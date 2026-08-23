import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Settle a sold position's reserve (MARKETPLACE_OPENSPEC §6.7, §15.2).
 *
 * ⚠️ NO SIGNATURE FROM EITHER PARTY. `releaseHoldback()` is permissionless: the funder was
 *    fixed when the vault was deployed, the beneficiary is read live off the escrow, and the
 *    split falls out of the escrow's own final state — a dispute's award to the buyer comes off
 *    the reserve first, and only the remainder returns to the funder. Whoever sends it, the
 *    same amounts land in the same two places, so the platform relays it.
 *
 * ⚠️ A DISPUTE-RESOLVED ESCROW IS RELEASABLE, and it is the case that matters. Resolution marks
 *    the escrow claimed in the transaction that pays it out, so the reserve is settleable and
 *    the split is finally doing something. Never gate this on "was it disputed".
 *
 * A 400 with `notReleasable` means the escrow has not settled yet, or the other party got there
 * first. Re-read the offer rather than presenting it as an error.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/release-holdback',
    method: 'POST',
    body: req.body
  });
}
