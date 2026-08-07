import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * "Refresh from chain" (MARKETPLACE_OPENSPEC §15.6f).
 *
 * ⚠️ This goes to CONTRACTSERVICE, never to chainservice's refresh. The UI does not know which
 *    escrows are live; chainservice's endpoint takes an explicit escrow list precisely so the
 *    caller must have decided the scope, and contractservice is the only service that can.
 *
 * It reconciles the CALLER's own escrows and returns once the index is updated, so re-reading
 * the offer list afterwards shows the result. The response says how many events were found —
 * the data itself arrives via the offer-book endpoints.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'contract',
    path: '/api/marketplace/refresh',
    method: 'POST',
    body: {}
  });
}
