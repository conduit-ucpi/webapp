import { useState, useEffect, useRef } from 'react';
import { PendingContract } from '@/types';

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
}

/**
 * Fetches the pending contract for contract-pay by id, once the user is
 * connected, and validates it. Verbatim extraction of the prior inline effect.
 *
 * Returns a contractError (and leaves contract null) when the request is already
 * deployed ("already been paid"), expired, or the fetch fails. A zero
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
        if (contractData.contractAddress) {
          setContractError('This payment request has already been paid.');
          setIsLoadingContract(false);
          return;
        }

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

  return { contract, isLoadingContract, contractError };
}
