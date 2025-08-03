import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import { Contract, PendingContract } from '@/types';
import ContractCard from './ContractCard';
import PendingContractCard from './PendingContractCard';
import ContractAcceptance from './ContractAcceptance';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { normalizeTimestamp } from '@/utils/validation';

type StatusFilter = 'ALL' | 'PENDING' | 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED';
type SortOrder = 'expiry-asc' | 'expiry-desc' | 'created-asc' | 'created-desc';

export default function ContractList() {
  const { user } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('expiry-asc');
  const [contractToAccept, setContractToAccept] = useState<PendingContract | null>(null);
  const [showAcceptance, setShowAcceptance] = useState(false);
  const [isClaimingInProgress, setIsClaimingInProgress] = useState(false);

  const fetchContracts = async () => {
    if (!user?.walletAddress) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch all contracts from the new combined endpoint
      const combinedContractsResponse = await fetch('/api/combined-contracts');
      
      if (!combinedContractsResponse.ok) {
        throw new Error('Failed to fetch contracts');
      }

      const combinedContractsData = await combinedContractsResponse.json();
      console.log('Combined contracts received:', combinedContractsData.length);

      // Separate pending contracts for the acceptance flow
      const pendingContracts = combinedContractsData.filter((contract: any) => contract.isPending);
      
      setPendingContracts(pendingContracts);

      // Process contracts with blockchain data
      const enrichedContracts: Contract[] = [];

      for (const contract of combinedContractsData) {
        if (contract.isPending) {
          // Skip pending contracts - they're handled separately
          continue;
        }

        if (contract.blockchainQuerySuccess && contract.blockchainStatus) {
          // Use blockchain data if available and query was successful
          enrichedContracts.push({
            contractAddress: contract.chainAddress || contract.id,
            buyerAddress: contract.blockchainStatus.buyerAddress || contract.buyerAddress || '',
            sellerAddress: contract.blockchainStatus.sellerAddress || contract.sellerAddress,
            amount: contract.blockchainStatus.amount || contract.amount,
            expiryTimestamp: contract.blockchainStatus.expiryTimestamp || contract.expiryTimestamp,
            description: contract.description,
            status: contract.blockchainStatus.status || 'CREATED',
            createdAt: normalizeTimestamp(contract.createdAt) / 1000,
            funded: contract.blockchainStatus.funded,
            fundedAt: contract.blockchainStatus.fundedAt,
            disputedAt: contract.blockchainStatus.disputedAt,
            resolvedAt: contract.blockchainStatus.resolvedAt,
            claimedAt: contract.blockchainStatus.claimedAt,
            buyerEmail: contract.buyerEmail,
            sellerEmail: contract.sellerEmail,
            adminNotes: contract.adminNotes,
            // Add error information for UI display
            blockchainQueryError: contract.blockchainQueryError,
            hasDiscrepancy: contract.hasDiscrepancy,
            discrepancyDetails: contract.discrepancyDetails
          });
        } else if (contract.chainAddress && contract.blockchainQueryError) {
          // Blockchain query failed, use fallback data but mark the error
          const fallbackContract = createContractFromDeployedData(contract);
          enrichedContracts.push({
            ...fallbackContract,
            blockchainQueryError: contract.blockchainQueryError,
            hasDiscrepancy: false
          });
        } else {
          // No chainAddress, use contract service data only
          enrichedContracts.push(createContractFromDeployedData(contract));
        }
      }

      setContracts(enrichedContracts);

      setError('');
    } catch (error: any) {
      console.error('Failed to fetch contracts:', error);
      setError(error.message || 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to create a Contract from deployed contract data
  const createContractFromDeployedData = (deployedContract: any): Contract => {
    return {
      contractAddress: deployedContract.chainAddress || deployedContract.id || '',
      buyerAddress: deployedContract.buyerAddress || '',
      sellerAddress: deployedContract.sellerAddress || '',
      amount: deployedContract.amount || 0,
      expiryTimestamp: deployedContract.expiryTimestamp || 0,
      description: deployedContract.description || '',
      status: deployedContract.chainAddress ? 'CREATED' : 'PENDING',
      createdAt: deployedContract.createdAt ? normalizeTimestamp(deployedContract.createdAt) / 1000 : 0,
      buyerEmail: deployedContract.buyerEmail,
      sellerEmail: deployedContract.sellerEmail,
      adminNotes: deployedContract.adminNotes
    };
  };

  useEffect(() => {
    fetchContracts();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (contracts.some(c => c.status === 'ACTIVE' && Date.now() / 1000 > c.expiryTimestamp - 300)) {
        fetchContracts();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.walletAddress]);

  // Refresh contracts when navigating to this page
  useEffect(() => {
    const handleRouteChange = () => {
      if (router.pathname === '/dashboard') {
        fetchContracts();
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  const handleContractAction = () => {
    fetchContracts(); // Refresh after any action
  };

  const handleClaimStart = () => {
    setIsClaimingInProgress(true);
  };

  const handleClaimComplete = () => {
    setIsClaimingInProgress(false);
    fetchContracts(); // Refresh after claim action
  };

  const handleAcceptContract = (contractId: string) => {
    const contract = pendingContracts.find(c => c.id === contractId);
    if (contract) {
      setContractToAccept(contract);
      setShowAcceptance(true);
    }
  };

  const handleAcceptComplete = () => {
    setContractToAccept(null);
    setShowAcceptance(false);
    fetchContracts(); // Refresh contract lists
  };

  // Create unified contract list with pending contracts as 'PENDING' status
  const allContracts = useMemo(() => {
    const pendingAsContracts: Contract[] = pendingContracts.map(pending => ({
      contractAddress: pending.id,
      buyerAddress: '',
      sellerAddress: pending.sellerAddress,
      amount: pending.amount,
      expiryTimestamp: pending.expiryTimestamp,
      description: pending.description,
      status: 'PENDING' as const,
      createdAt: normalizeTimestamp(pending.createdAt) / 1000,
      buyerEmail: pending.buyerEmail,
      sellerEmail: pending.sellerEmail
    }));
    
    // Combine all contracts and deduplicate based on contractAddress
    const combined = [...contracts, ...pendingAsContracts];
    const seen = new Set<string>();
    const deduplicated = combined.filter(contract => {
      const key = contract.contractAddress;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    
    return deduplicated;
  }, [contracts, pendingContracts]);

  // Filter and sort all contracts
  const filteredAndSortedContracts = useMemo(() => {
    let filtered = allContracts;
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = allContracts.filter(contract => contract.status === statusFilter);
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'expiry-asc':
          return a.expiryTimestamp - b.expiryTimestamp;
        case 'expiry-desc':
          return b.expiryTimestamp - a.expiryTimestamp;
        case 'created-asc':
          return a.createdAt - b.createdAt;
        case 'created-desc':
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    });
  }, [allContracts, statusFilter, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-600 mb-4">{error}</div>
        <button 
          onClick={fetchContracts}
          className="text-primary-600 hover:text-primary-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (allContracts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-600 mb-4">No contracts found</div>
        <p className="text-gray-500">Create your first escrow contract to get started.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter and Sort Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CREATED">Created</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="DISPUTED">Disputed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLAIMED">Claimed</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label htmlFor="sort-order" className="block text-sm font-medium text-gray-700 mb-1">
              Sort by
            </label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="expiry-asc">Expiry Date (Earliest First)</option>
              <option value="expiry-desc">Expiry Date (Latest First)</option>
              <option value="created-asc">Created Date (Oldest First)</option>
              <option value="created-desc">Created Date (Newest First)</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          Showing {filteredAndSortedContracts.length} of {allContracts.length} contracts
        </div>
      </div>

      {/* Unified Contracts Content */}
      {!showAcceptance ? (
        <>
          {filteredAndSortedContracts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-600 mb-4">No contracts match your filters</div>
              <p className="text-gray-500">Try adjusting your filter settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedContracts.map((contract) => {
                // If this is a pending contract (status === 'PENDING'), use PendingContractCard
                if (contract.status === 'PENDING') {
                  const pendingContract = pendingContracts.find(p => p.id === contract.contractAddress);
                  if (pendingContract) {
                    return (
                      <PendingContractCard
                        key={contract.contractAddress}
                        contract={pendingContract}
                        currentUserEmail={user?.email || ''}
                        onAccept={handleAcceptContract}
                      />
                    );
                  }
                }
                // Otherwise use regular ContractCard
                return (
                  <ContractCard
                    key={contract.contractAddress}
                    contract={contract}
                    onAction={handleContractAction}
                    isClaimingInProgress={isClaimingInProgress}
                    onClaimStart={handleClaimStart}
                    onClaimComplete={handleClaimComplete}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : (
        contractToAccept && (
          <ContractAcceptance
            contract={contractToAccept}
            onAcceptComplete={handleAcceptComplete}
          />
        )
      )}
    </div>
  );
}