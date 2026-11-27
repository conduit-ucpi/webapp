import { NextApiRequest, NextApiResponse } from 'next';
import { ADDRESS, FUND_SWAP_LOG_TAG, WHOLE_NUMBER, forwardToChainAsUser, shortAddress } from '@/lib/server/chainAsUser';

/**
 * POST /api/chain/fund-swap-approval — gas for the FIRST step of converting one stablecoin into
 * another in the caller's own wallet: letting the router take the token being converted from.
 *
 *   walletAddress, tokenAddress   addresses; the token is the one the wallet holds
 *   amount                        the most the router may take, in the token's smallest unit
 *   neededWei (optional)          what the wallet reckons it needs; it can lower what is sent,
 *                                 never raise it
 *
 * The caller does not name the spender. chainservice builds `approve(router, amount)` itself,
 * with its own configured router, simulates it and decides by the same rules as a transfer: the
 * wallet is the caller's own, holds the tokens, and has sent no native tokens out in the last 24
 * hours. If the router may already take that much it says so and sends nothing.
 *
 * Its status and body come back unchanged. Only these fields are forwarded; the body is rebuilt,
 * never passed through, and there is no field for an amount of gas to be given.
 */

const text = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value);
const aboveZero = (value: unknown): value is string => typeof value === 'string' && WHOLE_NUMBER.test(value) && !/^0+$/.test(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body ?? {};
  for (const field of ['walletAddress', 'tokenAddress'] as const) {
    if (typeof body[field] !== 'string' || !ADDRESS.test(body[field])) {
      return res.status(400).json({ error: `${field} must be an address` });
    }
  }
  const amount = text(body.amount);
  if (!aboveZero(amount)) {
    return res.status(400).json({ error: 'amount must be a whole number above zero, in the token\'s smallest unit' });
  }
  const forwarded: Record<string, string> = { walletAddress: body.walletAddress, tokenAddress: body.tokenAddress, amount };
  if (body.neededWei !== undefined && body.neededWei !== null) {
    const neededWei = text(body.neededWei);
    if (typeof neededWei !== 'string' || !WHOLE_NUMBER.test(neededWei)) {
      return res.status(400).json({ error: 'neededWei must be a whole number of wei' });
    }
    forwarded.neededWei = neededWei;
  }

  await forwardToChainAsUser(req, res, {
    method: 'POST',
    path: '/api/chain/fund-swap-approval',
    body: forwarded,
    what: 'fund-swap-approval',
    tag: FUND_SWAP_LOG_TAG,
    trace:
      `approval: wallet ${shortAddress(forwarded.walletAddress)} wants to let the router take up to ${forwarded.amount} ` +
      `of token ${shortAddress(forwarded.tokenAddress)}` +
      (forwarded.neededWei ? `, reckoning it needs ${forwarded.neededWei} wei` : '')
  });
}
