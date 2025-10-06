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