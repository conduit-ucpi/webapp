/**
 * Stripe's public purchase page (crypto.link.com, "Link"), opened with the purchase filled in.
 *
 * ⚠️ FOUND BY READING ITS PAGE, NOT FROM AN INTEGRATION (2026-11-10). The page takes the token,
 *    the network and the amount from its address and opens a session with no merchant behind it,
 *    so it needs no key of ours. It reads NO wallet address: the buyer pastes it in on Link. So
 *    wherever this is offered, the address is copied for them and shown to check against, because
 *    a purchase delivered anywhere else never reaches this payment.
 *
 * Not the Stripe onramp inside Privy's window, which is a different, keyed integration.
 *
 * A token and network are added to LINK_DELIVERS when a purchase of them has been seen to work.
 * USDC on Base is what Stripe lists. ⚠️ IT DOES NOT SELL USDT HERE: Stripe lists USDT on Ethereum
 * only, so USDT is never offered through Link on Base.
 */

/** Where Link sells: the United States only (ISO country codes). See hooks/useLinkAvailability. */
export const LINK_COUNTRIES: readonly string[] = ['US'];

/** What Link delivers, by chain id, with the name its page takes for the network. */
const LINK_DELIVERS: Record<number, { network: string; tokens: string[] }> = {
  8453: { network: 'base', tokens: ['USDC'] },
};

/** Whether Link can deliver this token on this chain. */
export function linkDelivers(tokenSymbol: string | undefined, chainId: number | undefined): boolean {
  const chain = chainId === undefined ? undefined : LINK_DELIVERS[chainId];
  return !!chain && chain.tokens.includes((tokenSymbol ?? '').toUpperCase());
}

/** The purchase page's address, or null for a token or chain Link does not deliver. */
export function linkOnrampUrl(purchase: {
  tokenSymbol: string;
  chainId: number | undefined;
  /** In whole tokens: Link is asked for this much of the token, not this much money. */
  amount: number;
}): string | null {
  if (!linkDelivers(purchase.tokenSymbol, purchase.chainId)) return null;
  const query = new URLSearchParams({
    destination_currency: purchase.tokenSymbol.toLowerCase(),
    destination_network: LINK_DELIVERS[purchase.chainId as number].network,
    destination_amount: String(purchase.amount),
  });
  return `https://crypto.link.com/?${query.toString()}`;
}
