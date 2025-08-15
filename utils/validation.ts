import { ethers } from 'ethers';

export function isValidWalletAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

export function isValidAmount(amount: string): boolean {
  try {
    const parsed = parseFloat(amount.trim());
    return !isNaN(parsed) && parsed > 0;
  } catch {
    return false;
  }
}

export function isValidExpiryTime(hours: number, minutes: number): boolean {
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= 1 && totalMinutes <= 525600; // 1 minute to 1 year
}

export function isValidDescription(description: string): boolean {
  return description.trim().length > 0 && description.length <= 160;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function formatWalletAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ===================================
// CURRENCY UTILITIES
// ===================================
// Centralized currency handling functions to ensure consistency across the app
// All functions intelligently handle both USDC and microUSDC formats

/**
 * Currency conversion and formatting utility that accepts any amount/currency combination
 * and always returns user-displayable USDC format
 * @param amount - Amount in either USDC or microUSDC (number or string)
 * @param currency - Currency tag: 'USDC', 'microUSDC', or any other string
 * @returns Object with formatted amount and normalized currency for display
 */
export function formatCurrency(amount: string | number, currency: string = 'microUSDC'): { 
  amount: string; 
  currency: 'USDC';
  numericAmount: number;
} {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
    return { amount: '0.0000', currency: 'USDC', numericAmount: 0 };
  }

  // Smart conversion logic:
  // If the currency says "USDC" but the amount looks like microUSDC (> 1000), 
  // treat it as microUSDC for backwards compatibility
  let usdcAmount: number;
  if (currency === 'microUSDC' || (currency === 'USDC' && numericAmount >= 1000)) {
    // Convert from microUSDC to USDC by dividing by 1,000,000
    usdcAmount = numericAmount / 1000000;
  } else {
    // Assume it's already in USDC format
    usdcAmount = numericAmount;
  }

  return {
    amount: usdcAmount.toFixed(4),
    currency: 'USDC',
    numericAmount: usdcAmount
  };
}

/**
 * Legacy formatUSDC function - maintained for backwards compatibility
 * @deprecated Use formatCurrency instead for explicit currency handling
 * @param amount - Amount in microUSDC format
 * @returns Formatted USDC string (e.g., "1.5000")
 */
export function formatUSDC(amount: string | number): string {
  return formatCurrency(amount, 'microUSDC').amount;
}

/**
 * Convert USDC amount to microUSDC for backend communication
 * @param amount - Amount in USDC (number or string)
 * @returns Amount in microUSDC format
 */
export function toMicroUSDC(amount: string | number): number {
  const usdcAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(usdcAmount)) {
    return 0;
  }
  return Math.round(usdcAmount * 1000000);
}

/**
 * Convert microUSDC amount to USDC for display
 * @param amount - Amount in microUSDC (number or string) 
 * @returns Amount in USDC format
 */
export function fromMicroUSDC(amount: string | number): number {
  const microUSDCAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(microUSDCAmount)) {
    return 0;
  }
  return microUSDCAmount / 1000000;
}

/**
 * Convert amount to USDC for Web3 operations (preserves precision, no formatting)
 * @param amount - Amount in any format
 * @param currency - Currency tag from backend
 * @returns USDC amount as string with original precision
 */
export function toUSDCForWeb3(amount: string | number, currency: string = 'microUSDC'): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
    return '0';
  }

  // Smart conversion logic (same as formatCurrency)
  let usdcAmount: number;
  if (currency === 'microUSDC' || (currency === 'USDC' && numericAmount >= 1000)) {
    // Convert from microUSDC to USDC by dividing by 1,000,000
    usdcAmount = numericAmount / 1000000;
  } else {
    // Assume it's already in USDC format
    usdcAmount = numericAmount;
  }

  // Return as string but preserve precision (no fixed decimal places)
  return usdcAmount.toString();
}

/**
 * Smart currency display formatter - handles any input and returns display-ready values
 * This is the recommended function to use throughout the app
 * @param amount - Amount in any format
 * @param currency - Currency tag from backend
 * @returns Display-ready formatted string with currency symbol
 */
