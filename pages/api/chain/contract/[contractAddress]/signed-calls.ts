import { NextApiRequest, NextApiResponse } from 'next';
import { ADDRESS, forwardToChainAsUser, shortAddress } from '@/lib/server/chainAsUser';

/**
 * Whether a contract takes SIGNED ACTIONS, and the domain to sign under if it does.
 *
 * A party with no ETH cannot call their contract. On a contract that has the signed route they
 * sign a message instead and chainservice delivers it and pays (`/api/chain/signed/*`). Contracts
 * created before that route do not have it, so every screen asks here first and keeps the older
 * fund-then-send route for a `supported: false`.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contractAddress } = req.query;
  if (typeof contractAddress !== 'string' || !ADDRESS.test(contractAddress)) {
    return res.status(400).json({ error: 'Contract address is required' });
  }

  await forwardToChainAsUser(req, res, {
    method: 'GET',
    path: `/api/chain/contract/${contractAddress}/signed-calls`,
    what: 'support check',
    trace: `does contract ${shortAddress(contractAddress)} take signed actions?`
  });
}
