import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService, routeParam } from '@/lib/server/serviceProxy';

/** Run one pass on one case. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const id = routeParam(req, 'id');
  if (!id) return void res.status(400).json({ error: 'Contract ID is required' });
  return proxyToService(req, res, { service: 'dispute', path: `/api/disputes/${encodeURIComponent(id)}/process`, method: 'POST' });
}
