import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Return a lapsed offer's capital to its LP (MARKETPLACE_OPENSPEC §6.4, §15.2).
 *
 * ⚠️ NO SIGNATURE, AND NOT AS A CONVENIENCE. `withdraw()` is permissionless on-chain: it takes
 *    no arguments, the destination is the `lp` fixed when the vault was deployed, and the amount
 *    is fixed by the vault's state. Nobody sending it chooses anything, so the platform relays
 *    it — the LP presses a button and their capital comes back, with no wallet prompt and no gas.
 *
 * ⚠️ THE SAME CALL A KEEPER MAKES. contractservice sweeps lapsed offers on the batch-claim
 *    timer through this very endpoint, so a button press and the sweep can race. That is
 *    harmless — the loser is told `notWithdrawable`, which is the vault reporting the money has
 *    already gone home, not a failure.
 *
 * A 400 is therefore usually not a fault: the offer is still standing, or it has already been
 * emptied. Re-read the offer rather than presenting it as an error.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/withdraw-offer',
    method: 'POST',
    body: req.body
  });
}
