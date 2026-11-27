import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The arbiter's queue: every open dispute the default arbiter is responsible for, with the
 * state of its case. disputeservice enforces userType=admin itself, so this route only carries
 * the session; a non-admin gets that service's 403 passed through.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;
  return proxyToService(req, res, { service: 'dispute', path: '/api/disputes' });
}
