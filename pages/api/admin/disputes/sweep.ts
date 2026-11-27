import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/** Run one pass over the whole queue now. Never votes; may seat the default arbiter and send notices. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  return proxyToService(req, res, { service: 'dispute', path: '/api/disputes/sweep', method: 'POST' });
}
