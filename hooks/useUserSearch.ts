import { useState, useCallback } from 'react';

export interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
  verified: boolean;
}

interface UseUserSearchResult {
  results: FarcasterUser[];
  isSearching: boolean;
  /**
   * Run a search against /api/users/search. No-ops (and clears results) when
   * searching is disabled or the query is empty. Resolves once state settles.
   */
  search: (query: string) => Promise<void>;
  /** Clear current results (e.g. when the input no longer looks like a search). */
  clear: () => void;
}

interface UseUserSearchOptions {
  /**
   * Whether searching is permitted. BuyerInput gates on the presence of a
   * Neynar API key; when false the hook never hits the network.
   */
  enabled?: boolean;
}

/**
 * Single source of truth for the Farcaster user search call previously inline
 * in BuyerInput. Preserves the existing behavior exactly: encodes the query,
 * hits /api/users/search?q=..., reads `data.users || []`, and treats a non-ok
 * response or thrown error as empty results (logging to console).
 */
export function useUserSearch(options: UseUserSearchOptions = {}): UseUserSearchResult {
  const { enabled = true } = options;
  const [results, setResults] = useState<FarcasterUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const clear = useCallback(() => {
    setResults([]);
  }, []);

  const search = useCallback(
    async (query: string) => {
      if (!enabled || !query || query.length < 1) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.users || []);
        } else {
          console.error('Failed to search users');
          setResults([]);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [enabled]
  );

  return { results, isSearching, search, clear };
}
