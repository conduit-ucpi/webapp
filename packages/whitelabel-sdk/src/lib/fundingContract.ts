/**
 * Which payment the buyer is funding, for everything that logs or remembers a funding step.
 *
 * ⚠️ THE PAGE'S ADDRESS IS NOT ENOUGH. A seller's request is opened at /contract-pay?contractId=…,
 *    and the logging used to read the id from there alone. A buyer paying on their own terms is at
 *    /pay?resume=…, which carries no contract id, so every one of their funding lines said
 *    "contract none" (seen 2026-11-26: eighteen lines for a payment the page had on file all
 *    along). The page that holds the payment says which it is (`setFundingContract`); the address
 *    is the fallback, for a page that has not said yet.
 */
let current: string | null = null;

/** The pay page: the payment on screen is this one. Null when it no longer is. */
export function setFundingContract(id: string | null | undefined): void {
  current = id || null;
}

/** The payment being funded: what the page said, or the `contractId` in an address. */
export function fundingContract(address?: string): string | undefined {
  if (current) return current;
  try {
    const search = address ? new URL(address, window.location.origin).search : window.location.search;
    return new URLSearchParams(search).get('contractId') ?? undefined;
  } catch {
    return undefined;
  }
}
