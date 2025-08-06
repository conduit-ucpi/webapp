import { useState, useMemo } from 'react';
import { Contract, PendingContract, RaiseDisputeRequest } from '@/types';
import { displayCurrency, formatTimestamp, getContractCTA, toUSDCForWeb3 } from '@/utils/validation';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConfig } from '@/components/auth/ConfigProvider';
import { Web3Service } from '@/lib/web3';

interface UnifiedContract {
  id: string;
  type: 'regular' | 'pending';
  status: string;
  amount: number;
  buyerAddress?: string;
  sellerAddress?: string;
  buyerEmail?: string;
  sellerEmail?: string;
  description: string;
  expiryTimestamp: number;
  createdAt: number | string;
  contractAddress?: string;
  funded?: boolean;
  hasDiscrepancy?: boolean;
  originalContract: Contract | PendingContract;
}

interface ContractListViewProps {
  allContracts: (Contract | PendingContract)[];
  currentUserEmail: string;
  onAccept: (contractId: string) => void;
  onAction: () => void;
  isClaimingInProgress: boolean;
  onClaimStart: () => void;
  onClaimComplete: () => void;
}

type SortField = 'status' | 'amount' | 'description' | 'expiryTimestamp' | 'createdAt';
type SortDirection = 'asc' | 'desc';

// Note: formatTimestamp is now imported from @/utils/validation for consistency

