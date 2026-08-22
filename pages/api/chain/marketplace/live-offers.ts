import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Which offers are standing on these escrows, right now (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ THIS REPLACES A BLOCK SCAN THAT SHOULD NEVER HAVE BEEN THE UI'S PROBLEM. Asking
 *    contractservice to reconcile before reading meant the seller's screen waited on chainservice
 *    walking hundreds of thousands of blocks to rediscover offers chainservice had itself
 *    created. It answers from its own cache instead — written through when it deploys a vault
 *    and when it relays `fund()` — and reads the chain only on a miss, and only as far back as
 *    an offer can still be live.
 *
 * Whether any given answer cost an RPC call is chainservice's business and must not leak into
 * this app. The reconcile still exists for the deeper question — what has HAPPENED to offers —
 * and stays behind the explicit "check for updates" control.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/live-offers',
    method: 'POST',
    body: req.body
  });
}
