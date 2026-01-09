/**
 * Ethereum address utilities and formatting
 * Handles wallet address validation, formatting, and display
 */

import { ethers } from 'ethers';

/**
 * Validate Ethereum wallet address using ethers
 */
export function isValidWalletAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Format wallet address for display (truncated with ellipsis)
 */
export function formatWalletAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Ensure address has 0x prefix (legacy compatibility)
 * Handles address-specific cases differently from general hex utilities
 */
export function ensureAddressPrefix(address: string): string {
  if (address === null || address === undefined) return address;
  if (address === '') return '';
  if (address.startsWith('0X')) {
    return `0x${address.slice(2)}`;
  }
  if (address.startsWith('0x')) {
    return address;
  }
  return `0x${address}`;
}

/**
 * Compare two wallet addresses for equality (case-insensitive)
 * Returns true if addresses are the same, accounting for case differences
 */
export function addressesEqual(address1: string | undefined | null, address2: string | undefined | null): boolean {
  if (!address1 || !address2) return false;

  // Normalize both addresses to lowercase for comparison
  const normalized1 = address1.trim().toLowerCase();
  const normalized2 = address2.trim().toLowerCase();

  return normalized1 === normalized2;
}

/**
 * Compare two email addresses for equality (case-insensitive)
 * Returns true if emails are the same, accounting for case differences
 */
export function emailsEqual(email1: string | undefined | null, email2: string | undefined | null): boolean {
  if (!email1 || !email2) return false;

  // Normalize both emails to lowercase for comparison
  const normalized1 = email1.trim().toLowerCase();
  const normalized2 = email2.trim().toLowerCase();

  return normalized1 === normalized2;
}