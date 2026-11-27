/**
 * Recognise the two steps of a stablecoin conversion in a transaction about to be sent.
 *
 * Like a token transfer (lib/tokenTransfer.ts), each step's gas is asked for by naming the step,
 * not an amount of gas: /api/chain/fund-swap-approval, then /api/chain/fund-swap. chainservice
 * builds the call itself from the terms, simulates it, and applies the same rules as a transfer.
 *
 * ⚠️ EXACTLY THESE TWO CALLS, AND NOTHING THAT MERELY RESEMBLES THEM.
 *    - The approval: `approve(spender, amount)` where the spender is a router WE list. An
 *      approval of anything else is not a conversion step.
 *    - The conversion: `exactOutputSingle` (exactly this much arrives) or `exactInputSingle`
 *      (exactly this much leaves) on a router we list, paying out to the SENDER. One that pays
 *      out elsewhere is not what chainservice will simulate, so it is not asked for as one.
 *    Anything else is not answered here: the caller falls back to the older request, which is
 *    the safe direction to be wrong in.
 */
import { decodeSale, decodeSwap, isSwapRouter } from '@/lib/stablecoinSwap';
import { sendsNativeValue } from '@/lib/tokenTransfer';

const APPROVE_SELECTOR = '095ea7b3';

export interface SwapApproval {
  /** The token being converted from: where the approval is sent. */
  tokenAddress: string;
  /** The most the router may take, in the token's smallest unit, as a decimal string. */
  amount: string;
}

/**
 * The terms of a conversion, as /api/chain/fund-swap takes them: one pair of amounts or the
 * other, never both. Decimal strings, each in its token's smallest unit.
 */
export type SwapConversion = { tokenIn: string; tokenOut: string } & (
  | { amountOut: string; amountInMaximum: string }
  | { amountIn: string; amountOutMinimum: string }
);

type Tx = { to: string; data: string; value?: string };

export function asSwapApproval(tx: Tx): SwapApproval | null {
  if (!/^0x[0-9a-fA-F]{40}$/.test(tx.to ?? '') || typeof tx.data !== 'string') return null;
  const data = tx.data.toLowerCase();
  if (!/^0x[0-9a-f]*$/.test(data) || data.length !== 2 + 8 + 64 + 64) return null;
  if (data.slice(2, 10) !== APPROVE_SELECTOR) return null;
  if (sendsNativeValue(tx.value)) return null;

  const spender = data.slice(10, 74);
  if (!/^0{24}/.test(spender) || !isSwapRouter('0x' + spender.slice(24))) return null;
  const amount = BigInt('0x' + data.slice(74));
  if (amount <= BigInt(0)) return null;

  return { tokenAddress: tx.to, amount: amount.toString() };
}

export function asSwapConversion(tx: Tx, sender: string): SwapConversion | null {
  if (!isSwapRouter(tx.to) || typeof tx.data !== 'string' || sendsNativeValue(tx.value)) return null;
  const toSender = (recipient: string) => String(recipient).toLowerCase() === String(sender ?? '').toLowerCase();

  const swap = decodeSwap(tx.data);
  if (swap) {
    if (!toSender(swap.recipient)) return null;
    if (swap.amountOut <= BigInt(0) || swap.amountInMaximum <= BigInt(0)) return null;
    return {
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      amountOut: swap.amountOut.toString(),
      amountInMaximum: swap.amountInMaximum.toString(),
    };
  }

  const sale = decodeSale(tx.data);
  if (!sale || !toSender(sale.recipient)) return null;
  if (sale.amountIn <= BigInt(0) || sale.amountOutMinimum <= BigInt(0)) return null;
  return {
    tokenIn: sale.tokenIn,
    tokenOut: sale.tokenOut,
    amountIn: sale.amountIn.toString(),
    amountOutMinimum: sale.amountOutMinimum.toString(),
  };
}
