/**
 * Payout date / time picker.
 *
 * Extracted from CreateContractWizard so the wizard and the redesigned
 * "Payment Terms" screen share one implementation. The behaviour here is
 * fiddlier than it looks and must not be duplicated:
 *
 *  - the <input type="datetime-local"> works in the BROWSER's local timezone,
 *    while the contract stores a unix timestamp, so every read/write goes
 *    through timestampToDatetimeLocal / datetimeLocalToTimestamp
 *  - the user is told which timezone they are picking in, because "3pm" means
 *    different things to buyer and seller
 *  - min/max clamp the choice to the allowed contract window
 *  - the relative time ("in 3 days") is shown back as confirmation, since a
 *    mis-set month or year is otherwise easy to miss
 *
 * Optionally it also offers "Instantly", which is not a date at all: it maps to
 * EXPIRY_TIMESTAMP == 0, the sentinel EscrowContract reads as an instant
 * transfer. On that path the deposit pays the seller in the same transaction
 * and raiseDispute reverts, so it is a plain payment rather than an escrow —
 * which is why the choice is presented as a mode switch with its own
 * explanation, not as a shortcut button that fills the date in.
 */

import {
  timestampToDatetimeLocal,
  datetimeLocalToTimestamp,
  getCurrentLocalDatetime,
  getMaxLocalDatetime,
  getRelativeTime,
} from '@/utils/validation';
import { useT } from '../../i18n';

/**
 * Short name of the browser's current timezone, e.g. "GMT", "PDT".
 * Derived from a formatted time rather than Intl.timeZone so the user sees the
 * same abbreviation their OS clock shows.
 */
export function getUserTimezone(): string {
  const date = new Date();
  const timeString = date.toLocaleTimeString('en-US', { timeZoneName: 'short' });
  const parts = timeString.split(' ');
  return parts[parts.length - 1];
}

interface ReleaseDateFieldProps {
  /** Payout time as a unix timestamp (seconds) */
  value: number;
  onChange: (timestamp: number) => void;
  error?: string;
  label?: string;
  className?: string;
  /**
   * Release immediately on payment rather than at a date. Only rendered as a
   * choice when onInstantChange is supplied — callers that have no way to
   * submit a zero expiry must not offer it.
   */
  instant?: boolean;
  onInstantChange?: (instant: boolean) => void;
}

export default function ReleaseDateField({
  value,
  onChange,
  error,
  label,
  className = '',
  instant = false,
  onInstantChange,
}: ReleaseDateFieldProps) {
  const t = useT();

  const tabClass = (selected: boolean) =>
    [
      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      selected
        ? 'bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm'
        : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-white',
    ].join(' ');

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
        {label ?? t('release.label')}
        {!instant && (
          <span className="ml-2 text-xs font-normal text-secondary-500 dark:text-secondary-400">
            {t('release.timezone', { tz: getUserTimezone() })}
          </span>
        )}
      </label>

      {onInstantChange && (
        <div
          role="radiogroup"
          aria-label={label ?? t('release.label')}
          className="mb-3 flex gap-1 rounded-lg bg-secondary-100 dark:bg-secondary-800 p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!instant}
            onClick={() => onInstantChange(false)}
            className={tabClass(!instant)}
          >
            {t('release.onDate')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={instant}
            onClick={() => onInstantChange(true)}
            className={tabClass(instant)}
          >
            {t('release.instant')}
          </button>
        </div>
      )}

      {instant ? (
        // No date input at all: an instant transfer has no payout time to pick.
        // The warning is not decoration — losing the dispute window is the whole
        // trade, and it is the one thing the seller cannot undo afterwards.
        <div className="rounded-lg border border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 px-4 py-3">
          <p className="text-sm font-medium text-warning-600 dark:text-warning-500">
            {t('release.instantSummary')}
          </p>
          <p className="mt-1 text-xs text-warning-600/90 dark:text-warning-500/90 leading-relaxed">
            {t('release.instantNote')}
          </p>
        </div>
      ) : (
        <>
          <input
            type="datetime-local"
            className="w-full border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={timestampToDatetimeLocal(value)}
            onChange={(e) => onChange(datetimeLocalToTimestamp(e.target.value))}
            min={getCurrentLocalDatetime()}
            max={getMaxLocalDatetime()}
          />
          {error && <p className="text-sm text-error-600 dark:text-error-400 mt-1">{error}</p>}
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-secondary-500 dark:text-secondary-400">
              {t('release.auto')}
            </p>
            {value && !error && (
              <p className="text-xs font-medium text-primary-600 dark:text-primary-400">
                {getRelativeTime(value)}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
