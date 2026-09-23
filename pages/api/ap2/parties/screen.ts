import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * SANCTIONS CONTROL — the early screening of an escrow's named parties, for the MCP tools.
 *
 * The MCP server computes an escrow's address itself and, before handing it to an agent, asks
 * whether the buyer, seller or arbiter is on a sanctions list. The lists live in chainservice;
 * ap2service fronts that with /parties/screen, and this route proxies it exactly as
 * parties/resolve is proxied. It answers 200 with `refused`; the tool does the refusing.
 * No user session: an agent has none. See chainservice/SANCTIONS_SCREENING.md.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const { buyer, seller, arbiter, reference } = req.body ?? {};
  if (buyer === undefined && seller === undefined) {
    return res.status(400).json({ error: 'Give at least one of buyer, seller' });
  }

  return proxyToService(req, res, {
    service: 'ap2',
    path: '/parties/screen',
    method: 'POST',
    body: { buyer, seller, arbiter, reference },
    requiresAuth: false
  });
}
