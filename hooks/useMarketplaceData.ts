import { useCallback, useEffect, useState } from 'react';
import type {
  MarketplaceRefreshResponse,
  OfferBookResponse,
  OfferView,
  SellableEscrowsResponse
} from '@/types/marketplace';

/**
 * Marketplace reads (MARKETPLACE_OPENSPEC §15.6e).
 *
 * All of them go to contractservice, which holds the only offer book there is: the venue keeps no
 * per-escrow or per-offer storage on-chain (§5.0), so without this index there is no book at all.
 * The UI never reads the chain for marketplace data.
 */

interface Fetched<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body as T;
}

function useFetched<T>(url: string | null): Fetched<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getJson<T>(url));
    } catch (e: any) {
      setError(e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/** The escrows open to offers. Discovery only — the chain gates whether a bid may be made. */
export function useSellableEscrows(maxDaysToMaturity?: number | null): Fetched<SellableEscrowsResponse> {
  const query = maxDaysToMaturity ? `?maxDaysToMaturity=${maxDaysToMaturity}` : '';
  return useFetched<SellableEscrowsResponse>(`/api/marketplace/sellable${query}`);
}

/** One escrow's offer book — the seller's view. */
export function useOfferBook(escrowContract?: string | null): Fetched<OfferBookResponse> {
  return useFetched<OfferBookResponse>(
    escrowContract ? `/api/marketplace/escrows/${escrowContract}/offers` : null
  );
}

/** Every offer one LP has made, across escrows. */
export function useLpOffers(lpAddress?: string | null): Fetched<OfferView[]> {
  return useFetched<OfferView[]>(lpAddress ? `/api/marketplace/lps/${lpAddress}/offers` : null);
}

/**
 * "Refresh from chain" (§15.6f).
 *
 * ⚠️ THE STALENESS THAT COSTS MONEY IS A MISSED ACCEPTANCE, not a missed offer. When a seller
 *    accepts directly on-chain, every *other* LP's offer on that escrow becomes stale and
 *    withdrawable at once — and those LPs have capital they could recover with no way to learn
 *    it. That is why this belongs on an LP's own offer list, not only on an admin screen.
 *
 * The response reports how many events were found; the data itself arrives by re-reading the
 * offer list afterwards, which is why callers pass what to re-read.
 */
export function useRefreshFromChain(onRefreshed?: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<MarketplaceRefreshResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/marketplace/refresh', { method: 'POST' });
      const body = (await response.json().catch(() => ({}))) as MarketplaceRefreshResponse;
      if (!response.ok || !body.success) {
        throw new Error(body.error || `Refresh failed (${response.status})`);
      }
      setLastResult(body);
      await onRefreshed?.();
      return body;
    } catch (e: any) {
      setError(e.message || 'Refresh failed');
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshed]);

  return { refresh, refreshing, lastResult, error };
}
