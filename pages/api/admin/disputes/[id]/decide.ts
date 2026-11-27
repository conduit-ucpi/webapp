import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService, routeParam } from '@/lib/server/serviceProxy';

/**
 * A reviewer's decision on an ESCALATED case: { buyerPercentage, reasoning }. Recorded under the
 * reviewer's identity, then the same hold window as any other decision before it can be released.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const id = routeParam(req, 'id');
  if (!id) return void res.status(400).json({ error: 'Contract ID is required' });
  return proxyToService(req, res, { service: 'dispute', path: `/api/disputes/${encodeURIComponent(id)}/decide`, method: 'POST', body: req.body });
}
