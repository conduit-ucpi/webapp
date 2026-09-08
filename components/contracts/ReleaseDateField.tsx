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
 */

import {
  timestampToDatetimeLocal,
  datetimeLocalToTimestamp,
  getCurrentLocalDatetime,
  getMaxLocalDatetime,
  getRelativeTime,
} from '@/utils/validation';

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
}

export default function ReleaseDateField({
  value,
  onChange,
  error,
  label = 'When should funds be released?',
  className = '',
}: ReleaseDateFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
        {label}
        <span className="ml-2 text-xs font-normal text-secondary-500 dark:text-secondary-400">
          (Your timezone: {getUserTimezone()})
        </span>
      </label>
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
          Funds will be released automatically at this time
        </p>
        {value && !error && (
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400">
            {getRelativeTime(value)}
          </p>
        )}
      </div>
    </div>
  );
}
