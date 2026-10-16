import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The caller's own payment requests and where each has got to, for a merchant API key
 * (`Authorization: Bearer sd_live_…`) or a signed-in seller. ap2service decides who the caller is
 * and answers 401 itself, so this route demands nothing.
 *
 * A PURE PROXY, like /api/ap2/request.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  const raw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = raw && /^\d{1,3}$/.test(raw) ? `?limit=${raw}` : '';

  return proxyToService(req, res, {
    service: 'ap2',
    path: `/requests${limit}`,
    method: 'GET',
    requiresAuth: false
  });
}
