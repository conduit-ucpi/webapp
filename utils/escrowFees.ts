/**
 * Fee and amount rules for single escrow payment requests.
 *
 * These mirror the escrow contract's terms. They are used for display and
 * client-side validation only — the contract remains the source of truth at
 * settlement time. (The fan-out/smart-project flow prices differently and
 * quotes its fee from the factory contract; none of this applies there.)
 */

/** Smallest real payment request, in USD-pegged stablecoin units. */
export const MIN_AMOUNT = 1;

/** Percentage taken on a real request. */
export const FEE_RATE = 0.01;

/** Floor on the percentage fee, so small requests still cover costs. */
export const MIN_FEE = 0.3;

/**
 * The one amount that bypasses both the minimum and the fee, so people can run
 * a real end-to-end transaction for effectively nothing before committing.
 */
export const TEST_AMOUNT = 0.001;

/** Above this, the 1% rate exceeds the floor and becomes the binding fee. */
export const FEE_FLOOR_BREAKEVEN = MIN_FEE / FEE_RATE; // $30

export function parseAmount(value: string): number | null {
  const parsed = parseFloat((value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function isTestAmount(amount: number): boolean {
  return amount === TEST_AMOUNT;
}

/** Fee charged on a given amount. Test transactions are free. */
export function feeFor(amount: number): number {
  if (isTestAmount(amount)) return 0;
  return Math.max(amount * FEE_RATE, MIN_FEE);
}

/**
 * What the seller ends up with. The fee comes out of the amount funded into
 * the contract rather than being charged on top, so the requested figure is
 * what the buyer pays and this is what lands.
 */
export function netFor(amount: number): number {
  return Math.max(0, amount - feeFor(amount));
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
