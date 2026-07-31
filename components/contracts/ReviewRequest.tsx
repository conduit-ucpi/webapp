/**
 * "Confirm Request Details" - the review screen of the create sequence.
 *
 * Presentation only; submission stays in CreateContractWizard. The fiat
 * equivalent reuses the same useExchangeRate hook that CurrencyAmountInput
 * uses, so the two screens can never disagree about the rate.
 */

import { useExchangeRate } from '@/hooks/useExchangeRate';
import { formatDateTimeWithTZ } from '@/utils/validation';

interface ReviewRequestProps {
  amount: string;
  tokenSymbol: string;
  /** e.g. "Base Mainnet" */
  networkLabel?: string;
  description: string;
  /** Unix seconds; ignored when isInstantPayment */
  payoutTimestamp: number;
  isInstantPayment: boolean;
  onEdit: () => void;
}

export default function ReviewRequest({
  amount,
  tokenSymbol,
  networkLabel,
  description,
  payoutTimestamp,
  isInstantPayment,
  onEdit,
}: ReviewRequestProps) {
  const { rate } = useExchangeRate('USD', tokenSymbol);

  const parsedAmount = parseFloat(amount || '0');
  const usdEquivalent = rate && rate > 0 ? parsedAmount / rate : parsedAmount;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Back to payment terms"
          className="text-secondary-500 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h2 className="text-2xl sm:text-3xl font-semibold text-secondary-900 dark:text-white">
          Confirm Request Details
        </h2>
      </div>

      <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 sm:p-8">
        <div className="text-center">
          <p className="text-4xl sm:text-5xl font-bold text-secondary-900 dark:text-white tracking-tight">
            {parsedAmount ? parsedAmount.toFixed(4) : '0.0000'}{' '}
            <span className="text-secondary-400 dark:text-secondary-500 font-semibold">{tokenSymbol}</span>
          </p>
          <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
            {networkLabel ? `${networkLabel} = ` : ''}
            ${usdEquivalent.toFixed(2)} USD
          </p>
        </div>

        <div className="mt-7 pt-6 border-t border-secondary-200 dark:border-secondary-700 space-y-4">
          <div className="flex items-start justify-between gap-6">
            <span className="text-sm text-secondary-500 dark:text-secondary-400">Release</span>
            <span className="text-sm font-semibold text-secondary-900 dark:text-white text-right">
              {isInstantPayment
                ? 'Instant, on confirmation'
                : formatDateTimeWithTZ(payoutTimestamp)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-6">
            <span className="text-sm text-secondary-500 dark:text-secondary-400">Description</span>
            <span className="text-sm font-semibold text-secondary-900 dark:text-white text-right break-words">
              {description}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border-2 border-primary-500 bg-white dark:bg-secondary-900 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-secondary-900 dark:text-white">
          What happens next?
        </h3>
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-300 leading-relaxed">
          You&apos;ll get a QR code and link to share. Once the buyer pays, funds are held in
          escrow and release to your wallet automatically &mdash; no extra step from you.
        </p>
      </div>
    </div>
  );
}
