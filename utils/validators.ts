/**
 * Input validation utilities
 * Pure validation functions for forms and user input
 */

/**
 * Validate amount string (must be positive number)
 */
export function isValidAmount(amount: string): boolean {
  try {
    const parsed = parseFloat(amount.trim());
    return !isNaN(parsed) && parsed > 0;
  } catch {
    return false;
  }
}

/**
 * Validate expiry time in hours and minutes
 */
export function isValidExpiryTime(hours: number, minutes: number): boolean {
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= 1 && totalMinutes <= 525600; // 1 minute to 1 year
}

/**
 * Validate description (1-160 characters)
 */
export function isValidDescription(description: string): boolean {
  return description.trim().length > 0 && description.length <= 160;
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate Farcaster handle format
 */
export function isValidFarcasterHandle(handle: string): boolean {
  // Supports two formats:
  // 1. @username (alphanumeric, underscores, hyphens)
  // 2. {fid}@farcaster.xyz (numeric FID format)
  const handleRegex = /^@[a-zA-Z0-9_-]+$/;
  const fidEmailRegex = /^\d+@farcaster\.xyz$/;
  const trimmed = handle.trim();
  return handleRegex.test(trimmed) || fidEmailRegex.test(trimmed);
}

/**
 * Validate buyer identifier (email or Farcaster handle)
 */
export function isValidBuyerIdentifier(identifier: string): {
  isValid: boolean;
  type: 'email' | 'farcaster' | null;
  error?: string;
} {
  const trimmed = identifier.trim();

  if (!trimmed) {
    return {
      isValid: false,
      type: null,
      error: 'Buyer identifier is required'
    };
  }

  // Check if it's a Farcaster handle (starts with @ or is FID format)
  if (trimmed.startsWith('@') || /^\d+@farcaster\.xyz$/.test(trimmed)) {
    if (isValidFarcasterHandle(trimmed)) {
      return {
        isValid: true,
        type: 'farcaster'
      };
    } else {
      return {
        isValid: false,
        type: null,
        error: 'Invalid Farcaster handle format. Use @username or fid@farcaster.xyz'
      };
    }
  }

  // Otherwise, validate as email
  if (isValidEmail(trimmed)) {
    return {
      isValid: true,
      type: 'email'
    };
  } else {
    return {
      isValid: false,
      type: null,
      error: 'Invalid email format'
    };
  }
}