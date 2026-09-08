import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Deploy an offer vault for an LP (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ THIS MOVES NO MONEY. The vault is created empty and PENDING; only the named `lp` can fund
 *    it, by sending `fund()` from their own wallet to the returned `vaultAddress`. That split is
 *    the entire reason the platform may create it on a user's behalf without holding any power
 *    over their capital — and it is why making an offer is two transactions, mirroring
 *    create-then-deposit on an escrow.
 *
 * A 503 here is not a fault: it is the correct answer on an environment where the marketplace is
 * not deployed (`OFFER_VAULT_FACTORY_ADDRESS` unset).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/create-offer',
    method: 'POST',
    body: req.body
  });
}
