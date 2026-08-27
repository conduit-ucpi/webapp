import { NextApiRequest, NextApiResponse } from 'next';
import { blockedByEmailVerificationFlag } from '@/utils/featureFlags';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (blockedByEmailVerificationFlag(req, res)) return;
  if (!methodGuard(req, res, 'POST')) return;

  return proxyToService(req, res, {
    service: 'user',
    path: '/api/email-verification/sign',
    method: 'POST',
    body: req.body,
  });
}
