import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Turn an email given as an escrow party into the wallet the escrow's terms will name.
 *
 * A PURE PROXY, like /api/ap2/settle. The escrow address is a function of the buyer's and
 * seller's WALLETS, and a payer signs against that address — so a caller who holds only an
 * email (a merchant's, an invitee's) needs the wallet before they can derive anything. The
 * mapping lives in userservice behind a service key that ap2service holds and this app does
 * not; ap2service answers with the same wallets /settle resolves the same emails to.
 *
 * ⚠️ requiresAuth: false, for the same reason /settle is. Nothing here moves money or reveals
 *    anything a caller could not already learn by creating a contract to that email: the lookup
 *    goes email → wallet only, never the other way.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const { seller, nominal_buyer } = req.body ?? {};
  if (seller === undefined && nominal_buyer === undefined) {
    return res.status(400).json({ error: 'Give at least one of seller, nominal_buyer' });
  }

  return proxyToService(req, res, {
    service: 'ap2',
    path: '/parties/resolve',
    method: 'POST',
    body: { seller, nominal_buyer },
    requiresAuth: false
  });
}
