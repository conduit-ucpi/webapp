/**
 * Date and time utilities for timestamps and formatting
 * Handles Unix timestamps, datetime-local conversions, and user-friendly displays
 */

/**
 * Normalize timestamp to milliseconds (handles both seconds and milliseconds)
 */
export function normalizeTimestamp(timestamp: number | string): number {
  const num = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;

  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid timestamp provided');
  }

  // If timestamp is in seconds (Unix timestamp), convert to milliseconds
  // Unix timestamps are typically 10 digits, milliseconds are 13 digits
  if (num.toString().length <= 10) {
    return num * 1000;
  }

  return num;
}

/**
 * Format timestamp with extensive customization options
 */
export function formatDateTime(timestamp: number | string, options?: {
  includeTime?: boolean;
  includeSeconds?: boolean;
  includeTimezone?: boolean;
  dateStyle?: 'short' | 'medium' | 'long' | 'full';
  timeStyle?: 'short' | 'medium' | 'long' | 'full';
  separator?: string;
  timezone?: string;
}): string {
  try {
    const normalized = normalizeTimestamp(timestamp);
    const date = new Date(normalized);

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const {
      includeTime = true,
      includeSeconds = false,
      includeTimezone = false,
      dateStyle = 'medium',
      timeStyle = 'short',
      separator = ' ',
      timezone = undefined
    } = options || {};

    const dateOptions: Intl.DateTimeFormatOptions = {
      dateStyle,
      timeZone: timezone
    };

    const timeOptions: Intl.DateTimeFormatOptions = {
      timeStyle: includeSeconds ? 'medium' : timeStyle,
      timeZone: timezone
    };

    if (includeTimezone) {
      timeOptions.timeZoneName = 'short';
    }

    const datePart = date.toLocaleDateString('en-US', dateOptions);

    if (!includeTime) {
      return datePart;
    }

    const timePart = date.toLocaleTimeString('en-US', timeOptions);

    return `${datePart}${separator}${timePart}`;
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format date only (no time)
 */
export function formatDate(timestamp: number | string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  return formatDateTime(timestamp, {
    includeTime: false,
    dateStyle: style
  });
}

/**
 * Format date and time with timezone (primary user display function)
 * Returns ISO-style format with timezone: "2024-01-15T14:30:00-05:00"
 */
export function formatDateTimeWithTZ(timestamp: number | string): string {
  try {
    const normalized = normalizeTimestamp(timestamp);
    const date = new Date(normalized);

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    // Get timezone offset in minutes and convert to hours/minutes format
    const timezoneOffset = date.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
    const offsetMinutes = Math.abs(timezoneOffset) % 60;
    const offsetSign = timezoneOffset <= 0 ? '+' : '-';
    const timezoneString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;

    // Format as ISO string but replace 'Z' with actual timezone offset
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${timezoneString}`;
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Split timestamp into separate date and time components
 * Returns formatted date and time for display
 */
export function formatTimestamp(timestamp: number | string): { date: string; time: string } {
  try {
    const normalized = normalizeTimestamp(timestamp);
    const date = new Date(normalized);

    if (isNaN(date.getTime())) {
      return { date: 'Invalid date', time: '' };
    }

    // Format date as "Jan 1, 2024"
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const formattedDate = `${month} ${day}, ${year}`;

    // Format time as "19:00 EST" (with timezone abbreviation)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    // Get timezone abbreviation
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZoneName = date.toLocaleDateString('en-US', {
      timeZoneName: 'short'
    }).split(', ')[1] || 'GMT';

    const formattedTime = `${hours}:${minutes} ${timeZoneName}`;

    return {
      date: formattedDate,
      time: formattedTime
    };
  } catch (error) {
    return { date: 'Invalid date', time: '' };
  }
}

/**
 * Format time remaining until expiry (human readable)
 */
export function formatTimeRemaining(expiryTimestamp: number | string): string {
  try {
    const now = Date.now();
    const expiry = normalizeTimestamp(expiryTimestamp);
    const diffMs = expiry - now;

    if (diffMs <= 0) {
      return 'Expired';
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      const remainingMinutes = diffMinutes % 60;
      return `${diffDays}d ${remainingHours}h ${remainingMinutes}m`;
    } else if (diffHours > 0) {
      const remainingMinutes = diffMinutes % 60;
      return `${diffHours}h ${remainingMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format expiry date with full date, time and timezone (legacy compatibility)
 */
export function formatExpiryDate(expiryTimestamp: number | string): string {
  try {
    const normalized = normalizeTimestamp(expiryTimestamp);
    const date = new Date(normalized);

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    // Format to match expected test pattern: "15 Jan 2025, 14:30"
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch (error) {
    return 'Invalid date';
  }
}

// Date utility functions for forms
export function getDefaultTimestamp(): number {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return Math.floor(tomorrow.getTime() / 1000);
}

export function getCurrentLocalDatetime(): string {
  const now = Math.floor(Date.now() / 1000);
  return timestampToDatetimeLocal(now);
}

export function getMaxLocalDatetime(): string {
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  return timestampToDatetimeLocal(Math.floor(oneYearFromNow.getTime() / 1000));
}

// Calculate relative time from now using Unix timestamp
export function getRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSeconds = timestamp - now;

  if (diffSeconds <= 0) return 'in the past';

  const diffMins = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffSeconds / 3600);
  const diffDays = Math.floor(diffSeconds / 86400);

  if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `in ${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`;

  const diffMonths = Math.floor(diffDays / 30);
  return `in ${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
}

/**
 * Check if a timestamp represents an expired date
 */
export function isExpired(timestamp: number | string): boolean {
  const normalized = normalizeTimestamp(timestamp);
  return Date.now() > normalized;
}

/**
 * Convert Unix timestamp (seconds) to datetime-local input format
 */
export function timestampToDatetimeLocal(timestamp: number): string {
  try {
    // Convert seconds to milliseconds for Date constructor
    const date = new Date(timestamp * 1000);

    // Format for datetime-local input: YYYY-MM-DDTHH:MM
    // Even if invalid, return the computed values (may contain NaN)
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error converting timestamp to datetime-local:', error);
    return '';
  }
}

/**
 * Convert datetime-local input format to Unix timestamp (seconds)
 */
export function datetimeLocalToTimestamp(datetimeLocal: string): number {
  try {
    if (!datetimeLocal || datetimeLocal.trim() === '') {
      return NaN;
    }

    const date = new Date(datetimeLocal);

    if (isNaN(date.getTime())) {
      return NaN;
    }

    // Convert milliseconds to seconds for Unix timestamp
    return Math.floor(date.getTime() / 1000);
  } catch (error) {
    console.error('Error converting datetime-local to timestamp:', error);
    return NaN;
  }
}