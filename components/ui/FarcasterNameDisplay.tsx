import { useState, useEffect } from 'react';
import { isFarcasterEmail, parseFarcasterEmail, fetchFarcasterUserByFid } from '@/utils/farcasterUtils';
import { useAuth } from '@/components/auth';

interface FarcasterNameDisplayProps {
  identifier: string | null | undefined;
  showYouLabel?: boolean;
  className?: string;
  fallbackToAddress?: boolean;
  walletAddress?: string;
}

// Simple in-memory cache for FID to username mappings
const fidUsernameCache = new Map<number, { username: string; displayName?: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function FarcasterNameDisplay({ 
  identifier, 
  showYouLabel = true,
  className = '',
  fallbackToAddress = false,
  walletAddress
}: FarcasterNameDisplayProps) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsername = async () => {
      if (!identifier || !isFarcasterEmail(identifier)) {
        setDisplayName(null);
        return;
      }

      const fid = parseFarcasterEmail(identifier);
      if (!fid) {
        setDisplayName(null);
        return;
      }

      // Check if this is the current user (only for Farcaster-authenticated users)
      if (user?.fid && user?.fid === fid) {
        setDisplayName(user.username ? `@${user.username}` : identifier);
        return;
      }

      // Check cache first
      const cached = fidUsernameCache.get(fid);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setDisplayName(`@${cached.username}`);
        return;
      }

      // Fetch from API
      setLoading(true);
      try {
        const farcasterUser = await fetchFarcasterUserByFid(fid);
        if (farcasterUser) {
          // Update cache
          fidUsernameCache.set(fid, {
            username: farcasterUser.username,
            displayName: farcasterUser.displayName,
            timestamp: Date.now()
          });
          setDisplayName(`@${farcasterUser.username}`);
        } else {
          setDisplayName(identifier); // Fallback to FID email format
        }
      } catch (error) {
        console.error('Error fetching Farcaster username:', error);
        setDisplayName(identifier); // Fallback to FID email format
      } finally {
        setLoading(false);
      }
    };

    fetchUsername();
  }, [identifier, user]);

  // Handle non-Farcaster identifiers
  if (!identifier) {
    return fallbackToAddress && walletAddress ? (
      <span className={className}>{walletAddress}</span>
    ) : (
      <span className={className}>-</span>
    );
  }

  if (!isFarcasterEmail(identifier)) {
    return <span className={className}>{identifier}</span>;
  }

  // Check if this is the current user
  const isCurrentUser = user?.email === identifier || 
    (isFarcasterEmail(identifier) && user?.fid && user?.fid === parseFarcasterEmail(identifier));

  if (loading) {
    return (
      <span className={className}>
        <span className="inline-block animate-pulse bg-gray-200 rounded h-4 w-24"></span>
      </span>
    );
  }

  return (
    <span className={className}>
      {displayName || identifier}
      {showYouLabel && isCurrentUser && <span className="ml-1">(You)</span>}
    </span>
  );
}

// Utility function to clear the cache if needed
export function clearFarcasterNameCache() {
  fidUsernameCache.clear();
}

// Utility function to prefetch multiple FIDs
export async function prefetchFarcasterNames(identifiers: string[]) {
  const fidsToFetch: number[] = [];
  
  for (const identifier of identifiers) {
    if (isFarcasterEmail(identifier)) {
      const fid = parseFarcasterEmail(identifier);
      if (fid && !fidUsernameCache.has(fid)) {
        fidsToFetch.push(fid);
      }
    }
  }

  if (fidsToFetch.length === 0) return;

  try {
    // Fetch all users in parallel
    const promises = fidsToFetch.map(fid => fetchFarcasterUserByFid(fid));
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const farcasterUser = result.value;
        fidUsernameCache.set(fidsToFetch[index], {
          username: farcasterUser.username,
          displayName: farcasterUser.displayName,
          timestamp: Date.now()
        });
      }
    });
  } catch (error) {
    console.error('Error prefetching Farcaster names:', error);
  }
}