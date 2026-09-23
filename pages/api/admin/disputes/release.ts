import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Release the ready batch: every READY_TO_EXECUTE case (or the listed contractIds) becomes one
 * vote in one Safe transaction. The response carries the Safe app link where the second owner
 * confirms. Irreversible once that confirmation lands, which is why it is a deliberate POST from
 * an admin and nothing the sweep does on its own.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  return proxyToService(req, res, { service: 'dispute', path: '/api/disputes/release', method: 'POST', body: req.body ?? {} });
}
