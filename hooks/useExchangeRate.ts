import { useState, useEffect, useCallback } from 'react';

interface ExchangeRateData {
  rate: number;
  lastUpdated: Date;
  source: string;
}

interface ExchangeRateCache {
  [key: string]: {
    rate: number;
    timestamp: number;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache: ExchangeRateCache = {};

/**
 * Fetches exchange rate from Coinbase API
 * @param fromCurrency - Currency to convert from (e.g., 'EUR', 'GBP')
 * @param toCurrency - Currency to convert to ('USDC' or 'USDT')
 * @returns Exchange rate (how much toCurrency you get for 1 fromCurrency)
 */
async function fetchExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const cacheKey = `${fromCurrency}-${toCurrency}`;
  const now = Date.now();

  // Check cache first
  if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_DURATION) {
    console.log(`💱 Using cached rate for ${cacheKey}:`, cache[cacheKey].rate);
    return cache[cacheKey].rate;
  }

  try {
    // Use configurable API URL with Coinbase as default
    const exchangeRateApiUrl = process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_URL ||
      'https://api.coinbase.com/v2/exchange-rates';

    console.log(`💱 Fetching exchange rate from ${exchangeRateApiUrl}: ${fromCurrency} → ${toCurrency}`);

    // Fetch rates from exchange rate API (base currency = USDC or USDT)
    const response = await fetch(
      `${exchangeRateApiUrl}?currency=${toCurrency}`
    );

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    const data = await response.json();

    // Coinbase returns rates as "1 USDC = X fromCurrency"
    // We need "1 fromCurrency = Y USDC", so we invert
    const inverseRate = parseFloat(data.data.rates[fromCurrency]);

    if (!inverseRate || isNaN(inverseRate)) {
      throw new Error(`Rate not available for ${fromCurrency}`);
    }

    // Convert to the rate we need (fromCurrency → toCurrency)
    const rate = 1 / inverseRate;

    // Cache the result
    cache[cacheKey] = {
      rate,
      timestamp: now
    };

    console.log(`💱 Fetched rate: 1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency}`);
    return rate;
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);

    // Fallback to approximate parity for USD
    if (fromCurrency === 'USD') {
      return 1.0;
    }

    throw error;
  }
}

/**
 * Hook to manage exchange rates with auto-refresh
 */
export function useExchangeRate(
  fromCurrency: string,
  toCurrency: 'USDC' | 'USDT'
) {
  const [rateData, setRateData] = useState<ExchangeRateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRate = useCallback(async () => {
    if (!fromCurrency || fromCurrency === toCurrency) {
      // Same currency, rate is 1:1
      setRateData({
        rate: 1.0,
        lastUpdated: new Date(),
        source: 'Same currency'
      });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const rate = await fetchExchangeRate(fromCurrency, toCurrency);

      setRateData({
        rate,
        lastUpdated: new Date(),
        source: 'Coinbase'
      });
    } catch (err: any) {
      console.error('Exchange rate error:', err);
      setError(err.message || 'Failed to fetch exchange rate');

      // Set fallback rate for USD
      if (fromCurrency === 'USD') {
        setRateData({
          rate: 1.0,
          lastUpdated: new Date(),
          source: 'Fallback'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [fromCurrency, toCurrency]);

  // Load rate on mount and when currencies change
  useEffect(() => {
    loadRate();
  }, [loadRate]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('💱 Auto-refreshing exchange rate...');
      loadRate();
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, [loadRate]);

  return {
    rate: rateData?.rate || 1.0,
    isLoading,
    error,
    lastUpdated: rateData?.lastUpdated,
    source: rateData?.source,
    refresh: loadRate
  };
}

/**
 * Convert amount from one currency to another using the exchange rate
 */
export function convertCurrency(
  amount: number,
  rate: number
): number {
  if (isNaN(amount) || isNaN(rate)) {
    return 0;
  }
  return amount * rate;
}

/**
 * Format amount for display with appropriate decimal places
 */
export function formatCurrencyAmount(amount: number, currency: string): string {
  if (isNaN(amount)) {
    return '0.00';
  }

  // Crypto currencies get 2-4 decimal places
  if (currency === 'USDC' || currency === 'USDT') {
    return amount.toFixed(4);
  }

  // Fiat currencies get 2 decimal places
  return amount.toFixed(2);
}
