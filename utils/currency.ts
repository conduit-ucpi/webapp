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
 * Display currency with proper formatting (primary display function)
 */
export function displayCurrency(amount: string | number, currency: string = 'microUSDC'): string {
  const result = formatCurrency(amount, currency);
  return `$${result.amount}`;
}

/**
 * The same amount, but never rounded into a different number.
 *
 * ⚠️ FOUR DECIMALS IS NOT ENOUGH FOR A RESERVE. USDC carries six, and a holdback is a small
 *    fraction of an already small payment: a 95-microUSDC reserve on a 1000-microUSDC payment is
 *    0.000095, which `displayCurrency` prints as "$0.0001" — rounded UP, and reading like a round
 *    figure rather than a fraction. Beside a payment shown as "$0.0010" it looks like most of the
 *    payment rather than a tenth of it, which is exactly the wrong impression: the supplier was
 *    paid the rest at the sale and only this remainder is outstanding.
 *
 *    Kept as a separate function rather than changing `displayCurrency`, whose 4-decimal output
 *    is asserted across the test suite and relied on for column alignment.
 */
export function displayCurrencyPrecise(amount: string | number, currency: string = 'microUSDC'): string {
  const result = formatCurrency(amount, currency);
  const exact = result.numericAmount;
  if (!Number.isFinite(exact)) return `$${result.amount}`;
  // Six decimals is USDC's real precision; trim trailing zeros but keep at least two so
  // ordinary amounts still read as money.
  let text = exact.toFixed(6).replace(/(\.\d{2}\d*?)0+$/, '$1');
  if (text.endsWith('.')) text = `${text}00`;
  return `$${text}`;
}