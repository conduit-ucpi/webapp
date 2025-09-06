/**
 * Utility functions for Farcaster integration
 */

export interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  followerCount?: number;
  verified?: boolean;
}

/**
 * Parse FID from email format like "123@farcaster.xyz"
 */
export function parseFarcasterEmail(email: string): number | null {
  const match = email.match(/^(\d+)@farcaster\.xyz$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Check if an email is a Farcaster email format
 */
export function isFarcasterEmail(email: string): boolean {
  return /^\d+@farcaster\.xyz$/.test(email);
}

/**
 * Format FID as Farcaster email
 */
export function formatFarcasterEmail(fid: number): string {
  return `${fid}@farcaster.xyz`;
}

/**
 * Fetch Farcaster user details by FID
 */
export async function fetchFarcasterUserByFid(fid: number): Promise<FarcasterUser | null> {
  try {
    const response = await fetch(`/api/users/fid/${fid}`);
    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
  } catch (error) {
    console.error('Error fetching Farcaster user:', error);
  }
  return null;
}

/**
 * Batch fetch multiple Farcaster users by FIDs
 */
export async function fetchFarcasterUsersByFids(fids: number[]): Promise<Map<number, FarcasterUser>> {
  const users = new Map<number, FarcasterUser>();
  
  if (fids.length === 0) return users;
  
  try {
    const response = await fetch('/api/users/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fids })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.users)) {
        data.users.forEach((user: FarcasterUser) => {
          users.set(user.fid, user);
        });
      }
    }
  } catch (error) {
    console.error('Error batch fetching Farcaster users:', error);
  }
  
  return users;
}