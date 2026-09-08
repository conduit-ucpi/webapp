import { NextApiRequest, NextApiResponse } from 'next';
import { proxyToService } from '@/lib/server/serviceProxy';

/**
 * A single contract, by id.
 *
 * Goes through proxyToService rather than its own fetch so the contractservice's
 * status survives the hop. The hand-rolled version called response.json()
 * unconditionally and collapsed every failure into a 500 — so a 404 for a
 * contract that does not exist, a 403 for one belonging to someone else, and a
 * genuinely broken service were indistinguishable from the browser, and the
 * upstream body was discarded rather than logged.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  if (req.method === 'GET') {
    return proxyToService(req, res, {
      service: 'contract',
      path: `/api/contracts/${encodeURIComponent(id)}`,
      method: 'GET',
    });
  }

  if (req.method === 'PATCH') {
    return proxyToService(req, res, {
      service: 'contract',
      path: `/api/contracts/${encodeURIComponent(id)}`,
      method: 'PATCH',
      body: req.body,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
