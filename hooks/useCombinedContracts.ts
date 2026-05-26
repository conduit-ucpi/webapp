import { useState, useEffect, useCallback } from 'react';
import { Contract, PendingContract } from '@/types';

export type UnifiedContract = Contract | PendingContract;

/**
 * Transforms a single /api/combined-contracts item into the unified
 * Contract | PendingContract shape.
 *
 * This is the single source of truth for the transform that was previously
 * duplicated across ContractList and EnhancedDashboard (twice). The branch
 * selection keys off `contract.chainAddress`: an item with NO chainAddress is
 * a pending (not-yet-deployed) contract; otherwise it is a deployed contract
 * with optional blockchain-derived fields.
 *
 * Returns null for items missing `contract` data (skipped by callers).
 */
export function transformCombinedContractItem(item: any): UnifiedContract | null {
  if (!item || !item.contract) {
    return null;
  }

  const contract = item.contract;

  if (!contract.chainAddress) {
    // Pending contract (not yet deployed to blockchain).
    const pendingContract: PendingContract = {
      id: contract.id,
      sellerEmail: contract.sellerEmail || '',
      buyerEmail: contract.buyerEmail || '',
      amount: contract.amount || 0, // microUSDC; formatUSDC converts for display
      currency: contract.currency || 'USDC',
      sellerAddress: contract.sellerAddress || '',
      expiryTimestamp: contract.expiryTimestamp || 0,
      chainId: contract.chainId,
      chainAddress: contract.chainAddress,
      description: contract.description || '',
      createdAt: contract.createdAt?.toString() || '',
      createdBy: contract.createdBy || '',
      state: contract.state || 'OK',
      adminNotes: contract.adminNotes || [],
      ctaType: item.ctaType,
      ctaLabel: item.ctaLabel,
      ctaVariant: item.ctaVariant,
    } as PendingContract;
    return pendingContract;
  }

  // Deployed contract with blockchain data.
  const regularContract: Contract = {
    id: contract.id,
    contractAddress: contract.chainAddress || '',
    buyerAddress: item.blockchainBuyerAddress || contract.buyerAddress || '',
    sellerAddress: item.blockchainSellerAddress || contract.sellerAddress || '',
    amount: parseFloat(item.blockchainAmount || contract.amount || '0'), // microUSDC
    expiryTimestamp: item.blockchainExpiryTimestamp || contract.expiryTimestamp || 0,
    description: contract.description || '',
    status: item.status || 'UNKNOWN',
    blockchainStatus: item.blockchainStatus,
    createdAt: contract.createdAt || 0,
    funded: item.blockchainFunded || false,
    buyerEmail: contract.buyerEmail,
    sellerEmail: contract.sellerEmail,
    productName: contract.productName,
    adminNotes: contract.adminNotes || [],
    disputes: contract.disputes || [],
    blockchainQueryError: item.blockchainError,
    hasDiscrepancy: Object.values(item.discrepancies || {}).some(Boolean),
    discrepancyDetails: Object.entries(item.discrepancies || {})
      .filter(([, value]) => value)
      .map(([key]) => key),
    ctaType: item.ctaType,
    ctaLabel: item.ctaLabel,
    ctaVariant: item.ctaVariant,
  };
  return regularContract;
}

/**
 * Transforms the full /api/combined-contracts array into the unified list,
 * skipping any items without contract data (matching prior per-component
 * behavior, which logged-and-skipped such items).
 */
export function transformCombinedContracts(contractsData: any[]): UnifiedContract[] {
  const unified: UnifiedContract[] = [];
  contractsData.forEach((item: any) => {
    const transformed = transformCombinedContractItem(item);
    if (transformed) {
      unified.push(transformed);
    } else {
      console.warn('Item missing contract data:', item);
    }
  });
  return unified;
}

type Fetcher = (url: string) => Promise<Response>;

interface UseCombinedContractsOptions {
  /**
   * Whether the hook should fetch. Callers gate on auth differently
   * (some require a `user`, the dashboard uses lazy auth via the fetcher).
   * When false, the hook performs no request and clears loading.
   */
  enabled?: boolean;
  /**
   * The fetch implementation. Defaults to the global `fetch`. The dashboard
   * passes its `authenticatedFetch` (which handles lazy SIWX auth + retry).
   */
  fetcher?: Fetcher;
}

interface UseCombinedContractsResult {
  contracts: UnifiedContract[];
  isLoading: boolean;
  error: string;
  /** Re-fetch on demand (e.g. after a contract action). */
  refetch: () => Promise<void>;
}

/**
 * Single source of truth for reading and transforming /api/combined-contracts.
 *
 * Replaces the duplicated fetch + transform logic in ContractList and
 * EnhancedDashboard, and the lightweight existence check in ProgressChecklist
 * (which reads only `contracts.length`). It does NOT change the endpoint, the
 * transform, or the error/empty handling — it relocates them.
 *
 * Note: this hook intentionally does not wrap /api/admin/combined-contracts,
 * which returns a different shape with a different (admin) transform.
 */
export function useCombinedContracts(
  options: UseCombinedContractsOptions = {}
): UseCombinedContractsResult {
  const { enabled = true, fetcher } = options;
  const [contracts, setContracts] = useState<UnifiedContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    const doFetch: Fetcher = fetcher ?? ((url) => fetch(url));
    try {
      const response = await doFetch('/api/combined-contracts');

      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }

      const contractsData = await response.json();

      if (!Array.isArray(contractsData)) {
        throw new Error('Invalid response format - expected array');
      }

      setContracts(transformCombinedContracts(contractsData));
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch contracts:', err);
      setError(err.message || 'Failed to load contracts');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (enabled) {
      refetch().catch(() => {
        /* error already captured in state */
      });
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refetch]);

  return { contracts, isLoading, error, refetch };
}
