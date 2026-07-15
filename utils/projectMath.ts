/**
 * Pure conversions for the Projects feature. Server-side only (API routes):
 * client components receive derived values, never compute them (thin-frontend
 * rule — see PROJECTS_UI_SPEC.md).
 *
 * Mirrors the on-chain semantics of CompletionEscrowContract:
 * - shares are basis points summing to exactly 10000
 * - payouts are floor(escrow * bps / 10000); the LAST recipient absorbs dust
 * - the platform fee is deducted from the deposit before the split
 */

export const BPS_DENOMINATOR = 10000;

/** Convert a human token amount to integer base units (e.g. USDC: 6 decimals). */
export function toBaseUnits(amount: number, decimals: number = 6): bigint {
  // Round via string math to dodge float artifacts (0.1 + 0.2 style).
  const fixed = amount.toFixed(decimals);
  const [whole, frac = ''] = fixed.split('.');
  return BigInt(whole + frac.padEnd(decimals, '0'));
}

/** Convert integer base units back to a display string, trimming zeros. */
export function fromBaseUnits(units: bigint, decimals: number = 6): string {
  const negative = units < BigInt(0);
  const abs = negative ? -units : units;
  const s = abs.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}

/**
 * Per-recipient payouts of an escrow amount by basis points, exactly as the
 * contract distributes: floor division for every slice except the last, which
 * receives the remainder (all rounding dust).
 */
export function splitByBps(escrowBaseUnits: bigint, bps: number[]): bigint[] {
  if (bps.length === 0) return [];
  let distributed = BigInt(0);
  return bps.map((share, i) => {
    if (i === bps.length - 1) {
      return escrowBaseUnits - distributed;
    }
    const slice = (escrowBaseUnits * BigInt(share)) / BigInt(BPS_DENOMINATOR);
    distributed += slice;
    return slice;
  });
}

/**
 * Convert per-recipient dollar amounts to basis points summing to exactly
 * 10000. Each share is rounded to the nearest bps; any residue from rounding
 * is assigned to the largest share (least relative distortion).
 * Throws when a share would round to zero bps (the contract rejects bps == 0).
 */
export function amountsToBps(amounts: number[]): number[] {
  const total = amounts.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error('Total amount must be positive');
  const raw = amounts.map((a) => (a / total) * BPS_DENOMINATOR);
  const rounded = raw.map((r) => Math.round(r));
  const residue = BPS_DENOMINATOR - rounded.reduce((a, b) => a + b, 0);
  if (residue !== 0) {
    const largest = rounded.indexOf(Math.max(...rounded));
    rounded[largest] += residue;
  }
  if (rounded.some((b) => b <= 0)) {
    throw new Error('Every recipient share must round to at least 1 basis point (0.01%)');
  }
  return rounded;
}

/** Display percentage for a bps share, e.g. 2550 -> "25.5". */
export function bpsToPercentString(bps: number): string {
  return (bps / 100).toString();
}

/** Parse a user-entered percentage into bps, validating 0 < p <= 100 with 2dp. */
export function percentToBps(percent: number): number {
  const bps = Math.round(percent * 100);
  if (bps <= 0 || bps > BPS_DENOMINATOR) {
    throw new Error('Percentage must be between 0.01 and 100');
  }
  return bps;
}
