import { useState, useEffect, useRef, useCallback } from 'react';
import { PendingContract } from '@/types';
import { askRequestPrepare, type RequestPrepareAnswer } from '../lib/requestPrepare';

interface UsePayableContractParams {
  /** From router.query — may be string | string[] | undefined. */
  contractId: string | string[] | undefined;
  isConnected: boolean;
  address: string | null | undefined;
  authenticatedFetch: ((url: string, options?: RequestInit) => Promise<Response>) | undefined;
}

interface UsePayableContractResult {
  contract: PendingContract | null;
  isLoadingContract: boolean;
  contractError: string | null;
  /**
   * The prepare asked for alongside the read, handed over once (null after that, or when none
   * was asked for this id). Resolves to null if it never arrived, so the page asks for itself.
   */
  takeEarlyPrepare: (id: string) => Promise<RequestPrepareAnswer | null> | null;
}

/**
 * Fetches the pending contract for contract-pay by id, once the user is
 * connected, and validates it. Verbatim extraction of the prior inline effect.
 *
 * Returns a contractError (and leaves contract null) when the request is already
 * expired, or the fetch fails. Whether it is already paid is a chain fact and
 * is decided by the page, not here. A zero
 * expiryTimestamp is an instant payment and is NOT treated as expired.
 *
 * IMPORTANT: authenticatedFetch is intentionally NOT an effect dependency. Its
 * identity changes on every auth step, and including it would re-fire the fetch
 * mid-auth — racing the SIWX session rotation into a 401/re-render storm. A ref
 * holds the latest authenticatedFetch, and the fetchedContractIdRef guard makes
 * the fetch one-shot per contractId; connection state + contractId are the real
 * triggers.
 */
export function usePayableContract(params: UsePayableContractParams): UsePayableContractResult {
  const { contractId, isConnected, address, authenticatedFetch } = params;
  const [contract, setContract] = useState<PendingContract | null>(null);
  const [isLoadingContract, setIsLoadingContract] = useState(true);
  const [contractError, setContractError] = useState<string | null>(null);

  const authenticatedFetchRef = useRef(authenticatedFetch);
  authenticatedFetchRef.current = authenticatedFetch;
  const fetchedContractIdRef = useRef<string | null>(null);
  const earlyPrepareRef = useRef<{ id: string; answer: Promise<RequestPrepareAnswer | null> } | null>(null);
  const takeEarlyPrepare = useCallback((id: string) => {
    const early = earlyPrepareRef.current;
    if (!early || early.id !== id) return null;
    earlyPrepareRef.current = null;
    return early.answer;
  }, []);

  useEffect(() => {
    const fetchContract = async () => {
      if (!contractId || typeof contractId !== 'string') {
        setIsLoadingContract(false);
        return;
      }

      // Don't attempt fetch until a wallet is connected.
      if (!isConnected && !address) {
        setIsLoadingContract(false);
        return;
      }

      const doFetch = authenticatedFetchRef.current;
      if (!doFetch) {
        setIsLoadingContract(false);
        return;
      }

      // Fetch once per contractId. Without this guard, the effect re-fires
      // whenever authenticatedFetch's identity changes (it is recreated on every
      // auth step), launching concurrent fetches that race the SIWX session
      // rotation and 401 — feeding a re-render/re-auth storm.
      if (fetchedContractIdRef.current === contractId) {
        return;
      }
      fetchedContractIdRef.current = contractId;

      /*
       * ⚠️ PREPARE IS ASKED NOW, NOT AFTER THE READ. The page cannot be paid until prepare has
       *    answered, and prepare needs nothing the read returns: only the id and the session.
       *    Asked after it, every payment waited for the read (up to half a second on
       *    production, 2026-11-23) and a render before the slowest call had even started.
       *    It does what the page would do a moment later anyway. A refusal (your own request,
       *    expired, already paid) costs nothing: the page says so from the read, as before.
       *    Never rejects: a failure here must not become an unhandled error about a call
       *    nobody was waiting for yet.
       */
      earlyPrepareRef.current = {
        id: contractId,
        answer: askRequestPrepare(doFetch, contractId).catch(() => null),
      };

      setIsLoadingContract(true);
      setContractError(null);

      try {
        const response = await doFetch(`/api/contracts/${contractId}`, { method: 'GET' });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch contract');
        }

        const contractData = await response.json();

        // Validate contract state.
        //
        // Deliberately NOT deciding here whether the request is already paid.
        // This endpoint returns the stored PendingContract, which carries no
        // status field at all — only `state`, which is "OK" for everything. An
        // earlier version read contractData.status, got undefined, and concluded
        // from the presence of a chain address alone that the request was paid,
        // which is exactly wrong for the case that matters: an escrow deployed
        // and funded but not yet swept in.
        //
        // Whether the money has actually landed is a chain fact, so contract-pay
        // reads it from the escrow itself.

        if (contractData.expiryTimestamp && contractData.expiryTimestamp !== 0) {
          const now = Math.floor(Date.now() / 1000);
          if (contractData.expiryTimestamp < now) {
            setContractError('This payment request has expired.');
            setIsLoadingContract(false);
            return;
          }
        }

        setContract(contractData);
      } catch (error: any) {
        console.error('usePayableContract: failed to fetch contract:', error);
        setContractError(error.message || 'Failed to load payment request');
      } finally {
        setIsLoadingContract(false);
      }
    };

    fetchContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, isConnected, address]);

  /*
   * ⚠️ "ABOUT TO FETCH" COUNTS AS LOADING. The fetch starts in an effect, one render after the
   *    wallet connects, and for that render nothing is loading and nothing is loaded. The page
   *    read that as "no such request" and showed "Payment Request Not Found" for one frame on
   *    the way to every payment (seen 2026-11-23). Worked out here, during the render, so there
   *    is no frame in which a fetch that is certain to happen has not been counted.
   */
  const aboutToFetch =
    typeof contractId === 'string' &&
    !!contractId &&
    (isConnected || !!address) &&
    !!authenticatedFetch &&
    fetchedContractIdRef.current !== contractId;

  return { contract, isLoadingContract: isLoadingContract || aboutToFetch, contractError, takeEarlyPrepare };
}
