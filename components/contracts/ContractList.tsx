import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import { Contract } from '@/types';
import ContractCard from './ContractCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type StatusFilter = 'ALL' | 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED';
type SortOrder = 'expiry-asc' | 'expiry-desc' | 'created-asc' | 'created-desc';

export default function ContractList() {
  const { user } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('expiry-asc');

  const fetchContracts = async () => {
    if (!user?.walletAddress) return;

    try {
      const response = await fetch(`${router.basePath}/api/chain/contracts/${user.walletAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }
      
      const data = await response.json();
      setContracts(data.contracts || []);
      setError('');
    } catch (error: any) {
      console.error('Failed to fetch contracts:', error);
      setError(error.message || 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
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

  const handleContractAction = () => {
    fetchContracts(); // Refresh after any action
  };

  // Filter and sort contracts
  const filteredAndSortedContracts = useMemo(() => {
    let filtered = contracts;
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = contracts.filter(contract => contract.status === statusFilter);
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
  }, [contracts, statusFilter, sortOrder]);

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

  if (contracts.length === 0) {
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
          Showing {filteredAndSortedContracts.length} of {contracts.length} contracts
        </div>
      </div>

      {/* Contract Grid */}
      {filteredAndSortedContracts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-gray-600 mb-4">No contracts match your filters</div>
          <p className="text-gray-500">Try adjusting your filter settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedContracts.map((contract) => (
            <ContractCard
              key={contract.contractAddress}
              contract={contract}
              onAction={handleContractAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}