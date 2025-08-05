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

export function formatUSDC(amount: string | number): string {
  // USDC amounts come from chain in microUSDC (6 decimals)
  // Convert from microUSDC to USDC by dividing by 1,000,000
  const microUSDC = typeof amount === 'string' ? parseFloat(amount) : amount;
  const usdc = microUSDC / 1000000;
  return usdc.toFixed(2);
}

export function normalizeTimestamp(timestamp: number | string): number {
  // Convert to number if it's a string
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  // If it's 10 digits or less, it's in seconds - convert to milliseconds
  return ts.toString().length <= 10 ? ts * 1000 : ts;
}

export function formatTimeRemaining(expiryTimestamp: number): string {
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

export function formatExpiryDate(expiryTimestamp: number): string {
  const date = new Date(normalizeTimestamp(expiryTimestamp));
  
  // Get the user's timezone
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Format the date in DD-MMM-YYYY HH:mm format
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timeZone
  };
  
  const formattedDate = date.toLocaleDateString('en-GB', options);
  
  // Get timezone abbreviation
  const timeZoneAbbr = date.toLocaleTimeString('en-US', {
    timeZoneName: 'short',
    timeZone: timeZone
  }).split(' ').pop();
  
  return `${formattedDate} ${timeZoneAbbr}`;
}

export type ContractCTAType = 
  | 'RAISE_DISPUTE' 
  | 'CLAIM_FUNDS' 
  | 'PENDING_RESOLUTION' 
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
      label: 'Pending Acceptance',
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
      type: 'PENDING_RESOLUTION', 
      label: 'Pending Resolution',
      variant: 'status'
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