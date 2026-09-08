import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService, routeParam } from '@/lib/server/serviceProxy';

/**
 * Every offer one LP has made (MARKETPLACE_OPENSPEC §15.6e).
 *
 * This is the list the "refresh from chain" control belongs next to (§15.6f). The staleness that
 * costs money is a missed ACCEPTANCE elsewhere: it makes every other offer on that escrow stale
 * and withdrawable at once, and nothing on-chain notifies the LPs holding them. They have
 * capital they could recover and no way to learn it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const lpAddress = routeParam(req, 'lpAddress');
  if (!lpAddress) {
    return res.status(400).json({ error: 'LP address is required' });
  }

  await proxyToService(req, res, {
    service: 'contract',
    path: `/api/marketplace/lps/${lpAddress}/offers`
  });
}
