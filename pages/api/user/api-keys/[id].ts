import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Revoke one of the signed-in merchant's API keys. userservice answers 204, or 404 for a key that
 * is not theirs or does not exist; either passes straight through.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'DELETE')) return;

  const id = req.query.id;
  // Interpolated into the service path, so nothing but an id gets through.
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid key id' });
  }

  return proxyToService(req, res, { service: 'user', path: `/api/user/api-keys/${id}`, method: 'DELETE' });
}
