/**
 * Where to pay a contract from the dashboard: /contract-pay for a request made on the site, or
 * the /pay link contractservice supplies for one /contract-pay cannot pay.
 *
 * ⚠️ /contract-pay derives the escrow address from the CONNECTED wallet and the record's id. An
 *    escrow put on file by ap2service names its buyer up front and was seeded by something else,
 *    so that page would quote a different address. contractservice sends `payLink` for exactly
 *    those, and it is followed by path and query only, so a partner's site keeps its own domain
 *    (the link already carries `&b=` for the partner it was made under).
 */
export function payHref(
  contract: { id?: string; payLink?: string | null },
  brandedHref: (href: string) => string
): string | null {
  if (contract.payLink) {
    try {
      const url = new URL(contract.payLink);
      return `${url.pathname}${url.search}`;
    } catch {
      // A malformed link is ignored, not followed.
    }
  }
  return contract.id ? brandedHref(`/contract-pay?contractId=${contract.id}`) : null;
}
