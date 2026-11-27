import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The buyer's Google Analytics client id, attached to the escrow they are about to fund so the GA4
 * `purchase` event sent at funding is credited to their session. Sent by /pay after prepare, and
 * only when the visitor accepted analytics cookies (lib/consent.ts).
 *
 * requiresAuth (the default): contractservice checks the signed-in wallet is the buyer's. Only
 * `clientId` is passed on; contractservice checks its shape.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { id } = req.query;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'A contract id is required' });
  }
  const clientId = req.body?.clientId;
  if (typeof clientId !== 'string') {
    return res.status(400).json({ error: 'clientId is required' });
  }
  await proxyToService(req, res, {
    service: 'contract',
    path: `/api/contracts/${id}/analytics-client`,
    method: 'POST',
    body: { clientId }
  });
}
