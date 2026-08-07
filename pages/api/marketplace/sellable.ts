import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The escrows an LP could bid on — the liquidity explorer's list
 * (MARKETPLACE_OPENSPEC §15.3, §15.6d).
 *
 * ⚠️ Discovery, not a gate (§15.3a rule 1). Appearing here means an escrow looked sellable when
 *    the list was built; `createOffer` and `acceptOffer` re-check everything on-chain and are
 *    the only things that decide.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const maxDays = req.query.maxDaysToMaturity;
  const query = typeof maxDays === 'string' && maxDays ? `?maxDaysToMaturity=${encodeURIComponent(maxDays)}` : '';

  await proxyToService(req, res, {
    service: 'contract',
    path: `/api/marketplace/sellable${query}`
  });
}
