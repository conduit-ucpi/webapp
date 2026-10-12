import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Where an escrow with these terms lives — the factory's own answer, for the MCP tools.
 *
 * Nothing off the chain works an escrow address out any more. ap2service's /escrow/address asks
 * chainservice, which reads the factory's `getContractAddress` view with an eth_call; this route
 * proxies it exactly as parties/screen is proxied. A 502 means the chain could not be asked and
 * nothing may be quoted. No user session: an agent has none, and the answer is a public chain fact.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const {
    factory,
    token_address,
    buyer,
    seller,
    amount,
    expiry_timestamp,
    arbiter,
    contractservice_id
  } = req.body ?? {};
  if (!factory || !token_address || !buyer || !seller || !arbiter || !contractservice_id) {
    return res.status(400).json({
      error: 'Give factory, token_address, buyer, seller, amount, expiry_timestamp, arbiter and contractservice_id'
    });
  }

  return proxyToService(req, res, {
    service: 'ap2',
    path: '/escrow/address',
    method: 'POST',
    body: { factory, token_address, buyer, seller, amount, expiry_timestamp, arbiter, contractservice_id },
    requiresAuth: false
  });
}
