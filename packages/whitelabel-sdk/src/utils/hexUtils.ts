/**
 * Utility functions for handling hex values
 */

/**
 * Ensures a string has a '0x' prefix
 * @param value - String that may or may not have 0x prefix
 * @returns String with 0x prefix guaranteed
 */
export function ensureHexPrefix(value: string): string {
  if (!value) return '0x';
  if (value.startsWith('0x') || value.startsWith('0X')) {
    return value;
  }
  return `0x${value}`;
}

/**
 * Converts a number or bigint to hex string with 0x prefix
 * @param value - Number or BigInt to convert
 * @returns Hex string with 0x prefix
 */
export function toHex(value: number | bigint): string {
  return ensureHexPrefix(value.toString(16));
}

/**
 * Converts various types to hex string with 0x prefix
 * @param value - Value to convert (string, number, or bigint)
 * @returns Hex string with 0x prefix
 */
export function toHexString(value: string | number | bigint): string {
  if (typeof value === 'string') {
    return ensureHexPrefix(value);
  }
  return toHex(value);
}