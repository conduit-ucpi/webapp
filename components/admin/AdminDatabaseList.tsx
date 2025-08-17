import { useState, useEffect, useMemo } from 'react';
import { PendingContract } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { displayCurrency, formatDateTimeWithTZ, normalizeTimestamp } from '@/utils/validation';

interface AdminDatabaseListProps {
  onContractSelect?: (contract: PendingContract) => void;
}

type SortField = 'createdAt' | 'expiryTimestamp' | 'amount' | 'sellerEmail' | 'buyerEmail' | 'description' | 'status';
type SortDirection = 'asc' | 'desc';

// Derive status from local contract data
const getDerivedStatus = (contract: PendingContract) => {
  const now = Date.now() / 1000;
  
  // If has chain address, it's deployed
  if (contract.chainAddress) {
    return 'DEPLOYED';
  }
  
  // If has buyer email, it's been accepted
  if (contract.buyerEmail) {
    return 'ACCEPTED';
  }
  
  // Check if expired
  if (contract.expiryTimestamp && now > contract.expiryTimestamp) {
    return 'EXPIRED';
  }
  
  return 'PENDING';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'DEPLOYED':
      return 'bg-green-100 text-green-800';
    case 'ACCEPTED':
      return 'bg-blue-100 text-blue-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'EXPIRED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function AdminDatabaseList({ onContractSelect }: AdminDatabaseListProps) {
  const [contracts, setContracts] = useState<PendingContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('ALL');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Date range options
  const getDateRange = (range: string) => {
    const now = Math.floor(Date.now() / 1000);
    const dayInSeconds = 24 * 60 * 60;
    
    switch (range) {
      case 'TODAY':
        return { from: now - dayInSeconds, to: now };
      case 'WEEK':
        return { from: now - (7 * dayInSeconds), to: now };
      case 'MONTH':
        return { from: now - (30 * dayInSeconds), to: now };
      case 'QUARTER':
        return { from: now - (90 * dayInSeconds), to: now };
      case 'YEAR':
        return { from: now - (365 * dayInSeconds), to: now };
      default:
        return { from: now - (365 * dayInSeconds), to: now }; // Default to last year
    }
  };

  const fetchContracts = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const { from, to } = getDateRange(dateRangeFilter);
      
      const response = await fetch('/api/contracts/admin/database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          createdTimestampFrom: from,
          createdTimestampTo: to,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contracts: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from server');
      }

      setContracts(data);
    } catch (error: any) {
      console.error('Failed to fetch admin contracts:', error);
      setError(error.message || 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [dateRangeFilter]);

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
        contract.amount?.toString().includes(searchLower) ||
        contract.id?.toLowerCase().includes(searchLower)
      );

      // Status filter
      const derivedStatus = getDerivedStatus(contract);
      const matchesStatus = statusFilter === 'ALL' || derivedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchTerm, statusFilter]);

  // Sort logic
  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Special handling for derived status
      if (sortField === 'status') {
        aValue = getDerivedStatus(a);
        bValue = getDerivedStatus(b);
      } else {
        // Safe access to contract properties
        aValue = (a as any)[sortField];
        bValue = (b as any)[sortField];
      }

      // Handle timestamps
      if (sortField === 'createdAt') {
        aValue = normalizeTimestamp(aValue);
        bValue = normalizeTimestamp(bValue);
      }

      // Handle numbers
      if (sortField === 'amount' || sortField === 'expiryTimestamp') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      // Handle strings
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }

      // Handle null/undefined values
      if (!aValue && !bValue) return 0;
      if (!aValue) return sortDirection === 'asc' ? -1 : 1;
      if (!bValue) return sortDirection === 'asc' ? 1 : -1;

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
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
  };

  useEffect(() => {
    handleFilterChange();
  }, [searchTerm, statusFilter]);

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
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Local Database Contracts</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                LOCAL DB
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Showing {paginatedContracts.length} of {sortedContracts.length} contracts from local storage
              {dateRangeFilter !== 'ALL' && ` (${dateRangeFilter.toLowerCase()} range)`}
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
              <option value="DEPLOYED">Deployed</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="PENDING">Pending</option>
              <option value="EXPIRED">Expired</option>
            </select>
            
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="TODAY">Today</option>
              <option value="WEEK">Past Week</option>
              <option value="MONTH">Past Month</option>
              <option value="QUARTER">Past 3 Months</option>
              <option value="YEAR">Past Year</option>
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
                Seller {sortField === 'sellerEmail' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('buyerEmail')}
              >
                Buyer {sortField === 'buyerEmail' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seller Address
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('expiryTimestamp')}
              >
                Expiry {sortField === 'expiryTimestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('description')}
              >
                Description {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contract Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedContracts.map((contract) => {
              const derivedStatus = getDerivedStatus(contract);
              return (
                <tr 
                  key={contract.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onContractSelect?.(contract)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDateTimeWithTZ(contract.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {displayCurrency(contract.amount, contract.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.sellerEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.buyerEmail || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <ExpandableHash hash={contract.sellerAddress} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.expiryTimestamp ? formatDateTimeWithTZ(contract.expiryTimestamp) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(derivedStatus)}`}>
                      {derivedStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={contract.description}>
                      {contract.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contract.chainAddress ? (
                      <ExpandableHash hash={contract.chainAddress} />
                    ) : (
                      <span className="text-gray-400">-</span>
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
            {searchTerm || statusFilter !== 'ALL' 
              ? 'No contracts match your filters' 
              : `No contracts found for ${dateRangeFilter.toLowerCase()}`
            }
          </div>
          {(searchTerm || statusFilter !== 'ALL') && (
            <Button 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
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