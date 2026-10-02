import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The arbitration rules, as disputeservice publishes them from ARBITRATION_POLICY.md, with the
 * commit that last changed the policy.
 *
 * ⚠️ requiresAuth: false. This is the public policy page's content: it reads nothing about anybody,
 *    and a party has to be able to read the rules before they ever sign in.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;
  res.setHeader('Cache-Control', 'public, max-age=300');
  return proxyToService(req, res, { service: 'dispute', path: '/policy/rules', requiresAuth: false });
}