export default function ContractListView({
  allContracts,
  currentUserEmail,
  onAccept,
  onAction,
  isClaimingInProgress,
  onClaimStart,
  onClaimComplete
}: ContractListViewProps) {
  const { user } = useAuth();
  const { config } = useConfig();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [loadingMessages, setLoadingMessages] = useState<Record<string, string>>({});

  // Unify contract data for table display
  const unifiedContracts: UnifiedContract[] = useMemo(() => {
    const unified: UnifiedContract[] = [];

    allContracts.forEach(contract => {
      // Detect if this is a pending contract (has id field but no contractAddress field)
      const isPending = 'id' in contract && !('contractAddress' in contract);
      
      if (isPending) {
        const pendingContract = contract as PendingContract;
        const isExpired = Date.now() / 1000 > pendingContract.expiryTimestamp;
        unified.push({
          id: pendingContract.id,
          type: 'pending',
          status: isExpired ? 'EXPIRED' : 'PENDING',
          amount: pendingContract.amount,
          buyerAddress: undefined,
          sellerAddress: pendingContract.sellerAddress,
          buyerEmail: pendingContract.buyerEmail,
          sellerEmail: pendingContract.sellerEmail,
          description: pendingContract.description,
          expiryTimestamp: pendingContract.expiryTimestamp,
          createdAt: pendingContract.createdAt,
          contractAddress: pendingContract.chainAddress,
          funded: false,
          hasDiscrepancy: false,
          originalContract: pendingContract
        });
      } else {
        const regularContract = contract as Contract;
        unified.push({
          id: regularContract.contractAddress,
          type: 'regular',
          status: regularContract.status,
          amount: regularContract.amount,
          buyerAddress: regularContract.buyerAddress,
          sellerAddress: regularContract.sellerAddress,
          buyerEmail: regularContract.buyerEmail,
          sellerEmail: regularContract.sellerEmail,
          description: regularContract.description,
          expiryTimestamp: regularContract.expiryTimestamp,
          createdAt: regularContract.createdAt,
          contractAddress: regularContract.contractAddress,
          funded: regularContract.funded,
          hasDiscrepancy: regularContract.hasDiscrepancy,
          originalContract: regularContract
        });
      }
    });

    return unified;
  }, [allContracts]);

  // Filter and sort contracts
  const filteredAndSortedContracts = useMemo(() => {
    let filtered = unifiedContracts.filter(contract => {
      // Status filter
      if (statusFilter !== 'ALL' && contract.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          contract.description.toLowerCase().includes(searchLower) ||
          contract.buyerEmail?.toLowerCase().includes(searchLower) ||
          contract.sellerEmail?.toLowerCase().includes(searchLower) ||
          contract.contractAddress?.toLowerCase().includes(searchLower) ||
          contract.buyerAddress?.toLowerCase().includes(searchLower) ||
          contract.sellerAddress?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });

    // Sort contracts
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle different data types
      if (sortField === 'amount') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else if (sortField === 'expiryTimestamp' || sortField === 'createdAt') {
        // Convert timestamps to numbers for proper sorting
        aValue = typeof aValue === 'string' ? parseInt(aValue, 10) : Number(aValue);
        bValue = typeof bValue === 'string' ? parseInt(bValue, 10) : Number(bValue);
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [unifiedContracts, sortField, sortDirection, statusFilter, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };


  const getStatusBadgeClass = (status: string) => {
    const baseClass = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case 'PENDING':
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      case 'ACTIVE':
        return `${baseClass} bg-green-100 text-green-800`;
      case 'EXPIRED':
        return `${baseClass} bg-red-100 text-red-800`;
      case 'DISPUTED':
        return `${baseClass} bg-orange-100 text-orange-800`;
      case 'RESOLVED':
        return `${baseClass} bg-blue-100 text-blue-800`;
      case 'CLAIMED':
        return `${baseClass} bg-gray-100 text-gray-800`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800`;
    }
  };

  const handleRaiseDispute = async (contractAddress: string, originalContract: Contract) => {
    if (!config || !user || loadingStates[contractAddress]) return;

    setLoadingStates(prev => ({ ...prev, [contractAddress]: true }));
    setLoadingMessages(prev => ({ ...prev, [contractAddress]: 'Initializing...' }));
    
    try {
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);
      const userAddress = await web3Service.getUserAddress();

      setLoadingMessages(prev => ({ ...prev, [contractAddress]: 'Signing dispute transaction...' }));
      const signedTx = await web3Service.signDisputeTransaction(contractAddress);

      setLoadingMessages(prev => ({ ...prev, [contractAddress]: 'Raising dispute...' }));
      const disputeRequest: RaiseDisputeRequest = {
        contractAddress,
        userWalletAddress: userAddress,
        signedTransaction: signedTx,
        buyerEmail: originalContract.buyerEmail || user.email,
        sellerEmail: originalContract.sellerEmail,
        payoutDateTime: new Date(originalContract.expiryTimestamp * 1000).toISOString(),
        amount: toUSDCForWeb3(originalContract.amount, 'microUSDC'),
        currency: "microUSDC",
        contractDescription: originalContract.description,
        productName: process.env.PRODUCT_NAME || originalContract.description,
        serviceLink: config.serviceLink
      };

      const response = await fetch('/api/chain/raise-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disputeRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to raise dispute');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Dispute failed');
      }

      onAction();
    } catch (error: any) {
      console.error('Dispute failed:', error);
      alert(error.message || 'Failed to raise dispute');
      setLoadingStates(prev => ({ ...prev, [contractAddress]: false }));
      setLoadingMessages(prev => ({ ...prev, [contractAddress]: '' }));
    }
  };

  const handleClaimFunds = async (contractAddress: string) => {
    if (!config || !user || loadingStates[contractAddress] || isClaimingInProgress) return;

    setLoadingStates(prev => ({ ...prev, [contractAddress]: true }));
    setLoadingMessages(prev => ({ ...prev, [contractAddress]: 'Initializing...' }));
    onClaimStart?.();
    
    try {
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);
      const userAddress = await web3Service.getUserAddress();

      setLoadingMessages(prev => ({ ...prev, [contractAddress]: 'Signing claim transaction...' }));
      const signedTx = await web3Service.signClaimTransaction(contractAddress);

      setLoadingMessages(prev => ({ ...prev, [contractAddress]: 'Claiming funds...' }));
      const response = await fetch('/api/chain/claim-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          userWalletAddress: userAddress,
          signedTransaction: signedTx
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to claim funds');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Claim failed');
      }

      onAction();
      onClaimComplete?.();
    } catch (error: any) {
      console.error('Claim failed:', error);
      alert(error.message || 'Failed to claim funds');
      setLoadingStates(prev => ({ ...prev, [contractAddress]: false }));
      setLoadingMessages(prev => ({ ...prev, [contractAddress]: '' }));
      onClaimComplete?.();
    }
  };

  const renderContractAction = (contract: UnifiedContract) => {
    const isPending = contract.type === 'pending';
    const isBuyer = isPending 
      ? contract.buyerEmail === user?.email
      : user?.walletAddress?.toLowerCase() === contract.buyerAddress?.toLowerCase();
    const isSeller = isPending
      ? contract.sellerEmail === user?.email  
      : user?.walletAddress?.toLowerCase() === contract.sellerAddress?.toLowerCase();

    const contractStatus = isPending ? undefined : contract.status;
    const isExpired = isPending ? Date.now() / 1000 > contract.expiryTimestamp : false;
    const contractState = isPending ? (contract.originalContract as PendingContract).state : undefined;
    
    const ctaInfo = getContractCTA(contractStatus, isBuyer, isSeller, isPending, isExpired, contractState);
    const isLoading = loadingStates[contract.id];
    const loadingMessage = loadingMessages[contract.id];

    switch (ctaInfo.type) {
      case 'RAISE_DISPUTE':
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRaiseDispute(contract.contractAddress!, contract.originalContract as Contract)}
            disabled={isLoading}
            className={`border-red-300 text-red-700 hover:bg-red-50 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-1" />
                <span className="text-xs">{loadingMessage}</span>
              </>
            ) : (
              ctaInfo.label
            )}
          </Button>
        );

      case 'CLAIM_FUNDS':
        const isDisabled = isLoading || isClaimingInProgress;
        return (
          <Button
            size="sm"
            onClick={() => handleClaimFunds(contract.contractAddress!)}
            disabled={isDisabled}
            className={`bg-green-600 hover:bg-green-700 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-1" />
                <span className="text-xs">{loadingMessage}</span>
              </>
            ) : isClaimingInProgress ? (
              <span className="text-xs">Claim in progress...</span>
            ) : (
              ctaInfo.label
            )}
          </Button>
        );

      case 'ACCEPT_CONTRACT':
        if (!onAccept || !isPending) return null;
        return (
          <Button
            size="sm"
            onClick={() => onAccept(contract.id)}
            className="bg-primary-500 hover:bg-primary-600"
          >
            {ctaInfo.label}
          </Button>
        );

      case 'AWAITING_FUNDING':
      case 'PENDING_ACCEPTANCE':
      case 'PENDING_RESOLUTION':
        return (
          <span className="text-xs text-gray-600">{ctaInfo.label}</span>
        );

      case 'RESOLVED':
      case 'CLAIMED':
        return (
          <span className="text-xs text-green-600 font-medium">{ctaInfo.label}</span>
        );

      case 'NONE':
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 bg-gray-50 p-4 rounded-lg">
        <div className="flex-1">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by description, email, or address..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>
        
        <div className="flex-shrink-0">
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
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

        <div className="flex-shrink-0 flex items-end">
          <div className="text-sm text-gray-600">
            {filteredAndSortedContracts.length} of {unifiedContracts.length} contracts
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  Status {getSortIcon('status')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                >
                  Amount {getSortIcon('amount')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('description')}
                >
                  Description {getSortIcon('description')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participants
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('expiryTimestamp')}
                >
                  Expires {getSortIcon('expiryTimestamp')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  Created {getSortIcon('createdAt')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={getStatusBadgeClass(contract.status)}>
                        {contract.status}
                      </span>
                      {contract.hasDiscrepancy && (
                        <span className="ml-2 text-orange-500 text-xs" title="Has discrepancy">
                          ⚠️
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {displayCurrency(contract.amount, 'currency' in contract ? (contract as any).currency : 'microUSDC')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate" title={contract.description}>
                      {contract.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400 mr-1">B:</span>
                        {contract.buyerEmail && (
                          <span className="truncate max-w-24" title={contract.buyerEmail}>
                            {contract.buyerEmail}
                          </span>
                        )}
                        {contract.buyerAddress && (
                          <ExpandableHash 
                            hash={contract.buyerAddress} 
                            className="ml-1"
                          />
                        )}
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400 mr-1">S:</span>
                        {contract.sellerEmail && (
                          <span className="truncate max-w-24" title={contract.sellerEmail}>
                            {contract.sellerEmail}
                          </span>
                        )}
                        {contract.sellerAddress && (
                          <ExpandableHash 
                            hash={contract.sellerAddress} 
                            className="ml-1"
                          />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{formatTimestamp(contract.expiryTimestamp).date}</span>
                      <span className="text-xs text-gray-400">{formatTimestamp(contract.expiryTimestamp).time}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{formatTimestamp(contract.createdAt).date}</span>
                      <span className="text-xs text-gray-400">{formatTimestamp(contract.createdAt).time}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col space-y-1">
                      {renderContractAction(contract)}
                      {contract.contractAddress && (
                        <ExpandableHash 
                          hash={contract.contractAddress}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedContracts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">No contracts match your filters</div>
            <Button
              onClick={() => {
                setStatusFilter('ALL');
                setSearchTerm('');
              }}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}