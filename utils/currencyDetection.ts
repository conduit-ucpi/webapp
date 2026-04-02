/**
 * Common currencies with their symbols and names
 */
export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  countries: string[]; // For display purposes
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', countries: ['US', 'EC', 'SV', 'PA'] },
  { code: 'EUR', symbol: '€', name: 'Euro', countries: ['AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'] },
  { code: 'GBP', symbol: '£', name: 'British Pound', countries: ['GB'] },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', countries: ['JP'] },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', countries: ['CA'] },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', countries: ['AU'] },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', countries: ['CH'] },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', countries: ['CN'] },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', countries: ['HK'] },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', countries: ['SG'] },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', countries: ['IN'] },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', countries: ['MX'] },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', countries: ['BR'] },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', countries: ['AE'] },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', countries: ['SA'] },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', countries: ['KR'] },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', countries: ['ZA'] },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', countries: ['NZ'] },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', countries: ['SE'] },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', countries: ['NO'] },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', countries: ['DK'] },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', countries: ['PL'] },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', countries: ['TH'] },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', countries: ['ID'] },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', countries: ['MY'] },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', countries: ['PH'] },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', countries: ['TW'] },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', countries: ['VN'] },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', countries: ['IL'] },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', countries: ['TR'] },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', countries: ['RU'] },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', countries: ['CZ'] },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', countries: ['HU'] },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', countries: ['CL'] },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', countries: ['AR'] },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', countries: ['CO'] },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', countries: ['NG'] },
];

/**
 * Map of country codes to currency codes
 */
const COUNTRY_TO_CURRENCY: { [key: string]: string } = {};
SUPPORTED_CURRENCIES.forEach(currency => {
  currency.countries.forEach(country => {
    COUNTRY_TO_CURRENCY[country] = currency.code;
  });
});

/**
 * Detect user's currency based on browser locale
 */
export function detectUserCurrency(): string {
  if (typeof navigator === 'undefined') {
    console.log('💱 Navigator not available, defaulting to USD');
    return 'USD';
  }

  try {
    const locale = navigator.language || (navigator as any).userLanguage || 'en-US';
    console.log(`💱 Browser locale: ${locale}`);

    // Extract country code from locale
    // Locales can be: en-NZ, en_NZ, en-US, fr-FR, etc.
    const match = locale.match(/[-_]([A-Z]{2})$/i);

    if (match) {
      const countryCode = match[1].toUpperCase();
      const currency = COUNTRY_TO_CURRENCY[countryCode];

      if (currency) {
        console.log(`💱 ✅ Detected currency from locale: ${currency} (country: ${countryCode}, locale: ${locale})`);
        return currency;
      } else {
        console.log(`💱 ⚠️ Country code ${countryCode} found but no currency mapping`);
      }
    } else {
      console.log(`💱 ⚠️ Could not extract country code from locale: ${locale}`);
    }
  } catch (error) {
    console.error('💱 ❌ Currency detection error:', error);
  }

  // Default to USD if detection fails
  console.log('💱 Defaulting to USD');
  return 'USD';
}

/**
 * Get currency info by code
 */
export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code);
}

/**
 * Format currency code for display (e.g., "EUR - Euro (€)")
 */
export function formatCurrencyOption(code: string): string {
  const info = getCurrencyInfo(code);
  if (!info) return code;
  return `${info.code} - ${info.name} (${info.symbol})`;
}

/**
 * Get list of currency codes sorted by popularity
 */
export function getPopularCurrencies(): string[] {
  return [
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF',
    'CNY', 'HKD', 'SGD', 'INR', 'MXN', 'BRL'
  ];
}
