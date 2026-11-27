import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Release one escrow's retained platform fee (sweepFees) to one target or split between two.
 *
 * The form sends flat fields; chainservice takes a list of legs. A blank second target means
 * one leg. Everything else — that the bps sum to 10000, that the caller is an admin, that the
 * escrow holds a fee, which key signs — is chainservice's to decide, and its status (403, 409,
 * 503, 502) is passed through untouched.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { contractAddress, target1, bps1, target2, bps2 } = req.body ?? {};
  const legs = [{ target: target1, bps: Number(bps1) }];
  if (typeof target2 === 'string' && target2.trim() !== '') {
    legs.push({ target: target2.trim(), bps: Number(bps2) });
  }
  return proxyToService(req, res, {
    service: 'chain',
    path: '/api/admin/sweep-fees',
    method: 'POST',
    body: { contractAddress, legs }
  });
}
