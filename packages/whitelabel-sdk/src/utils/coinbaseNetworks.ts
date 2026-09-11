/**
 * Coinbase's name for the chain we are running on.
 *
 * Coinbase identifies networks by its own slugs, which are close enough to the
 * obvious names to be dangerous — it is `avacchain`, not `avalanche-c-chain`,
 * and there is no `base-sepolia` at all. The list below was read back from the
 * live CDP API (`GET /onramp/v1/buy/options`) rather than transcribed from docs.
 *
 * Only the chains this app can actually be deployed to are mapped. Anything else
 * returns undefined, which hides the cash-out UI — the right outcome, because a
 * guessed slug means a user sends real tokens on a chain Coinbase is not
 * watching for their order.
 */

const COINBASE_NETWORK_BY_CHAIN_ID: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  8453: 'base',
  42161: 'arbitrum',
  43114: 'avacchain',
};

/**
 * Coinbase's slug for a chain id, or undefined when Coinbase does not support it.
 *
 * Testnets are deliberately absent: Coinbase's on/offramp is production-only, so
 * a Base Sepolia deployment correctly gets no cash-out UI rather than a flow that
 * fails at the last step.
 */
export function coinbaseNetworkForChainId(chainId: number): string | undefined {
  return COINBASE_NETWORK_BY_CHAIN_ID[chainId];
}

/** Exposed for tests and tooling that need to know what is covered. */
export function supportedCoinbaseChainIds(): number[] {
  return Object.keys(COINBASE_NETWORK_BY_CHAIN_ID).map(Number);
}
