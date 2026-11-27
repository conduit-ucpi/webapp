/**
 * Currency formatting and conversion utilities
 * Handles USDC, microUSDC conversions and display formatting
 */

/**
 * Formats currency amounts for display
 * Handles both USDC and microUSDC inputs based on currency parameter
 * - If currency='microUSDC': divides by 1,000,000 to convert to USDC for display
 * - If currency='USDC': uses the amount as-is (already in USDC)
 */
export function formatCurrency(amount: string | number, currency: string = 'microUSDC'): {
  amount: string;
  currency: string;
  displayValue: string;
  numericAmount: number;
} {
  try {
    let numericAmount: number;

    if (typeof amount === 'string') {
      numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) {
        return { amount: '0.0000', currency: 'USDC', displayValue: '0.0000 USDC', numericAmount: 0 };
      }
    } else {
      numericAmount = amount;
    }

    let displayAmount: number;

    if (currency === 'microUSDC') {
      // Convert microUSDC to USDC (divide by 1,000,000)
      displayAmount = numericAmount / 1000000;
    } else if (currency === 'USDC') {
      // Amount is already in USDC
      displayAmount = numericAmount;
    } else {
      // Default to treating as microUSDC for unknown currencies
      displayAmount = numericAmount / 1000000;
    }

    const displayCurrency = 'USDC';

    // Format to 4 decimal places
    const formattedAmount = displayAmount.toFixed(4);
    const displayValue = `${formattedAmount} ${displayCurrency}`;

    return {
      amount: formattedAmount,
      currency: displayCurrency,
      displayValue,
      numericAmount: displayAmount
    };
  } catch (error) {
    return { amount: '0.0000', currency: 'USDC', displayValue: '0.0000 USDC', numericAmount: 0 };
  }
}

/**
 * Format USDC amount for display (legacy compatibility)
 */
export function formatUSDC(amount: string | number): string {
  const result = formatCurrency(amount, 'microUSDC');
  return result.amount;
}

/**
 * Convert USDC amount to microUSDC (multiply by 1,000,000)
 */
export function toMicroUSDC(amount: string | number): number {
  try {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 0;

    // Multiply by 1,000,000 to convert USDC to microUSDC
    // Use Math.round to handle floating point precision issues
    return Math.round(numericAmount * 1000000);
  } catch {
    return 0;
  }
}

/**
 * Convert microUSDC amount to USDC (divide by 1,000,000)
 */
export function fromMicroUSDC(amount: string | number): number {
  try {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return 0;

    // Divide by 1,000,000 to convert microUSDC to USDC
    return numericAmount / 1000000;
  } catch {
    return 0;
  }
}

/**
 * Convert currency amounts to proper format for Web3 transactions
 */
export function toUSDCForWeb3(amount: string | number, currency: string = 'microUSDC'): string {
  try {
    let numericAmount: number;

    if (typeof amount === 'string') {
      numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) return '0';
    } else {
      numericAmount = amount;
      if (isNaN(numericAmount)) return '0';
    }

    if (currency === 'microUSDC') {
      // Convert microUSDC to USDC decimal string for Web3
      const usdcAmount = numericAmount / 1000000;
      return usdcAmount.toString();
    } else if (currency === 'USDC') {
      // Amount is already in USDC
      return numericAmount.toString();
    } else {
      // Default to treating as microUSDC for unknown currencies
      const usdcAmount = numericAmount / 1000000;
      return usdcAmount.toString();
    }
  } catch {
    return '0';
  }
}

/**
 * The token a contract is in, for showing beside its amount: "USDT".
 *
 * From the record's own symbol; failing that, from its `currency` ("microUSDT"); failing that,
 * USDC, which is what every record written before there was a second token was in.
 *
 * ⚠️ THE CONTRACT'S TOKEN, NOT THE SITE'S. The dashboard and the detail window used to show the
 *    site's default token (or none), so a USDT payment looked like a USDC one.
 */
export function contractTokenSymbol(contract: { currencySymbol?: string | null; currency?: string | null }): string {
  const symbol = contract.currencySymbol?.trim();
  if (symbol && /^[A-Za-z][A-Za-z0-9]{1,9}$/.test(symbol)) return symbol;
  const fromCurrency = contract.currency?.trim().replace(/^micro/i, '') ?? '';
  // "USD" is how old records wrote dollars, not a token.
  if (/^[A-Za-z][A-Za-z0-9]{1,9}$/.test(fromCurrency) && fromCurrency.toUpperCase() !== 'USD') return fromCurrency;
  return 'USDC';
}

/**
 * Display currency with proper formatting (primary display function)
 */
export function displayCurrency(amount: string | number, currency: string = 'microUSDC'): string {
  const result = formatCurrency(amount, currency);
  return `$${result.amount}`;
}