export function displayCurrency(amount: string | number, currency: string = 'microUSDC'): string {
  const formatted = formatCurrency(amount, currency);
  return `$${formatted.amount}`;
}

// ===================================
// DATETIME UTILITIES
// ===================================
// Centralized datetime handling functions to ensure consistency across the app
// All functions intelligently handle both Unix seconds and milliseconds timestamps

/**
 * Normalizes timestamp to milliseconds, handling both seconds and milliseconds input
 * @param timestamp - Unix timestamp in seconds or milliseconds (number or string)
 * @returns Unix timestamp in milliseconds
 */
export function normalizeTimestamp(timestamp: number | string): number {
  // Convert to number if it's a string
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  if (isNaN(ts)) {
    throw new Error('Invalid timestamp provided');
  }
  // If it's 10 digits or less, it's in seconds - convert to milliseconds
  return ts.toString().length <= 10 ? ts * 1000 : ts;
}

/**
 * Formats timestamp as user-readable date and time with timezone
 * @param timestamp - Unix timestamp in seconds or milliseconds
 * @param options - Optional formatting options
 * @returns Formatted date string (e.g., "01-Jan-2024 14:30 GMT")
 */
export function formatDateTime(timestamp: number | string, options?: {
  includeTime?: boolean;
  includeTimezone?: boolean;
  dateStyle?: 'short' | 'medium' | 'long';
  timeStyle?: 'short' | 'medium';
}): string {
  const {
    includeTime = true,
    includeTimezone = true,
    dateStyle = 'medium',
    timeStyle = 'short'
  } = options || {};

  const date = new Date(normalizeTimestamp(timestamp));
  
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  // Get the user's timezone
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Build format options
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timeZone
  };

  // Date formatting
  if (dateStyle === 'short') {
    formatOptions.day = '2-digit';
    formatOptions.month = '2-digit';
    formatOptions.year = 'numeric';
  } else if (dateStyle === 'medium') {
    formatOptions.day = '2-digit';
    formatOptions.month = 'short';
    formatOptions.year = 'numeric';
  } else { // long
    formatOptions.day = 'numeric';
    formatOptions.month = 'long';
    formatOptions.year = 'numeric';
  }

  // Time formatting
  if (includeTime) {
    if (timeStyle === 'short') {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = false;
    } else { // medium
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      formatOptions.second = '2-digit';
      formatOptions.hour12 = false;
    }
  }
  
  let formattedDate = date.toLocaleDateString('en-GB', formatOptions);
  
  // Add timezone abbreviation if requested
  if (includeTime && includeTimezone) {
    const timeZoneAbbr = date.toLocaleTimeString('en-US', {
      timeZoneName: 'short',
      timeZone: timeZone
    }).split(' ').pop();
    
    formattedDate += ` ${timeZoneAbbr}`;
  }
  
  return formattedDate;
}

/**
 * Formats timestamp as date only (no time)
 * @param timestamp - Unix timestamp in seconds or milliseconds  
 * @param style - Date formatting style
 * @returns Formatted date string (e.g., "01-Jan-2024")
 */
export function formatDate(timestamp: number | string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  return formatDateTime(timestamp, { 
    includeTime: false, 
    includeTimezone: false,
    dateStyle: style 
  });
}

/**
 * MAIN DATETIME DISPLAY FUNCTION
 * Formats any Unix timestamp (seconds or milliseconds) to ISO string with timezone
 * This is THE function to use for displaying dates/times to users
 * @param timestamp - Unix timestamp in seconds or milliseconds
 * @returns ISO 8601 formatted string with timezone (e.g., "2024-01-15T14:30:00-05:00")
 */
