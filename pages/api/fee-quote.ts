import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The escrow factory's fee on an amount — its `quoteCreatorFee` view, read by chainservice with
 * an eth_call (no gas).
 *
 * ⚠️ THE ONLY PLACE THE SITE GETS A FEE FROM. The rule is the factory's and nothing here repeats
 *    it: the amount guidance on the forms and the estimators on the landing pages all ask this.
 *    `amount` is token base units, as a string. Answers chainservice's own shape:
 *    `{ success, creatorFee, amountTooSmall, factoryAddress }`; 503 when the chain cannot be read.
 *    No session needed: it is a public chain fact, asked while someone is still typing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const { tokenAddress, amount } = req.body ?? {};
  if (typeof tokenAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
    return res.status(400).json({ error: 'tokenAddress must be a token address' });
  }
  if (typeof amount !== 'string' || !/^[1-9][0-9]*$/.test(amount)) {
    return res.status(400).json({ error: 'amount must be a positive whole number of base units, as a string' });
  }

  return proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/fee-quote',
    method: 'POST',
    body: { tokenAddress, amount },
    requiresAuth: false
  });
}
