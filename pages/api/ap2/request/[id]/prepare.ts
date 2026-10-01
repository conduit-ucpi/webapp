import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Pay a payment request: the signed-in wallet becomes its buyer, and the answer is how to fund
 * its escrow — the same shape /api/ap2/prepare returns. Every term comes from the stored request,
 * so the body carries only the optional `payer`.
 *
 * A PURE PROXY. Needs the buyer's session: ap2service claims the request as them.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const id = req.query.id;
  // Interpolated into the service path, so nothing but an id gets through.
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid request id' });
  }

  return proxyToService(req, res, {
    service: 'ap2',
    path: `/request/${id}/prepare`,
    method: 'POST',
    body: { payer: req.body?.payer ?? null }
  });
}
