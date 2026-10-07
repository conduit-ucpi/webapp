import { NextApiRequest, NextApiResponse } from 'next';
import { proxyToService } from '@/lib/server/serviceProxy';

/**
 * Ask contractservice to re-read who holds this escrow's arbiter seat from the chain.
 *
 * Sent by the dispute screen after every seat action (resign, nominate, evict, seat default) so
 * the arbiter /disputes listing - which contractservice builds from the seat it has recorded -
 * agrees with the chain at once rather than at its hourly sweep. Carries no body: contractservice
 * writes only what it reads from the chain.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return proxyToService(req, res, {
    service: 'contract',
    path: `/api/contracts/${encodeURIComponent(id)}/arbiter-seat/refresh`,
    method: 'POST',
  });
}
