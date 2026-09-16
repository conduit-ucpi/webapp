import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Bring a counterfactual escrow into existence on top of funds already sent to it.
 *
 * The buyer transfers to an address before anything is deployed there, and that transfer
 * triggers nothing — an ERC20 transfer only moves a balance inside the token contract, so no
 * escrow code runs and no event of ours fires. This is the call that creates the escrow on
 * top of those funds and activates it, in one all-or-nothing transaction.
 *
 * Unlike check-and-activate, which only needs an address, this carries the escrow's full
 * terms: the contract does not exist yet, so there is nothing on-chain to read them from.
 * `factoryAddress` is the factory the address was derived from, which is not necessarily the
 * one currently configured — each contracts release deploys a new one, and an address is only
 * reachable from its own.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const required = [
    'tokenAddress',
    'buyer',
    'seller',
    'amount',
    'expiryTimestamp',
    'description',
    'contractserviceId'
  ];
  const missing = required.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  return proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/deploy-and-activate',
    method: 'POST',
    body: req.body
  });
}
