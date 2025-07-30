import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { PendingContract } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { formatUSDC, formatExpiryDate, normalizeTimestamp } from '@/utils/validation';

// Extended type for admin contracts that includes chain data
type AdminContract = PendingContract & {
  status?: 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED';
  funded?: boolean;
  fundedAt?: string;
  disputedAt?: string;
  resolvedAt?: string;
  claimedAt?: string;
  buyerAddress?: string;
  contractAddress?: string;
  notes?: string;
}

interface AdminContractListProps {
  onContractSelect?: (contract: AdminContract) => void;
}

type SortField = 'createdAt' | 'expiryTimestamp' | 'amount' | 'status' | 'sellerEmail' | 'buyerEmail';
type SortDirection = 'asc' | 'desc';

export default function AdminContractList({ onContractSelect }: AdminContractListProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<AdminContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [hasChainAddress, setHasChainAddress] = useState<string>('ALL');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const fetchContracts = async () => {
    try {
      // Step 1: Fetch deployed contracts with email data and notes from contract service
      const deployedResponse = await fetch(`${router.basePath}/api/admin/contracts`);
      if (!deployedResponse.ok) {
        throw new Error('Failed to fetch deployed contracts');
      }
      const deployedData = await deployedResponse.json();

      // Step 2: Extract contracts that have chainAddress and fetch their chain data
      const contractsWithChainData: AdminContract[] = [];
      const contractsWithoutChainData: AdminContract[] = [];

      for (const deployedContract of deployedData || []) {
        if (deployedContract.chainAddress) {
          try {
            // Fetch individual contract from chain service
            const chainResponse = await fetch(`${router.basePath}/api/chain/contract/${deployedContract.chainAddress}`);
            
            if (chainResponse.ok) {
              const chainContract = await chainResponse.json();
              
              // Step 3: Derive synthetic RESOLVED status
              let finalStatus = chainContract.status;
              if (chainContract.status === 'CLAIMED' && deployedContract.adminNotes && deployedContract.adminNotes.length > 0) {
                finalStatus = 'RESOLVED';
              }

              // Combine chain data with deployed contract data
              contractsWithChainData.push({
                ...deployedContract,
                ...chainContract,
                status: finalStatus,
                buyerAddress: chainContract.buyer || chainContract.buyerAddress,
                sellerAddress: chainContract.seller || chainContract.sellerAddress,
                contractAddress: deployedContract.chainAddress
              });
            } else {
              console.warn(`Failed to fetch chain data for contract ${deployedContract.chainAddress}`);
              contractsWithoutChainData.push(deployedContract);
            }
          } catch (error) {
            console.warn(`Error fetching chain data for contract ${deployedContract.chainAddress}:`, error);
            contractsWithoutChainData.push(deployedContract);
          }
        } else {
          // Contract without chainAddress
          contractsWithoutChainData.push(deployedContract);
        }
      }

      // Combine all contracts
      const allContracts = [...contractsWithChainData, ...contractsWithoutChainData];
      setContracts(allContracts);
      setError('');
    } catch (error: any) {
      console.error('Failed to fetch admin contracts:', error);
      setError(error.message || 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  // Filter and search logic
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      // Search across multiple fields
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        contract.sellerEmail?.toLowerCase().includes(searchLower) ||
        contract.buyerEmail?.toLowerCase().includes(searchLower) ||
        contract.description?.toLowerCase().includes(searchLower) ||
        contract.chainAddress?.toLowerCase().includes(searchLower) ||
        contract.sellerAddress?.toLowerCase().includes(searchLower) ||
        contract.buyerAddress?.toLowerCase().includes(searchLower) ||
        contract.amount?.toString().includes(searchLower) ||
        contract.id?.toLowerCase().includes(searchLower)
      );

      // Status filter (for deployed contracts)
      const matchesStatus = statusFilter === 'ALL' || 
        (contract as any).status === statusFilter;

      // Chain address filter
      const matchesChainAddress = hasChainAddress === 'ALL' ||
        (hasChainAddress === 'YES' && contract.chainAddress) ||
        (hasChainAddress === 'NO' && !contract.chainAddress);

      return matchesSearch && matchesStatus && matchesChainAddress;
    });
  }, [contracts, searchTerm, statusFilter, hasChainAddress]);

  // Sort logic
  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle special cases
      if (sortField === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortField === 'amount') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredContracts, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedContracts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContracts = sortedContracts.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getStatusDisplay = (contract: any) => {
    if (contract.status) {
      return contract.status;
    }
    if (contract.chainAddress) {
      return 'DEPLOYED';
    }
    const isExpired = Date.now() / 1000 > contract.expiryTimestamp;
    return isExpired ? 'EXPIRED' : 'PENDING';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'DEPLOYED':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      case 'DISPUTED':
        return 'bg-red-100 text-red-800';
      case 'RESOLVED':
        return 'bg-purple-100 text-purple-800';
      case 'CLAIMED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
        <Button onClick={fetchContracts} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header and Controls */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">All Contracts</h2>
            <p className="text-sm text-gray-600">
              Showing {paginatedContracts.length} of {sortedContracts.length} contracts
            </p>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <Input
              type="text"
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64"
            />
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DEPLOYED">Deployed</option>
              <option value="PENDING">Pending</option>
              <option value="EXPIRED">Expired</option>
              <option value="DISPUTED">Disputed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLAIMED">Claimed</option>
            </select>
            
            <select
              value={hasChainAddress}
              onChange={(e) => setHasChainAddress(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">All Types</option>
              <option value="YES">On-Chain</option>
              <option value="NO">Pending Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                Created {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('amount')}
              >
                Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('sellerEmail')}
              >
                Receiver {sortField === 'sellerEmail' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('buyerEmail')}
              >
                Payer {sortField === 'buyerEmail' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Receiver Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payer Address
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('expiryTimestamp')}
              >
                Expiry {sortField === 'expiryTimestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contract Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedContracts.map((contract) => {
              const status = getStatusDisplay(contract);
              return (
                <tr 
                  key={contract.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onContractSelect?.(contract)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(normalizeTimestamp(contract.createdAt)).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${formatUSDC(contract.amount)} {contract.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.sellerEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.buyerEmail || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.sellerAddress ? (
                      <ExpandableHash hash={contract.sellerAddress} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.buyerAddress ? (
                      <ExpandableHash hash={contract.buyerAddress} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatExpiryDate(contract.expiryTimestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {contract.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.chainAddress ? (
                      <ExpandableHash hash={contract.chainAddress} />
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">per page</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            
            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {sortedContracts.length === 0 && (
        <div className="text-center py-20">
          <div className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'ALL' || hasChainAddress !== 'ALL' 
              ? 'No contracts match your filters' 
              : 'No contracts found'
            }
          </div>
          {(searchTerm || statusFilter !== 'ALL' || hasChainAddress !== 'ALL') && (
            <Button 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setHasChainAddress('ALL');
              }}
              variant="outline"
              size="sm"
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}