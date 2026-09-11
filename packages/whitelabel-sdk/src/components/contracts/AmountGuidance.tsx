import {
  FEE_RATE,
  FEE_FLOOR_BREAKEVEN,
  MIN_AMOUNT,
  MIN_FEE,
  TEST_AMOUNT,
  feeFor,
  formatUsd,
  isTestAmount,
  netFor,
  parseAmount,
} from '@/utils/escrowFees';

interface AmountGuidanceProps {
  amount: string;
  onUseTestAmount: () => void;
  tokenSymbol?: string;
}

/**
 * Live explanation of the amount rules, sitting directly under the amount
 * input. Rather than stating the limits as static fine print, this answers the
 * question the user actually has at that moment — "what will this cost me?" —
 * and turns the free-test rule into a button instead of a magic number to type.
 */
export default function AmountGuidance({
  amount,
  onUseTestAmount,
  tokenSymbol = 'USDC',
}: AmountGuidanceProps) {
  const parsed = parseAmount(amount);
  // Null unless the field holds a positive number, so the branches below can
  // narrow on it directly.
  const value = parsed !== null && parsed > 0 ? parsed : null;

  const testButton = (
    <button
      type="button"
      onClick={onUseTestAmount}
      className="shrink-0 underline underline-offset-2 font-medium hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 rounded"
    >
      Send a free test instead
    </button>
  );

  // Free test: reassure, and be explicit that it is otherwise a real payment.
  if (value !== null && isTestAmount(value)) {
    return (
      <div className="mt-2 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 px-4 py-3">
        <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
          Test payment &mdash; all fees waived
        </p>
        <p className="mt-1 text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
          A real {tokenSymbol} transaction for {TEST_AMOUNT} {tokenSymbol}, so you can
          see the whole flow end to end before committing to a real amount.
        </p>
      </div>
    );
  }

  // Between zero and the minimum: the only blocking state, so name the way out.
  // warning is a 50/500/600 scale only — opacity modifiers stand in for the
  // tints and shades this palette doesn't define.
  if (value !== null && value < MIN_AMOUNT) {
    return (
      <div className="mt-2 rounded-xl border border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 px-4 py-3">
        <p className="text-sm font-medium text-warning-600 dark:text-warning-500">
          Payment requests start at {formatUsd(MIN_AMOUNT)}.
        </p>
        <p className="mt-1 text-xs text-warning-600/90 dark:text-warning-500/90">
          Just trying things out? {testButton}
        </p>
      </div>
    );
  }

  // Valid amount: a small receipt. The fee is deducted from the funded amount,
  // so the number that matters to the seller is what's left — show it outright
  // rather than making them subtract.
  if (value !== null) {
    const fee = feeFor(value);
    const floorApplies = value < FEE_FLOOR_BREAKEVEN;
    return (
      <div className="mt-2 rounded-xl border border-secondary-200 dark:border-secondary-700 px-4 py-3">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-secondary-500 dark:text-secondary-400">
            Fee
            <span className="text-secondary-400 dark:text-secondary-500">
              {floorApplies
                ? ` — ${FEE_RATE * 100}%, minimum ${formatUsd(MIN_FEE)}`
                : ` — ${FEE_RATE * 100}%`}
            </span>
          </span>
          <span className="shrink-0 tabular-nums text-secondary-600 dark:text-secondary-300">
            &minus;{formatUsd(fee)}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-secondary-100 dark:border-secondary-800 flex items-baseline justify-between gap-4 text-sm">
          <span className="text-secondary-600 dark:text-secondary-300">You receive</span>
          <span className="shrink-0 tabular-nums font-medium text-secondary-900 dark:text-white">
            {formatUsd(netFor(value))}
          </span>
        </div>
        <p className="mt-2 text-xs text-secondary-400 dark:text-secondary-500">{testButton}</p>
      </div>
    );
  }

  // Nothing typed yet: state both limits up front so neither is a surprise.
  return (
    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
      <p className="text-sm text-secondary-500 dark:text-secondary-400">
        Minimum {formatUsd(MIN_AMOUNT)}
        <span className="text-secondary-400 dark:text-secondary-500">
          {' '}
          &middot; fee {FEE_RATE * 100}%, minimum {formatUsd(MIN_FEE)}
        </span>
      </p>
      <p className="text-xs text-secondary-400 dark:text-secondary-500">{testButton}</p>
    </div>
  );
}
