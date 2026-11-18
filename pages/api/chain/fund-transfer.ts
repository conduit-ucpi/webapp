import { NextApiRequest, NextApiResponse } from 'next';
import { ADDRESS, FUND_TRANSFER_LOG_TAG, WHOLE_NUMBER, forwardToChainAsUser, shortAddress } from '@/lib/server/chainAsUser';

/**
 * POST /api/chain/fund-transfer — gas for ONE token transfer from the caller's own wallet.
 *
 * A token's `transfer` is a call on a contract that is not ours, so it cannot go as a signed
 * message the way our own contract's actions do: the wallet has to send it, and so has to hold
 * the gas. The caller says which transfer it wants to make and chainservice decides whether to
 * pay for it, and how much:
 *
 *   walletAddress, tokenAddress, toAddress   addresses
 *   amount                                   in the token's smallest unit, as a decimal string
 *   neededWei (optional)                     what the wallet reckons it needs; it can lower what
 *                                            is sent, never raise it
 *
 * chainservice refuses unless the wallet is the caller's own, holds the tokens, would succeed in
 * making the transfer, and has sent no native tokens out in the last 24 hours. A wallet that
 * already holds enough is sent nothing and told so. The destination is not judged.
 *
 * Its status and body come back unchanged: 200 with `funded` true or false when the wallet can
 * make the transfer; 400 with `reason` when it is refused; 503 when it could not be checked.
 *
 * Unlike the older /api/chain/fund-wallet, the caller cannot name an amount of gas to be given.
 * Only these fields are forwarded; the body is rebuilt, never passed through.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body ?? {};
  for (const field of ['walletAddress', 'tokenAddress', 'toAddress'] as const) {
    if (typeof body[field] !== 'string' || !ADDRESS.test(body[field])) {
      return res.status(400).json({ error: `${field} must be an address` });
    }
  }
  const text = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value);
  const amount = text(body.amount);
  if (typeof amount !== 'string' || !WHOLE_NUMBER.test(amount) || /^0+$/.test(amount)) {
    return res.status(400).json({ error: 'amount must be a whole number above zero, in the token\'s smallest unit' });
  }
  const forwarded: Record<string, string> = {
    walletAddress: body.walletAddress,
    tokenAddress: body.tokenAddress,
    toAddress: body.toAddress,
    amount
  };
  if (body.neededWei !== undefined && body.neededWei !== null) {
    const neededWei = text(body.neededWei);
    if (typeof neededWei !== 'string' || !WHOLE_NUMBER.test(neededWei)) {
      return res.status(400).json({ error: 'neededWei must be a whole number of wei' });
    }
    forwarded.neededWei = neededWei;
  }

  await forwardToChainAsUser(req, res, {
    method: 'POST',
    path: '/api/chain/fund-transfer',
    body: forwarded,
    what: 'fund-transfer',
    tag: FUND_TRANSFER_LOG_TAG,
    trace:
      `wallet ${shortAddress(forwarded.walletAddress)} wants to send ${forwarded.amount} of token ` +
      `${shortAddress(forwarded.tokenAddress)} to ${shortAddress(forwarded.toAddress)}` +
      (forwarded.neededWei ? `, reckoning it needs ${forwarded.neededWei} wei` : '')
  });
}
