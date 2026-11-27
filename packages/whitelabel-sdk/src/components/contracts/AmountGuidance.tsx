import { MIN_AMOUNT, TEST_AMOUNT, formatUsd, isTestAmount, parseAmount } from '@/utils/escrowFees';
import { useFeeQuote } from '../../hooks/useFeeQuote';
import { useT, withNodes } from '../../i18n';

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
  const t = useT();
  const parsed = parseAmount(amount);
  // Null unless the field holds a positive number, so the branches below can
  // narrow on it directly.
  const value = parsed !== null && parsed > 0 ? parsed : null;
  // The fee is the escrow factory's own figure, asked as the amount is typed — never worked
  // out here. Only asked for an amount that can actually be submitted.
  const quote = useFeeQuote(value !== null && value >= MIN_AMOUNT ? value : null, tokenSymbol);

  const testButton = (
    <button
      type="button"
      onClick={onUseTestAmount}
      className="shrink-0 underline underline-offset-2 font-medium hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 rounded"
    >
      {t('amount.testFree')}
    </button>
  );

  // Free test: reassure, and be explicit that it is otherwise a real payment.
  if (value !== null && isTestAmount(value)) {
    return (
      <div className="mt-2 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 px-4 py-3">
        <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
          {t('amount.testWaived')}
        </p>
        <p className="mt-1 text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
          {t('amount.testExplainer', { token: tokenSymbol, amount: TEST_AMOUNT })}
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
          {t('amount.startsAt', { min: formatUsd(MIN_AMOUNT) })}
        </p>
        <p className="mt-1 text-xs text-warning-600/90 dark:text-warning-500/90">
          {withNodes(t('amount.justTrying'), { button: testButton })}
        </p>
      </div>
    );
  }

  // An amount the factory says cannot cover its own minimum fee: it would refuse the escrow.
  if (value !== null && quote.state === 'tooSmall') {
    return (
      <div className="mt-2 rounded-xl border border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 px-4 py-3">
        <p className="text-sm font-medium text-warning-600 dark:text-warning-500">{t('amount.tooSmallForFee')}</p>
        <p className="mt-1 text-xs text-warning-600/90 dark:text-warning-500/90">{testButton}</p>
      </div>
    );
  }

  // Valid amount: a small receipt. The fee is deducted from the funded amount,
  // so the number that matters to the seller is what's left — show it outright
  // rather than making them subtract. Both figures wait for the factory's answer.
  if (value !== null) {
    const fee = quote.state === 'quoted' ? quote.fee : null;
    const pending = quote.state === 'loading' || quote.state === 'idle';
    return (
      <div className="mt-2 rounded-xl border border-secondary-200 dark:border-secondary-700 px-4 py-3">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-secondary-500 dark:text-secondary-400">{t('amount.fee')}</span>
          <span className="shrink-0 tabular-nums text-secondary-600 dark:text-secondary-300">
            {fee !== null ? <>&minus;{formatUsd(fee)}</> : pending ? '…' : t('amount.feeUnavailable')}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-secondary-100 dark:border-secondary-800 flex items-baseline justify-between gap-4 text-sm">
          <span className="text-secondary-600 dark:text-secondary-300">{t('amount.youReceive')}</span>
          <span className="shrink-0 tabular-nums font-medium text-secondary-900 dark:text-white">
            {fee !== null ? formatUsd(Math.max(0, value - fee)) : '…'}
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
        {t('amount.minimum', { min: formatUsd(MIN_AMOUNT) })}
        <span className="text-secondary-400 dark:text-secondary-500">
          {' '}
          {t('amount.feeSuffix')}
        </span>
      </p>
      <p className="text-xs text-secondary-400 dark:text-secondary-500">{testButton}</p>
    </div>
  );
}
