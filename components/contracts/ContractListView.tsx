import { useState, useMemo, useEffect } from 'react';
import { Contract, PendingContract } from '@/types';
import { displayCurrency, formatTimestamp } from '@/utils/validation';
import ExpandableHash from '@/components/ui/ExpandableHash';
import ContractActions from './ContractActions';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/auth';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import FarcasterNameDisplay, { prefetchFarcasterNames } from '@/components/ui/FarcasterNameDisplay';

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
  const { walletAddress } = useWalletAddress();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Prefetch Farcaster usernames when contracts change
  useEffect(() => {
    const identifiers: string[] = [];
    allContracts.forEach(contract => {
      if ('buyerEmail' in contract && contract.buyerEmail) {
        identifiers.push(contract.buyerEmail);
      }
      if ('sellerEmail' in contract && contract.sellerEmail) {
        identifiers.push(contract.sellerEmail);
      }
    });
    if (identifiers.length > 0) {
      prefetchFarcasterNames(identifiers);
    }
  }, [allContracts]);

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
        // Normalize timestamps to ensure consistent comparison (all to seconds)
        // If it's 10 digits or less, it's already in seconds; if more, convert from millis
        aValue = Number(aValue);
        bValue = Number(bValue);
        aValue = aValue.toString().length <= 10 ? aValue : Math.floor(aValue / 1000);
        bValue = bValue.toString().length <= 10 ? bValue : Math.floor(bValue / 1000);
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
                  Status / Action {getSortIcon('status')}
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center">
                        <span className={getStatusBadgeClass(contract.status)}>
                          {contract.status}
                        </span>
                      </div>
                      {(() => {
                        const isBuyer = contract.type === 'pending' 
                          ? contract.buyerEmail === user?.email
                          : walletAddress?.toLowerCase() === contract.buyerAddress?.toLowerCase();
                        const isSeller = contract.type === 'pending'
                          ? contract.sellerEmail === user?.email  
                          : walletAddress?.toLowerCase() === contract.sellerAddress?.toLowerCase();
                        
                        return (
                          <ContractActions
                            contract={contract.originalContract}
                            isBuyer={isBuyer}
                            isSeller={isSeller}
                            onAction={onAction}
                            onAccept={onAccept}
                            isClaimingInProgress={isClaimingInProgress}
                            onClaimStart={onClaimStart}
                            onClaimComplete={onClaimComplete}
                          />
                        );
                      })()}
                      {contract.contractAddress && (
                        <ExpandableHash 
                          hash={contract.contractAddress}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {displayCurrency(contract.amount, 'currency' in contract.originalContract ? contract.originalContract.currency : 'microUSDC')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-[200px] break-words" title={contract.description}>
                      {contract.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400 mr-1">B:</span>
                        {contract.buyerEmail ? (
                          <span className="truncate max-w-24" title={contract.buyerEmail}>
                            <FarcasterNameDisplay 
                              identifier={contract.buyerEmail} 
                              showYouLabel={false}
                            />
                          </span>
                        ) : contract.buyerAddress ? (
                          <ExpandableHash 
                            hash={contract.buyerAddress} 
                            className="ml-1"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400 mr-1">S:</span>
                        {contract.sellerEmail ? (
                          <span className="truncate max-w-24" title={contract.sellerEmail}>
                            <FarcasterNameDisplay 
                              identifier={contract.sellerEmail} 
                              showYouLabel={false}
                            />
                          </span>
                        ) : contract.sellerAddress ? (
                          <ExpandableHash 
                            hash={contract.sellerAddress} 
                            className="ml-1"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
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