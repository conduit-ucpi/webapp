import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService, routeParam } from '@/lib/server/serviceProxy';

/**
 * Sends one email that disputeservice held for review: { index } into the case's notices. The
 * clock that email starts runs from now, so holding it never shortened anybody's time.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const id = routeParam(req, 'id');
  if (!id) return void res.status(400).json({ error: 'Contract ID is required' });
  const index = Number(req.body?.index);
  if (!Number.isInteger(index) || index < 0) return void res.status(400).json({ error: 'index must be a notice index' });
  return proxyToService(req, res, {
    service: 'dispute',
    path: `/api/disputes/${encodeURIComponent(id)}/notices/${index}/send`,
    method: 'POST',
  });
}
