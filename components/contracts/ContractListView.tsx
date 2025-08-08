import { useState, useMemo } from 'react';
import { Contract, PendingContract } from '@/types';
import { displayCurrency, formatTimestamp } from '@/utils/validation';
import ExpandableHash from '@/components/ui/ExpandableHash';
import ContractActions from './ContractActions';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/auth/AuthProvider';
import MultiColumnFilter from '@/components/ui/MultiColumnFilter';

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
  // Additional fields for filtering
  userRole: 'buyer' | 'seller' | 'neither';
  fundingStatus: 'funded' | 'unfunded' | 'pending';
}

interface ContractListViewProps {
  allContracts: (Contract | PendingContract)[];
  currentUserEmail: string;
  onAccept: (contractId: string) => void;
  onAction: () => void;
  isClaimingInProgress: boolean;
  onClaimStart: () => void;
  onClaimComplete: () => void;
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
}

type SortField = 'status' | 'amount' | 'description' | 'expiryTimestamp' | 'createdAt';
type SortDirection = 'asc' | 'desc';

// Note: formatTimestamp is now imported from @/utils/validation for consistency

const ALL_STATUSES = ['PENDING', 'CREATED', 'ACTIVE', 'EXPIRED', 'DISPUTED', 'RESOLVED', 'CLAIMED'];

export default function ContractListView({
  allContracts,
  currentUserEmail,
  onAccept,
  onAction,
  isClaimingInProgress,
  onClaimStart,
  onClaimComplete,
  selectedStatuses,
  onStatusChange
}: ContractListViewProps) {
  const { user } = useAuth();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Additional filter states
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['buyer', 'seller']);
  const [selectedFundingStatuses, setSelectedFundingStatuses] = useState<string[]>(['funded', 'unfunded', 'pending']);

  // Unify contract data for table display
  const unifiedContracts: UnifiedContract[] = useMemo(() => {
    const unified: UnifiedContract[] = [];

    allContracts.forEach(contract => {
      // Detect if this is a pending contract (has id field but no contractAddress field)
      const isPending = 'id' in contract && !('contractAddress' in contract);
      
      if (isPending) {
        const pendingContract = contract as PendingContract;
        const isExpired = Date.now() / 1000 > pendingContract.expiryTimestamp;
        
        // Determine user role for pending contracts
        let userRole: 'buyer' | 'seller' | 'neither' = 'neither';
        if (pendingContract.buyerEmail === user?.email) userRole = 'buyer';
        else if (pendingContract.sellerEmail === user?.email) userRole = 'seller';
        
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
          originalContract: pendingContract,
          userRole,
          fundingStatus: 'pending'
        });
      } else {
        const regularContract = contract as Contract;
        
        // Determine user role for regular contracts
        let userRole: 'buyer' | 'seller' | 'neither' = 'neither';
        if (user?.walletAddress?.toLowerCase() === regularContract.buyerAddress?.toLowerCase()) userRole = 'buyer';
        else if (user?.walletAddress?.toLowerCase() === regularContract.sellerAddress?.toLowerCase()) userRole = 'seller';
        
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
          originalContract: regularContract,
          userRole,
          fundingStatus: regularContract.funded ? 'funded' : 'unfunded'
        });
      }
    });

    return unified;
  }, [allContracts, user?.email, user?.walletAddress]);

  // Get all available filter options with counts
  const filterOptions = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    const fundingCounts: Record<string, number> = {};
    
    unifiedContracts.forEach(contract => {
      statusCounts[contract.status] = (statusCounts[contract.status] || 0) + 1;
      roleCounts[contract.userRole] = (roleCounts[contract.userRole] || 0) + 1;
      fundingCounts[contract.fundingStatus] = (fundingCounts[contract.fundingStatus] || 0) + 1;
    });
    
    return {
      statuses: ALL_STATUSES.map(status => ({
        value: status,
        label: status.charAt(0) + status.slice(1).toLowerCase(),
        count: statusCounts[status] || 0
      })).filter(option => option.count > 0),
      
      roles: [
        { value: 'buyer', label: 'I am Buyer', count: roleCounts.buyer || 0 },
        { value: 'seller', label: 'I am Seller', count: roleCounts.seller || 0 },
        { value: 'neither', label: 'Other Contracts', count: roleCounts.neither || 0 }
      ].filter(option => option.count > 0),
      
      funding: [
        { value: 'funded', label: 'Funded', count: fundingCounts.funded || 0 },
        { value: 'unfunded', label: 'Not Funded', count: fundingCounts.unfunded || 0 },
        { value: 'pending', label: 'Pending Acceptance', count: fundingCounts.pending || 0 }
      ].filter(option => option.count > 0)
    };
  }, [unifiedContracts]);

  // Filter and sort contracts
  const filteredAndSortedContracts = useMemo(() => {
    let filtered = unifiedContracts.filter(contract => {
      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(contract.status)) {
        return false;
      }

      // Role filter
      if (selectedRoles.length > 0 && !selectedRoles.includes(contract.userRole)) {
        return false;
      }

      // Funding status filter
      if (selectedFundingStatuses.length > 0 && !selectedFundingStatuses.includes(contract.fundingStatus)) {
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
  }, [unifiedContracts, sortField, sortDirection, selectedStatuses, selectedRoles, selectedFundingStatuses, searchTerm]);

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
      {/* Search */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
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

          <div className="flex-shrink-0 text-sm text-gray-600 whitespace-nowrap">
            {filteredAndSortedContracts.length} of {unifiedContracts.length} contracts
          </div>
        </div>
      </div>

      {/* Multi-Column Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <MultiColumnFilter
          columns={[
            {
              key: 'status',
              label: 'Status',
              options: filterOptions.statuses,
              selectedValues: selectedStatuses,
              onChange: onStatusChange
            },
            {
              key: 'role',
              label: 'My Role',
              options: filterOptions.roles,
              selectedValues: selectedRoles,
              onChange: setSelectedRoles
            },
            {
              key: 'funding',
              label: 'Funding Status',
              options: filterOptions.funding,
              selectedValues: selectedFundingStatuses,
              onChange: setSelectedFundingStatuses
            }
          ]}
        />
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
                    {displayCurrency(contract.amount, 'currency' in contract.originalContract ? contract.originalContract.currency : 'microUSDC')}
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
                      {(() => {
                        const isBuyer = contract.type === 'pending' 
                          ? contract.buyerEmail === user?.email
                          : user?.walletAddress?.toLowerCase() === contract.buyerAddress?.toLowerCase();
                        const isSeller = contract.type === 'pending'
                          ? contract.sellerEmail === user?.email  
                          : user?.walletAddress?.toLowerCase() === contract.sellerAddress?.toLowerCase();
                        
                        console.log('ContractListView Debug:', {
                          contractId: contract.id,
                          contractType: contract.type,
                          contractStatus: contract.status,
                          userEmail: user?.email,
                          userWallet: user?.walletAddress?.toLowerCase(),
                          contractBuyerEmail: contract.buyerEmail,
                          contractSellerEmail: contract.sellerEmail,
                          contractBuyerAddress: contract.buyerAddress?.toLowerCase(),
                          contractSellerAddress: contract.sellerAddress?.toLowerCase(),
                          isBuyer,
                          isSeller
                        });
                        
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
                onStatusChange(ALL_STATUSES);
                setSelectedRoles(['buyer', 'seller', 'neither']);
                setSelectedFundingStatuses(['funded', 'unfunded', 'pending']);
                setSearchTerm('');
              }}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}