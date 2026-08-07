import { useCallback, useEffect, useState } from 'react';
import { RpcClient, EscrowSettlementState } from '@/lib/rpc/RpcClient';
import { useConfig } from '@/components/auth/ConfigProvider';
import type { ArbiterState } from '@/types/marketplace';

/**
 * The two reads behind the dispute and arbiter screens (MARKETPLACE_OPENSPEC §15.6b–c).
 *
 * They come from different places on purpose. The arbiter seat is served by chainservice, which
 * already knows the escrow's cohort and computes a `can*` flag per action, so the UI never has to
 * reason about which implementation a clone is. The standing settlement figures are read straight
 * from the chain, because the escrow settles itself the moment two of them match — an off-chain
 * record cannot observe that, and treating one as authoritative is exactly the drift §3.3A2a was
 * restructured to eliminate.
 */

interface Fetched<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /**
   * Re-read, and hand the result straight back.
   *
   * Returning the value matters for the settlement read: after a vote lands, the caller has to
   * decide what to tell the user, and React state set inside `refetch` is not visible to the
   * code that awaited it. Reading `data` there would report the state from *before* the vote —
   * which is how a UI ends up saying "your offer is standing" about a dispute that just paid out.
   */
  refetch: () => Promise<T | null>;
}

/**
 * The arbiter seat state, with a `can*` flag per action.
 *
 * Show a control when its flag is true. That is the whole rule — a legacy escrow comes back with
 * every flag false, so the correct behaviour falls out without a special case (§15.6c).
 */
export function useArbiterState(contractAddress?: string | null): Fetched<ArbiterState> {
  const [data, setData] = useState<ArbiterState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!contractAddress) return null;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/chain/contract/${contractAddress}/arbiter`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Failed to read arbiter state (${response.status})`);
      setData(body as ArbiterState);
      return body as ArbiterState;
    } catch (e: any) {
      setError(e.message || 'Failed to read arbiter state');
      return null;
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Every standing settlement figure, read from the chain.
 *
 * ⚠️ THE CHAIN IS THE SOURCE OF TRUTH FOR "HAS THIS SETTLED". A second matching vote pays out in
 *    the same transaction that cast it, so a successful send tells you the vote landed, not
 *    whether it ended the dispute. Re-read this after every vote before rendering "offer
 *    standing, awaiting the other party" (§15.6b).
 */
export function useSettlementState(contractAddress?: string | null): Fetched<EscrowSettlementState> {
  const { config } = useConfig();
  const [data, setData] = useState<EscrowSettlementState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!contractAddress || !config?.rpcUrl) return null;
    setLoading(true);
    setError(null);
    try {
      const fresh = await new RpcClient(config.rpcUrl).getSettlementState(contractAddress);
      setData(fresh);
      return fresh;
    } catch (e: any) {
      // A legacy escrow has no `recipient()`, and an undeployed one has no code. Neither is
      // worth an error banner on a dispute screen — the figures simply cannot be shown.
      console.warn('Could not read settlement state from chain:', e);
      setError(e.message || 'Could not read settlement figures from the chain');
      return null;
    } finally {
      setLoading(false);
    }
  }, [contractAddress, config?.rpcUrl]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
