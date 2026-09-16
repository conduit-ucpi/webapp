import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Whether the AP2 processor is running, and whether it can actually settle anything.
 *
 * Those are different questions: a service with no agent-provider key starts fine and refuses
 * every mandate, so `can_settle` is the one worth watching.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  return proxyToService(req, res, {
    service: 'ap2',
    path: '/health',
    method: 'GET',
    requiresAuth: false
  });
}
