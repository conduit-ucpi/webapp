/**
 * Amount rules for single escrow payment requests: the product's own minimum and free test
 * amount, and how amounts are parsed and shown.
 *
 * ⚠️ NO FEE RULE HERE. The fee is the escrow factory's (`quoteCreatorFee`); ask it with
 *    `useFeeQuote` (→ /api/fee-quote → chainservice). A copy of the rule used to live in this
 *    file and would have gone on quoting the old figure the moment the contract changed.
 */

/** Smallest real payment request, in USD-pegged stablecoin units. */
export const MIN_AMOUNT = 1;

/**
 * The one amount that bypasses both the minimum and the fee, so people can run
 * a real end-to-end transaction for effectively nothing before committing.
 */
export const TEST_AMOUNT = 0.001;

export function parseAmount(value: string): number | null {
  const parsed = parseFloat((value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function isTestAmount(amount: number): boolean {
  return amount === TEST_AMOUNT;
}

/**
 * Whether an amount may be submitted: either the free test amount, or at or
 * above the minimum. Anything between the two is rejected.
 */
export function isAllowedAmount(amount: number): boolean {
  return isTestAmount(amount) || amount >= MIN_AMOUNT;
}

export function formatUsd(amount: number): string {
  // Test amounts need more than 2dp or they render as "$0.00".
  return amount < 0.01 && amount > 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}
