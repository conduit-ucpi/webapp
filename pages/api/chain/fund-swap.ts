import { NextApiRequest, NextApiResponse } from 'next';
import { ADDRESS, FUND_SWAP_LOG_TAG, WHOLE_NUMBER, forwardToChainAsUser, shortAddress } from '@/lib/server/chainAsUser';

/**
 * POST /api/chain/fund-swap — gas for the SECOND step of converting one stablecoin into another
 * in the caller's own wallet: the conversion itself.
 *
 *   walletAddress, tokenIn, tokenOut   addresses; tokenIn is held, tokenOut is wanted
 *   EITHER amountOut                   exactly what should arrive, in tokenOut's smallest unit
 *      and amountInMaximum             the most that may leave, in tokenIn's smallest unit
 *   OR     amountIn                    exactly what should leave, in tokenIn's smallest unit
 *      and amountOutMinimum            the least that may arrive, in tokenOut's smallest unit
 *   neededWei (optional)               what the wallet reckons it needs; it can lower what is
 *                                      sent, never raise it
 *
 * The caller names the conversion's terms and nothing else. chainservice builds the router call
 * itself, paying out to the caller's own wallet, and simulates it AS that wallet, so it passes
 * only once the approval (/api/chain/fund-swap-approval) is on chain. Then the same rules as a
 * transfer: the wallet holds the tokens and has sent no native tokens out in the last 24 hours.
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
  for (const field of ['walletAddress', 'tokenIn', 'tokenOut'] as const) {
    if (typeof body[field] !== 'string' || !ADDRESS.test(body[field])) {
      return res.status(400).json({ error: `${field} must be an address` });
    }
  }
  const forwarded: Record<string, string> = { walletAddress: body.walletAddress, tokenIn: body.tokenIn, tokenOut: body.tokenOut };
  // One way of naming the amounts or the other: a body with some of each names neither conversion.
  const present = (field: string) => body[field] !== undefined && body[field] !== null;
  const selling = present('amountIn') || present('amountOutMinimum');
  if (selling && (present('amountOut') || present('amountInMaximum'))) {
    return res.status(400).json({ error: 'Give amountOut and amountInMaximum, or amountIn and amountOutMinimum, not both' });
  }
  for (const field of selling ? (['amountIn', 'amountOutMinimum'] as const) : (['amountOut', 'amountInMaximum'] as const)) {
    const amount = text(body[field]);
    if (!aboveZero(amount)) {
      return res.status(400).json({ error: `${field} must be a whole number above zero, in the token's smallest unit` });
    }
    forwarded[field] = amount;
  }
  if (body.neededWei !== undefined && body.neededWei !== null) {
    const neededWei = text(body.neededWei);
    if (typeof neededWei !== 'string' || !WHOLE_NUMBER.test(neededWei)) {
      return res.status(400).json({ error: 'neededWei must be a whole number of wei' });
    }
    forwarded.neededWei = neededWei;
  }

  await forwardToChainAsUser(req, res, {
    method: 'POST',
    path: '/api/chain/fund-swap',
    body: forwarded,
    what: 'fund-swap',
    tag: FUND_SWAP_LOG_TAG,
    trace:
      (selling
        ? `conversion: wallet ${shortAddress(forwarded.walletAddress)} wants to convert exactly ${forwarded.amountIn} of token ` +
          `${shortAddress(forwarded.tokenIn)} into at least ${forwarded.amountOutMinimum} of token ${shortAddress(forwarded.tokenOut)}`
        : `conversion: wallet ${shortAddress(forwarded.walletAddress)} wants exactly ${forwarded.amountOut} of token ` +
          `${shortAddress(forwarded.tokenOut)} for at most ${forwarded.amountInMaximum} of token ${shortAddress(forwarded.tokenIn)}`) +
      (forwarded.neededWei ? `, reckoning it needs ${forwarded.neededWei} wei` : '')
  });
}
