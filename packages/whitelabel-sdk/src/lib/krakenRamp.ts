/**
 * Kraken's hosted purchase page (ramp.kraken.com), opened with the purchase filled in.
 *
 * ⚠️ FOUND BY TRYING IT, NOT FROM DOCUMENTATION (2026-11-10). Kraken documents this product for
 *    approved partners only; the address below and its parameters are what its public page reads.
 *    Seen to work: USDC on Base, an exact token amount, a minimum of 11 USD. Seen not to work: USDT
 *    on Base (Kraken sells USDT, but not on Base). Not yet seen either way: whether
 *    `wallet_address` arrives filled in. It is sent regardless, and the buyer is shown the address
 *    to check against, because a purchase delivered anywhere else never reaches this wallet.
 *
 * ⚠️ SEEN SINCE (2026-11-23): the page removes `wallet_address` from its own address as it loads,
 *    and its second step is a Kraken sign-in followed by a "wallet-selector". So the buyer needs a
 *    Kraken account and is, as far as can be seen without one, asked for the address there. It is
 *    therefore copied for them wherever this is opened, and the screen says both.
 *
 *    `fiat` takes GBP and EUR as well as USD (100 USDC quoted 81.40 GBP and 97.18 EUR). One it
 *    does not sell in (MXN was tried) it replaces with USD by itself, so any currency is safe to send.
 *
 * A token and network are added to KRAKEN_DELIVERS when a purchase of them has been seen to work.
 */

/** Kraken refuses a purchase below this many US dollars. */
export const KRAKEN_MINIMUM_USD = 11;

/** What Kraken has been seen to deliver, by chain id, with the name its page takes for the network. */
const KRAKEN_DELIVERS: Record<number, { network: string; tokens: string[] }> = {
  8453: { network: 'Base', tokens: ['USDC'] },
};

/** Whether Kraken can deliver this token on this chain. */
export function krakenDelivers(tokenSymbol: string | undefined, chainId: number | undefined): boolean {
  const chain = chainId === undefined ? undefined : KRAKEN_DELIVERS[chainId];
  return !!chain && chain.tokens.includes((tokenSymbol ?? '').toUpperCase());
}

/**
 * The tokens to ask Kraken for: what is needed, or its minimum when that is more. The tokens are
 * dollar stablecoins, so the dollar minimum is taken as a token amount; rounded up to the cent so
 * the purchase cannot land a fraction short.
 */
export function krakenPurchaseAmount(shortfall: number): number {
  return Math.max(Math.ceil(shortfall * 100) / 100, KRAKEN_MINIMUM_USD);
}

/** The purchase page's address, or null for a token or chain Kraken does not deliver. */
export function krakenRampUrl(purchase: {
  walletAddress: string;
  tokenSymbol: string;
  chainId: number | undefined;
  /** In whole tokens: Kraken is asked for this much of the token, not this much money. */
  amount: number;
  /** The money the buyer pays in (ISO code). Kraken falls back to USD for one it does not take. */
  fiatCurrency?: string;
}): string | null {
  if (!krakenDelivers(purchase.tokenSymbol, purchase.chainId)) return null;
  const query = new URLSearchParams({
    fiat: /^[A-Za-z]{3}$/.test(purchase.fiatCurrency ?? '') ? (purchase.fiatCurrency as string).toUpperCase() : 'USD',
    amount: String(purchase.amount),
    amount_type: 'crypto',
    payment_method: 'creditCard',
    crypto: purchase.tokenSymbol.toUpperCase(),
    network: KRAKEN_DELIVERS[purchase.chainId as number].network,
    wallet_address: purchase.walletAddress,
  });
  return `https://ramp.kraken.com/entry?${query.toString()}`;
}
