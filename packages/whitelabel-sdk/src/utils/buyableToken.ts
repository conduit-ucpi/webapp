/**
 * Whether a token can be bought here with a card or through an exchange.
 *
 * ⚠️ ONLY USDC, BECAUSE NO ONRAMP WE HAVE DELIVERS ANYTHING ELSE ON BASE (found 2026-11-10 with
 *    USDT). Privy quotes through Stripe, which answers "Unsupported asset for Stripe onramp: USDT
 *    on eip155:8453", and the Coinbase route turned the same buyer away. Offering a button that
 *    can only fail is worse than saying so: the buying routes are greyed out with the reason, and
 *    sending the token from a wallet that already holds it stays open.
 *
 * A token is added here when a route for it has been seen to work, not when it is listed.
 */
export function canBuyToken(symbol: string | undefined): boolean {
  return (symbol ?? '').toUpperCase() === 'USDC';
}
