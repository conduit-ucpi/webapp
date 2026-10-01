import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The seller of an escrow put on file by ap2service asks for its buyer to be emailed a link to pay.
 *
 * ⚠️ requiresAuth (the default), unlike /api/ap2/reserve and /settle. This sends mail in the
 *    seller's name, so contractservice must know who is asking: it checks the signed-in wallet is
 *    the escrow's seller, that the buyer email is the buyer wallet's own, and builds the link
 *    itself. Nothing in the body is used — there is nothing a caller should choose here.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { id } = req.query;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'An escrow record id is required' });
  }
  await proxyToService(req, res, {
    service: 'contract',
    path: `/api/escrow-records/${id}/request-email`,
    method: 'POST',
    body: {}
  });
}
