/**
 * "Confirm Request Details" - the review screen of the create sequence.
 *
 * Presentation only; submission stays in CreateContractWizard. The fiat
 * equivalent reuses the same useExchangeRate hook that CurrencyAmountInput
 * uses, so the two screens can never disagree about the rate.
 */

import { useExchangeRate } from '@/hooks/useExchangeRate';
import { formatDateTimeWithTZ } from '@/utils/validation';
import { useT } from '../../i18n';

interface ReviewRequestProps {
  amount: string;
  tokenSymbol: string;
  /** e.g. "Base Mainnet" */
  networkLabel?: string;
  description: string;
  /** Unix seconds; ignored when isInstantPayment */
  payoutTimestamp: number;
  isInstantPayment: boolean;
  /** The back arrow. Omitted where the terms are not the reader's to edit (a merchant's checkout). */
  onEdit?: () => void;
  /** Heading; defaults to the seller's "Confirm Request Details". */
  title?: string;
  /** Rows after release and description, e.g. who is paid and the fee (/pay). */
  extraRows?: { label: string; value: string }[];
  /** The "What happens next?" text; defaults to the seller's. null leaves the box out. */
  nextBody?: string | null;
  /**
   * Tighter, for a screen where this is the summary and the thing to do comes after it. On the
   * pay screen the full-size card pushed every way of paying below the bottom of a laptop screen
   * (seen 2026-11-23 at 836px high): a buyer short of funds saw the amount and nothing to press.
   */
  compact?: boolean;
  /**
   * Lead with the money and put the token beneath it. For the person paying, who thinks of what
   * they owe in money: "100.0000 USDC" as the headline told a buyer with no crypto that this was
   * not for them, before the screen had offered them a card.
   */
  moneyFirst?: boolean;
}

export default function ReviewRequest({
  amount,
  tokenSymbol,
  networkLabel,
  description,
  payoutTimestamp,
  isInstantPayment,
  onEdit,
  title,
  extraRows = [],
  nextBody,
  compact = false,
  moneyFirst = false,
}: ReviewRequestProps) {
  const t = useT();
  const { rate } = useExchangeRate('USD', tokenSymbol);

  /*
   * For the person paying (moneyFirst), figures and dates as a person reads them. "99.000000 USDC"
   * and "2026-11-29T12:09:00+00:00" are exact and nobody's idea of an amount or a day.
   * Only zeros are dropped, and never below two decimals: 0.001234 stays 0.001234.
   */
  const tidy = (value: string) => (moneyFirst ? value.replace(/^(\d+\.\d{2}\d*?)0+(?=\s|$)/, '$1') : value);
  const releaseText = moneyFirst
    ? new Date(payoutTimestamp * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : formatDateTimeWithTZ(payoutTimestamp);

  const parsedAmount = parseFloat(amount || '0');
  const usdEquivalent = rate && rate > 0 ? parsedAmount / rate : parsedAmount;

  return (
    <div className="max-w-xl mx-auto">
      <div className={`flex items-center justify-center gap-3 ${compact ? 'mb-4' : 'mb-8'}`}>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('review.backAria')}
            className="text-secondary-500 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        )}
        <h2 className="text-2xl sm:text-3xl font-semibold text-secondary-900 dark:text-white">
          {title ?? t('review.title')}
        </h2>
      </div>

      <div className={`rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 ${compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}`}>
        <div className="text-center">
          {moneyFirst ? (
            <>
              <p className={`${compact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'} font-bold text-secondary-900 dark:text-white tracking-tight`}>
                ${usdEquivalent.toFixed(2)}{' '}
                <span className="text-secondary-400 dark:text-secondary-500 font-semibold">USD</span>
              </p>
              <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
                {tidy(parsedAmount ? parsedAmount.toFixed(4) : '0.0000')} {tokenSymbol}
                {networkLabel ? ` · ${networkLabel}` : ''}
              </p>
            </>
          ) : (
            <>
              <p className={`${compact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'} font-bold text-secondary-900 dark:text-white tracking-tight`}>
                {parsedAmount ? parsedAmount.toFixed(4) : '0.0000'}{' '}
                <span className="text-secondary-400 dark:text-secondary-500 font-semibold">{tokenSymbol}</span>
              </p>
              <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">
                {networkLabel ? `${networkLabel} = ` : ''}
                ${usdEquivalent.toFixed(2)} USD
              </p>
            </>
          )}
        </div>

        <div className={`border-t border-secondary-200 dark:border-secondary-700 ${compact ? 'mt-4 pt-4 space-y-2' : 'mt-7 pt-6 space-y-4'}`}>
          <div className="flex items-start justify-between gap-6">
            <span className="text-sm text-secondary-500 dark:text-secondary-400">{t('review.release')}</span>
            <span className="text-sm font-semibold text-secondary-900 dark:text-white text-right">
              {isInstantPayment
                ? t('pay.instantOnConfirm')
                : releaseText}
            </span>
          </div>
          <div className="flex items-start justify-between gap-6">
            <span className="text-sm text-secondary-500 dark:text-secondary-400">{t('review.description')}</span>
            <span className="text-sm font-semibold text-secondary-900 dark:text-white text-right break-words">
              {description}
            </span>
          </div>
          {extraRows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-6">
              <span className="text-sm text-secondary-500 dark:text-secondary-400">{row.label}</span>
              <span className="text-sm font-semibold text-secondary-900 dark:text-white text-right break-all">
                {tidy(row.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {nextBody !== null && (
        <div className="mt-5 rounded-2xl border-2 border-primary-500 bg-white dark:bg-secondary-900 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-secondary-900 dark:text-white">
            {t('review.next')}
          </h3>
          <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-300 leading-relaxed">
            {nextBody ?? t('review.nextBody')}
          </p>
        </div>
      )}
    </div>
  );
}
