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
    const parsed = parseFloat(amount);
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

export function formatUSDC(amount: string | number): string {
  // USDC amounts come from chain in microUSDC (6 decimals)
  // Convert from microUSDC to USDC by dividing by 1,000,000
  const microUSDC = typeof amount === 'string' ? parseFloat(amount) : amount;
  const usdc = microUSDC / 1000000;
  return usdc.toFixed(2);
}

export function formatTimeRemaining(expiryTimestamp: number): string {
  const now = Date.now();
  const expiry = expiryTimestamp * 1000;
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