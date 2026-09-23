import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService, routeParam } from '@/lib/server/serviceProxy';

/**
 * Reserves on positions this supplier has sold (MARKETPLACE_OPENSPEC §6.7, §15.6e).
 *
 * ⚠️ THE ONLY PLACE A SUPPLIER CAN LEARN THEY ARE OWED ANYTHING. `accept()` hands the recipient
 *    role to the LP, so a sold escrow leaves the seller's contract list entirely and they stop
 *    being `escrow.recipient()` — every other view in the product assumes selling ended their
 *    interest. It did not: they are still the reserve's funder, and the release pays them.
 *
 * Each row arrives with its state and the figure that belongs to it — see the contractservice
 * endpoint for the vocabulary. Two rules for rendering them: `DISPUTED` and `UNKNOWN` carry no
 * amount and none may be invented, and `LIVE` carries a provisional one, because the buyer can
 * still dispute right up to maturity.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const sellerAddress = routeParam(req, 'sellerAddress');
  if (!sellerAddress) {
    return res.status(400).json({ error: 'Seller address is required' });
  }

  await proxyToService(req, res, {
    service: 'contract',
    path: `/api/marketplace/sellers/${sellerAddress}/reserves`
  });
}
