import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  LiveOffer,
  LiveOffersResponse,
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

export interface EscrowState {
  /** OK, IN-PROCESS, ACTIVE, DISPUTED, RESOLVED, EXPIRED, CLAIMED, NEVER_FUNDED, COMPLETED. */
  state: string;
  /** Unix seconds the cashflow matures. */
  maturity: number;
}

/**
 * What the escrows behind a list of offers are doing, in one request.
 *
 * ⚠️ AN ABSENT ENTRY MEANS UNKNOWN, NEVER "NO". An escrow can be traded without ever having
 *    been created here, and the service can be unreachable. Callers must render nothing for a
 *    missing escrow rather than asserting "not funded", and must not enable a settlement
 *    action on the strength of a missing answer.
 *
 * Deliberately not a chain read: this is display data for escrows the user does not own, and
 * reading each one off the chain turned a twenty-row list into hundreds of RPC calls.
 */
export function useEscrowStates(escrowAddresses: string[]): {
  escrows: Record<string, EscrowState>;
  loading: boolean;
} {
  const [escrows, setEscrows] = useState<Record<string, EscrowState>>({});
  const [loading, setLoading] = useState(false);

  // Stable key so this re-runs when the set of escrows changes, not on every render.
  const key = useMemo(
    () => Array.from(new Set(escrowAddresses.map((a) => a.toLowerCase()))).sort().join(','),
    [escrowAddresses]
  );

  useEffect(() => {
    if (!key) {
      setEscrows({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await fetch('/api/marketplace/escrow-states', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chainAddresses: key.split(',') })
        });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const body = await response.json();
        if (!cancelled) setEscrows(body.escrows ?? {});
      } catch (e) {
        // Leave the map empty rather than half-filled: the list still renders, just without
        // the escrow line, which is the documented meaning of a missing entry.
        console.warn('useEscrowStates: could not read escrow states', e);
        if (!cancelled) setEscrows({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { escrows, loading };
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
/**
 * Which offers are standing on these escrows, straight from chainservice.
 *
 * ⚠️ ASKS ONE QUESTION AND DOES NOT SECOND-GUESS THE ANSWER. chainservice decides whether it
 *    can serve from cache or must read the chain; this hook neither knows nor cares, and must
 *    not grow a "force fresh" flag — that decision belongs to the service that knows what it
 *    has already been told.
 *
 * ⚠️ AN ESCROW IN `unreadable` IS UNKNOWN, NOT EMPTY. It is kept out of `offersByEscrow`
 *    entirely so a caller cannot accidentally read absence as "nobody has bid" — the caller
 *    should fall back to the offer book for those, and say the list may be incomplete.
 */
export function useLiveOffers(escrowContracts: string[]) {
  const [data, setData] = useState<LiveOffersResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Stable key so this re-runs when the escrow SET changes, not on every render.
  const key = useMemo(
    () => Array.from(new Set(escrowContracts.map((e) => e.toLowerCase()))).sort().join(','),
    [escrowContracts]
  );

  const refetch = useCallback(async () => {
    if (!key) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/chain/marketplace/live-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escrows: key.split(',') })
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setData(await response.json());
    } catch (e) {
      // Every escrow becomes unknown rather than empty — see the warning above.
      console.warn('Could not read live offers:', e);
      setData({ offers: {}, unreadable: key.split(',') });
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const offersByEscrow: Record<string, LiveOffer[]> = data?.offers ?? {};
  const unreadable = useMemo(() => new Set(data?.unreadable ?? []), [data]);

  return { offersByEscrow, unreadable, loading, refetch };
}

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
