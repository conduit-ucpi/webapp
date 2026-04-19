import { useState, useEffect } from 'react';
import { useExchangeRate, convertCurrency, formatCurrencyAmount } from '@/hooks/useExchangeRate';
import { detectUserCurrency, SUPPORTED_CURRENCIES, getCurrencyInfo } from '@/utils/currencyDetection';
import { formatDateTimeWithTZ } from '@/utils/validation';

interface CurrencyAmountInputProps {
  /** USDC/USDT amount (source of truth) */
  value: string;
  /** Callback when USDC/USDT amount changes */
  onChange: (value: string) => void;
  /** Token symbol (e.g., USDC, USDT, DAI) */
  tokenSymbol: string;
  /** Error message to display */
  error?: string;
  /** Disable all inputs */
  disabled?: boolean;
  /** Label for the field */
  label?: string;
  /** Help text below the field */
  helpText?: string;
  /** Label for the payment amount field (defaults to "Payment amount") */
  paymentLabel?: string;
}

export default function CurrencyAmountInput({
  value,
  onChange,
  tokenSymbol,
  error,
  disabled = false,
  label = 'Amount',
  helpText,
  paymentLabel = "Payment amount"
}: CurrencyAmountInputProps) {
  // Detect user's currency on mount
  const [localCurrency, setLocalCurrency] = useState<string>('USD');
  const [localAmount, setLocalAmount] = useState<string>('');
  const [lastEdited, setLastEdited] = useState<'local' | 'token'>('token');
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch exchange rate
  const { rate, isLoading: rateLoading, error: rateError, lastUpdated, source } = useExchangeRate(
    localCurrency,
    tokenSymbol
  );

  // Initialize local currency on mount
  useEffect(() => {
    const detected = detectUserCurrency();
    setLocalCurrency(detected);
    setIsInitialized(true);
  }, []);

  // Sync local amount when token amount changes externally
  useEffect(() => {
    if (!isInitialized || lastEdited === 'local') return;

    const tokenValue = parseFloat(value);
    if (!isNaN(tokenValue) && tokenValue > 0 && rate) {
      const converted = tokenValue / rate;
      setLocalAmount(formatCurrencyAmount(converted, localCurrency));
    } else {
      setLocalAmount('');
    }
  }, [value, rate, localCurrency, lastEdited, isInitialized]);

  // Handle local currency amount change
  const handleLocalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalAmount(newValue);
    setLastEdited('local');

    const parsed = parseFloat(newValue);
    if (!isNaN(parsed) && parsed >= 0 && rate) {
      const tokenValue = convertCurrency(parsed, rate);
      onChange(formatCurrencyAmount(tokenValue, tokenSymbol));
    } else if (newValue === '') {
      onChange('');
    }
  };

  // Handle token amount change
  const handleTokenAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setLastEdited('token');

    const parsed = parseFloat(newValue);
    if (!isNaN(parsed) && parsed >= 0 && rate) {
      const localValue = parsed / rate;
      setLocalAmount(formatCurrencyAmount(localValue, localCurrency));
    } else if (newValue === '') {
      setLocalAmount('');
    }
  };

  // Handle currency selection change
  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    setLocalCurrency(newCurrency);
    // Keep the token amount, recalculate local amount with new currency
    setLastEdited('token');
  };

  const currencyInfo = getCurrencyInfo(localCurrency);
  const rateUnavailable = !rateLoading && rate === null && localCurrency !== tokenSymbol;
  const showRateInfo = rate !== null && rate !== 1.0 && localCurrency !== tokenSymbol;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
          {label}
        </label>
      )}

      <div className={`
        border-2 rounded-lg p-3 sm:p-4 bg-white dark:bg-secondary-900 transition-colors
        ${error ? 'border-error-300 dark:border-error-500' : 'border-secondary-200 dark:border-secondary-700'}
        ${disabled ? 'opacity-50 cursor-not-allowed bg-secondary-50 dark:bg-secondary-800' : ''}
      `}>
        {/* Local Currency Input */}
        <div className="mb-1">
          <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-300 mb-1.5">
            Your currency (for reference):
          </label>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <select
              value={localCurrency}
              onChange={handleCurrencyChange}
              disabled={rateLoading}
              className="
                flex-shrink-0 w-20 sm:w-28 px-1 sm:px-2 py-2.5 text-xs sm:text-sm font-medium
                border border-secondary-300 dark:border-secondary-600 rounded-md
                bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} {currency.symbol}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={localAmount}
              onChange={handleLocalAmountChange}
              disabled={disabled || rateLoading || rateUnavailable}
              placeholder={rateUnavailable ? 'Rate unavailable' : '0.00'}
              readOnly={disabled || rateUnavailable}
              className={`
                flex-1 min-w-0 px-2 sm:px-3 py-2.5 text-base
                border border-secondary-300 dark:border-secondary-600 rounded-md
                bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white placeholder:text-secondary-400 dark:placeholder:text-secondary-500
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-secondary-50 dark:disabled:bg-secondary-800
                ${lastEdited === 'local' ? 'ring-2 ring-primary-200 border-primary-300 dark:ring-primary-700 dark:border-primary-500' : ''}
              `}
            />
          </div>
        </div>

        {/* Conversion Rate */}
        {showRateInfo && (
          <div className="py-2 px-2">
            <div className="flex flex-col items-center gap-1">
              {/* Rate */}
              <div className="flex items-center gap-2 text-xs text-secondary-600 dark:text-secondary-300">
                <svg className="w-4 h-4 text-secondary-400 dark:text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="font-medium">
                  1 {localCurrency} = {rate?.toFixed(6)} {tokenSymbol}
                </span>
                {rateLoading && (
                  <span className="inline-block w-3 h-3 border-2 border-secondary-300 dark:border-secondary-600 border-t-primary-500 rounded-full animate-spin" />
                )}
              </div>
              {/* Date - Always visible */}
              {!rateLoading && lastUpdated && (
                <div className="text-xs text-secondary-500 dark:text-secondary-400">
                  {source} • {formatDateTimeWithTZ(Math.floor(lastUpdated.getTime() / 1000))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Token Amount Input */}
        <div className="mt-1">
          <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-300 mb-1.5">
            {paymentLabel}:
          </label>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <input
              type="number"
              step="0.0001"
              min="0"
              value={value}
              onChange={handleTokenAmountChange}
              disabled={disabled}
              placeholder="0.00"
              className={`
                flex-1 min-w-0 px-2 sm:px-3 py-2.5 text-base font-medium
                border border-secondary-300 dark:border-secondary-600 rounded-md
                bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white placeholder:text-secondary-400 dark:placeholder:text-secondary-500
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-secondary-50 dark:disabled:bg-secondary-800
                ${lastEdited === 'token' ? 'ring-2 ring-primary-200 border-primary-300 dark:ring-primary-700 dark:border-primary-500' : ''}
              `}
            />
            <span className="flex-shrink-0 px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-semibold text-secondary-700 dark:text-secondary-200 bg-secondary-100 dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-md whitespace-nowrap">
              {tokenSymbol}
            </span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-2 text-sm text-error-600 dark:text-error-400">{error}</p>
      )}

      {/* Rate Error Message */}
      {rateError && (
        <p className="mt-2 text-xs text-warning-600 dark:text-warning-400">
          Exchange rate unavailable for {tokenSymbol}. Enter the {tokenSymbol} amount directly.
        </p>
      )}

      {/* Help Text */}
      {helpText && !error && (
        <p className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">{helpText}</p>
      )}
    </div>
  );
}
