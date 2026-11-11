import { ethers } from 'ethers';

/**
 * Converting one stablecoin into another in the buyer's own wallet, so a request in a token they
 * cannot buy (USDT on Base) can be paid with one they can (USDC).
 *
 * The wallet swaps on Uniswap for EXACTLY the amount it is short, into itself, and then pays the
 * ordinary way. We never hold the money and nothing here touches the payment address: a swap that
 * fails or is abandoned leaves the buyer holding their own tokens.
 *
 * ⚠️ ADDRESSES ARE PER NETWORK AND WERE READ FROM UNISWAP'S OWN DEPLOYMENT LIST (11 Nov 2026), which
 *    says not to assume they match across chains. A network is added here when its addresses have
 *    been read from that list and a quote has been seen to come back, not before.
 */
export interface SwapVenue {
  /** Uniswap v3 SwapRouter02: what the wallet approves and calls. */
  router: string;
  /** Uniswap v3 QuoterV2: asked, read-only, what a swap would cost. */
  quoter: string;
  /** The pool's fee tier, in hundredths of a basis point. 100 is the 0.01% stablecoin pool. */
  fee: number;
  /** The tokens this pool converts between, by symbol. */
  tokens: string[];
}

export const SWAP_VENUES: Record<number, SwapVenue> = {
  8453: {
    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    fee: 100,
    tokens: ['USDC', 'USDT'],
  },
};

/** How far the price may move between the quote and the swap before the swap refuses: 0.5%. */
export const SWAP_SLIPPAGE_BPS = 50;
/**
 * The most a conversion may cost over one-for-one before we refuse to offer it: 1%. Two dollar
 * stablecoins trade within a few hundredths of a percent; more than this means the pool is too
 * thin for the amount, or something is wrong, and the buyer should not find out by paying it.
 */
export const SWAP_MAX_PREMIUM_BPS = 100;
/** Bought on top of the quote when funding a conversion, so fees and a moving price do not leave it short: 1%. */
export const SWAP_PURCHASE_MARGIN_BPS = 100;

const upper = (symbol: string | undefined) => (symbol ?? '').toUpperCase();

/** Where `from` can be converted into `to` on this network, or null. */
export function swapVenue(chainId: number | undefined, from: string | undefined, to: string | undefined): SwapVenue | null {
  const venue = chainId === undefined ? undefined : SWAP_VENUES[Number(chainId)];
  if (!venue || upper(from) === upper(to)) return null;
  return venue.tokens.includes(upper(from)) && venue.tokens.includes(upper(to)) ? venue : null;
}

/** The token a request in `to` could be paid with instead, by symbol, or null. */
export function convertibleFrom(chainId: number | undefined, to: string | undefined): string | null {
  const venue = chainId === undefined ? undefined : SWAP_VENUES[Number(chainId)];
  if (!venue || !venue.tokens.includes(upper(to))) return null;
  return venue.tokens.find((symbol) => symbol !== upper(to)) ?? null;
}

/** The most the swap may take: the quote plus the slippage allowance. */
export function maxAmountIn(quoted: bigint): bigint {
  return quoted + (quoted * BigInt(SWAP_SLIPPAGE_BPS)) / BigInt(10000);
}

/** Whether paying `amountIn` for `amountOut` stays inside the premium cap. Both in base units. */
export function withinPremium(amountIn: bigint, amountOut: bigint, decimalsIn: number, decimalsOut: number): boolean {
  if (amountOut <= BigInt(0)) return false;
  // Compared at a common scale, so tokens with different decimals are like for like.
  const scaledIn = amountIn * BigInt('1' + '0'.repeat(decimalsOut));
  const scaledOut = amountOut * BigInt('1' + '0'.repeat(decimalsIn));
  return scaledIn * BigInt(10000) <= scaledOut * BigInt(10000 + SWAP_MAX_PREMIUM_BPS);
}

/** What to buy, in whole tokens, to be able to convert `cost`: the margin on top, up to the cent. */
export function purchaseAmountFor(cost: number): number {
  return Math.ceil(cost * (1 + SWAP_PURCHASE_MARGIN_BPS / 10000) * 100) / 100;
}

// Built on first use, not at import: web3.ts imports this file, and suites that replace ethers
// with a stand-in would otherwise fail on loading it.
let quoterInterface: ethers.Interface | null = null;
let routerInterface: ethers.Interface | null = null;
const QUOTER = () =>
  (quoterInterface ??= new ethers.Interface([
    'function quoteExactOutputSingle((address tokenIn,address tokenOut,uint256 amount,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountIn,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
  ]));
const ROUTER = () =>
  (routerInterface ??= new ethers.Interface([
    'function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountIn)',
  ]));

export function encodeQuote(venue: SwapVenue, tokenIn: string, tokenOut: string, amountOut: bigint): string {
  return QUOTER().encodeFunctionData('quoteExactOutputSingle', [
    { tokenIn, tokenOut, amount: amountOut, fee: venue.fee, sqrtPriceLimitX96: 0 },
  ]);
}

export function decodeQuote(result: string): bigint {
  return QUOTER().decodeFunctionResult('quoteExactOutputSingle', result)[0] as bigint;
}

export interface SwapCall {
  tokenIn: string;
  tokenOut: string;
  recipient: string;
  amountOut: bigint;
  amountInMaximum: bigint;
}

export function encodeSwap(venue: SwapVenue, call: SwapCall): string {
  return ROUTER().encodeFunctionData('exactOutputSingle', [{ ...call, fee: venue.fee, sqrtPriceLimitX96: 0 }]);
}

/** A swap's terms read back out of its calldata, for saying what the wallet is being asked to do. */
export function decodeSwap(data: string): SwapCall | null {
  try {
    const [params] = ROUTER().decodeFunctionData('exactOutputSingle', data);
    return {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      recipient: params.recipient,
      amountOut: params.amountOut,
      amountInMaximum: params.amountInMaximum,
    };
  } catch {
    return null;
  }
}

/** Whether `address` is a router we send swaps to, on any network we list. */
export function isSwapRouter(address: string | undefined): boolean {
  return !!address && Object.values(SWAP_VENUES).some((venue) => venue.router.toLowerCase() === address.toLowerCase());
}