export function formatDateTimeWithTZ(timestamp: number | string): string {
  try {
    const date = new Date(normalizeTimestamp(timestamp));
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Get timezone offset in minutes and convert to ±HH:MM format
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
    const minutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
    const tzOffset = `${sign}${hours}:${minutes}`;
    
    // Format as ISO string with local timezone
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${tzOffset}`;
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Formats timestamp for table/list display with date and time on separate lines
 * Uses the main formatDateTimeWithTZ function and splits the result
 * @param timestamp - Unix timestamp in seconds or milliseconds
 * @returns Object with formatted date and time strings with timezone
 */
export function formatTimestamp(timestamp: number | string): { date: string; time: string } {
  const isoString = formatDateTimeWithTZ(timestamp);
  
  if (isoString === 'Invalid date') {
    return { date: 'Invalid date', time: '' };
  }
  
  const date = new Date(normalizeTimestamp(timestamp));
  
  return {
    date: date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }),
    time: date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  };
}

/**
 * Formats remaining time until expiry
 * @param expiryTimestamp - Unix timestamp in seconds or milliseconds
 * @returns Human-readable time remaining (e.g., "2d 5h 30m" or "Expired")
 */
export function formatTimeRemaining(expiryTimestamp: number | string): string {
  const now = Date.now();
  const expiry = normalizeTimestamp(expiryTimestamp);
  const diff = expiry - now;

  if (diff <= 0) {
    return 'Expired';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Formats expiry date with full date, time and timezone (legacy compatibility)
 * @param expiryTimestamp - Unix timestamp in seconds or milliseconds
 * @returns Formatted expiry date string
 */
export function formatExpiryDate(expiryTimestamp: number | string): string {
  return formatDateTime(expiryTimestamp, { 
    includeTime: true, 
    includeTimezone: true,
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

/**
 * Check if a timestamp represents an expired date
 * @param timestamp - Unix timestamp in seconds or milliseconds
 * @returns true if the timestamp is in the past
 */
export function isExpired(timestamp: number | string): boolean {
  const normalized = normalizeTimestamp(timestamp);
  return Date.now() > normalized;
}

export type ContractCTAType = 
  | 'RAISE_DISPUTE' 
  | 'CLAIM_FUNDS' 
  | 'PENDING_RESOLUTION' 
  | 'MANAGE_DISPUTE'
  | 'RESOLVED' 
  | 'CLAIMED'
  | 'AWAITING_FUNDING'
  | 'ACCEPT_CONTRACT'
  | 'PENDING_ACCEPTANCE'
  | 'NONE';

export interface ContractCTAInfo {
  type: ContractCTAType;
  label?: string;
  variant?: 'action' | 'status' | 'none';
}

export function getContractCTA(
  contractStatus: string | undefined,
  isBuyer: boolean,
  isSeller: boolean,
  isPending?: boolean,
  isExpired?: boolean,
  contractState?: string
): ContractCTAInfo {
  // Handle pending contracts (not yet on chain)
  if (isPending) {
    // Buyer can accept if contract is not expired and state is OK
    if (isBuyer && !isExpired && contractState === 'OK') {
      return {
        type: 'ACCEPT_CONTRACT',
        label: 'Make Payment',
        variant: 'action'
      };
    }
    // Otherwise show pending status
    return {
      type: 'PENDING_ACCEPTANCE',
      label: 'Sent Request Email',
      variant: 'status'
    };
  }

  if (!contractStatus) {
    return { type: 'NONE', variant: 'none' };
  }

  // Handle CREATED status (on chain but not yet funded)
  if (contractStatus === 'CREATED') {
    return {
      type: 'AWAITING_FUNDING',
      label: 'Awaiting Funding',
      variant: 'status'
    };
  }

  if (contractStatus === 'ACTIVE' && isBuyer) {
    return { 
      type: 'RAISE_DISPUTE', 
      label: 'Raise Dispute',
      variant: 'action'
    };
  }

  if (contractStatus === 'EXPIRED' && isSeller) {
    return { 
      type: 'CLAIM_FUNDS', 
      label: 'Claim Funds',
      variant: 'action'
    };
  }

  if (contractStatus === 'DISPUTED') {
    return { 
      type: 'MANAGE_DISPUTE', 
      label: 'Manage Dispute',
      variant: 'action'
    };
  }

  if (contractStatus === 'RESOLVED') {
    return { 
      type: 'RESOLVED', 
      label: 'Resolved',
      variant: 'status'
    };
  }

  if (contractStatus === 'CLAIMED') {
    return { 
      type: 'CLAIMED', 
      label: 'Claimed',
      variant: 'status'
    };
  }

  return { type: 'NONE', variant: 'none' };
}