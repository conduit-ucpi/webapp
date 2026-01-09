/**
 * Validation utilities - Re-exports from focused modules
 * This file maintains backward compatibility while using separated concerns
 */

// Re-export validators
export {
  isValidAmount,
  isValidExpiryTime,
  isValidDescription,
  isValidEmail,
  isValidFarcasterHandle,
  isValidBuyerIdentifier
} from './validators';

// Re-export address utilities
export {
  isValidWalletAddress,
  formatWalletAddress,
  ensureAddressPrefix,
  addressesEqual,
  emailsEqual
} from './address';

// Re-export currency utilities
export {
  formatCurrency,
  formatUSDC,
  toMicroUSDC,
  fromMicroUSDC,
  toUSDCForWeb3,
  displayCurrency
} from './currency';

// Re-export datetime utilities
export {
  normalizeTimestamp,
  formatDateTime,
  formatDate,
  formatDateTimeWithTZ,
  formatTimestamp,
  formatTimeRemaining,
  formatExpiryDate,
  getDefaultTimestamp,
  getCurrentLocalDatetime,
  getMaxLocalDatetime,
  getRelativeTime,
  isExpired,
  timestampToDatetimeLocal,
  datetimeLocalToTimestamp
} from './datetime';