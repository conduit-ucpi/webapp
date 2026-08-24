import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * TEMPORARY DIAGNOSTIC — delete when the reserve-release investigation is closed.
 *
 * Asks chainservice whether `releaseHoldback()` would succeed on a set of vaults. The webapp
 * has no need for this in normal operation (contractservice asks on its behalf and folds the
 * answer into each reserve row); it exists only so that answer can be observed directly,
 * because the endpoint needs both an API key and a session and so cannot be curled by hand.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/vault-releasable',
    method: 'POST',
    body: req.body
  });
}
