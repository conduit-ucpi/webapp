import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import { Contract, PendingContract } from '@/types';
import ContractCard from './ContractCard';
import ContractAcceptance from './ContractAcceptance';
import ContractListView from './ContractListView';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type StatusFilter = 'ALL' | 'PENDING' | 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED';

export default function ContractList() {
  const { user } = useAuth();
  const router = useRouter();
  const [allContracts, setAllContracts] = useState<(Contract | PendingContract)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [contractToAccept, setContractToAccept] = useState<PendingContract | null>(null);
  const [showAcceptance, setShowAcceptance] = useState(false);
  const [isClaimingInProgress, setIsClaimingInProgress] = useState(false);

  const fetchContracts = async () => {
    try {
      // Fetch contracts from the combined endpoint
      const response = await fetch('/api/combined-contracts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }

      const contractsData = await response.json();
      
      if (!Array.isArray(contractsData)) {
        throw new Error('Invalid response format - expected array');
      }
      
      // Transform contracts into unified array
      const unified: (Contract | PendingContract)[] = [];
      
      contractsData.forEach((item: any) => {
        if (!item.contract) {
          console.warn('Item missing contract data:', item);
          return;
        }
        
        const contract = item.contract;
        
        // Check if this is a pending contract (no blockchain data)
        if (!contract.chainAddress || !item.blockchainQuerySuccessful) {
          // This is a pending contract
          const pendingContract: PendingContract = {
            id: contract.id,
            sellerEmail: contract.sellerEmail || '',
            buyerEmail: contract.buyerEmail || '',
            amount: contract.amount || 0, // Keep in microUSDC, formatUSDC will convert for display
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
            ctaVariant: item.ctaVariant
          };
          unified.push(pendingContract);
        } else {
          // This is a regular contract with blockchain data
          const regularContract: Contract = {
            id: contract.id, // Include database ID
            contractAddress: contract.chainAddress || '',
            buyerAddress: item.blockchainBuyerAddress || contract.buyerAddress || '',
            sellerAddress: item.blockchainSellerAddress || contract.sellerAddress || '',
            amount: parseFloat(item.blockchainAmount || contract.amount || '0'), // Keep in microUSDC, formatUSDC will convert for display
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
            ctaVariant: item.ctaVariant
          };
          unified.push(regularContract);
        }
      });
      
      setAllContracts(unified);
      setError('');
    } catch (error: any) {
      console.error('Failed to fetch contracts:', error);
      setError(error.message || 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    if (user) {
      fetchContracts();
    } else {
      setIsLoading(false);
    }
  }, [user]);

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
    const contract = allContracts.find(c => 
      'id' in c && !('contractAddress' in c) && c.id === contractId
    ) as PendingContract | undefined;
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

  // Filter contracts based on status
  const filteredContracts = allContracts.filter(contract => {
    if (statusFilter === 'ALL') return true;
    
    // Handle pending contracts
    if ('id' in contract && !('contractAddress' in contract)) {
      const pendingContract = contract as PendingContract;
      if (statusFilter === 'PENDING') return true;
      // Check if expired
      const isExpired = Date.now() / 1000 > pendingContract.expiryTimestamp;
      if (statusFilter === 'EXPIRED' && isExpired) return true;
      return false;
    }
    
    // Handle regular contracts
    const regularContract = contract as Contract;
    return regularContract.status === statusFilter;
  });

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
        <p className="text-gray-500">No contracts are currently available in the system.</p>
      </div>
    );
  }

  // Calculate total contracts for view mode decision
  const totalContracts = filteredContracts.length;
  const showListView = totalContracts > 4;

  return (
    <div>
      {!showAcceptance ? (
        <>
          {filteredContracts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-600 mb-4">No contracts match your filters</div>
              <p className="text-gray-500">Try adjusting your filter settings.</p>
            </div>
          ) : showListView ? (
            /* List View for >4 contracts */
            <ContractListView
              allContracts={filteredContracts}
              currentUserEmail={user?.email || ''}
              onAccept={handleAcceptContract}
              onAction={handleContractAction}
              isClaimingInProgress={isClaimingInProgress}
              onClaimStart={handleClaimStart}
              onClaimComplete={handleClaimComplete}
            />
          ) : (
            /* Card View for ≤4 contracts */
            <>
              {/* Status Filter for Card View */}
              <div className="mb-6 flex justify-between items-center">
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

                {/* Results Count */}
                <div className="text-sm text-gray-600">
                  Showing {totalContracts} contracts
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Render all contracts using unified ContractCard */}
                {filteredContracts.map((contract) => {
                  const isPending = 'id' in contract && !('contractAddress' in contract);
                  const key = isPending ? (contract as PendingContract).id : (contract as Contract).contractAddress;
                  
                  return (
                    <ContractCard
                      key={key}
                      contract={contract}
                      onAction={handleContractAction}
                      onAccept={handleAcceptContract}
                      isClaimingInProgress={isClaimingInProgress}
                      onClaimStart={handleClaimStart}
                      onClaimComplete={handleClaimComplete}
                    />
                  );
                })}
              </div>
            </>
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