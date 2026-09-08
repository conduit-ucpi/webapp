import { NextApiRequest, NextApiResponse } from 'next';
import { blockedByEmailVerificationFlag } from '@/utils/featureFlags';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Public — the emailed link is opened from a mailbox, in a browser with no session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (blockedByEmailVerificationFlag(req, res)) return;
  if (!methodGuard(req, res, 'GET')) return;

  const token = typeof req.query.t === 'string' ? req.query.t : '';
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  return proxyToService(req, res, {
    service: 'user',
    path: `/api/email-verification/confirm?t=${encodeURIComponent(token)}`,
    method: 'GET',
    requiresAuth: false,
  });
}
