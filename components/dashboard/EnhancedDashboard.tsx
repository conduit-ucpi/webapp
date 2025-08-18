import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { Contract, PendingContract } from '@/types';
import Button from '@/components/ui/Button';
import StatsCard from '@/components/ui/StatsCard';
import { Tabs, TabPanel, Tab } from '@/components/ui/Tabs';
import EnhancedContractCard from '@/components/contracts/EnhancedContractCard';
import { NoContractsEmptyState, SearchEmptyState, ErrorEmptyState } from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ContractAcceptance from '@/components/contracts/ContractAcceptance';
import ContractDetailsModal from '@/components/contracts/ContractDetailsModal';
import { displayCurrency } from '@/utils/validation';

type StatusFilter = 'ALL' | 'ACTION_NEEDED' | 'ACTIVE' | 'COMPLETED' | 'DISPUTED';

export default function EnhancedDashboard() {
  const { user } = useAuth();
  const [allContracts, setAllContracts] = useState<(Contract | PendingContract)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [contractToAccept, setContractToAccept] = useState<PendingContract | null>(null);
  const [showAcceptance, setShowAcceptance] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | PendingContract | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch contracts using the same API call
  const fetchContracts = async () => {
    try {
      const response = await fetch('/api/combined-contracts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }

      const contractsData = await response.json();
      
      if (!Array.isArray(contractsData)) {
        throw new Error('Invalid response format - expected array');
      }
      
      // Transform contracts into unified array (same logic as ContractList)
      const unified: (Contract | PendingContract)[] = [];
      
      contractsData.forEach((item: any) => {
        if (!item.contract) {
          return;
        }
        
        const contract = item.contract;
        
        if (!contract.chainAddress || !item.blockchainQuerySuccessful) {
          // Pending contract
          const pendingContract: PendingContract = {
            id: contract.id,
            sellerEmail: contract.sellerEmail || '',
            buyerEmail: contract.buyerEmail || '',
            amount: contract.amount || 0,
            currency: contract.currency || 'USDC',
            sellerAddress: contract.sellerAddress || '',
            expiryTimestamp: contract.expiryTimestamp || 0,
            chainId: contract.chainId,
            chainAddress: contract.chainAddress,
            description: contract.description || '',
            createdAt: contract.createdAt?.toString() || '',
            createdBy: contract.createdBy || '',
            state: contract.state || 'OK',
            adminNotes: contract.adminNotes || []
          };
          unified.push(pendingContract);
        } else {
          // Regular contract
          const regularContract: Contract = {
            id: contract.id,
            contractAddress: contract.chainAddress || '',
            buyerAddress: item.blockchainBuyerAddress || contract.buyerAddress || '',
            sellerAddress: item.blockchainSellerAddress || contract.sellerAddress || '',
            amount: parseFloat(item.blockchainAmount || contract.amount || '0'),
            expiryTimestamp: item.blockchainExpiryTimestamp || contract.expiryTimestamp || 0,
            description: contract.description || '',
            status: item.blockchainStatus || 'PENDING',
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
              .map(([key]) => key)
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
    fetchContracts();
    // Refresh every 30 seconds for near-expiry contracts
    const interval = setInterval(fetchContracts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats from contracts
  const stats = useMemo(() => {
    const now = Date.now() / 1000;
    
    const activeCount = allContracts.filter(c => 
      'contractAddress' in c && c.status === 'ACTIVE'
    ).length;
    
    const pendingCount = allContracts.filter(c => 
      !('contractAddress' in c) || c.status === 'CREATED' || c.status === 'PENDING'
    ).length;
    
    const completedCount = allContracts.filter(c => 
      'contractAddress' in c && (c.status === 'CLAIMED' || c.status === 'RESOLVED')
    ).length;
    
    const totalValue = allContracts.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    const actionNeededCount = allContracts.filter(c => {
      if (!('contractAddress' in c)) {
        // Pending contract - buyer needs to accept
        return user?.email === c.buyerEmail;
      }
      // Active contract - check if action needed
      const contract = c as Contract;
      const isBuyer = user?.walletAddress?.toLowerCase() === contract.buyerAddress?.toLowerCase();
      const isSeller = user?.walletAddress?.toLowerCase() === contract.sellerAddress?.toLowerCase();
      
      if (contract.status === 'ACTIVE') {
        if (isSeller && contract.expiryTimestamp <= now) return true; // Can claim
        if (isBuyer && contract.expiryTimestamp > now) return true; // Can dispute
      }
      return false;
    }).length;

    return {
      active: activeCount,
      pending: pendingCount,
      completed: completedCount,
      totalValue,
      actionNeeded: actionNeededCount
    };
  }, [allContracts, user]);

  // Filter contracts based on active tab and search
  const filteredContracts = useMemo(() => {
    let filtered = [...allContracts];
    
    // Apply tab filter
    switch (activeTab) {
      case 'ACTION_NEEDED':
        const now = Date.now() / 1000;
        filtered = filtered.filter(c => {
          if (!('contractAddress' in c)) {
            return user?.email === c.buyerEmail;
          }
          const contract = c as Contract;
          const isBuyer = user?.walletAddress?.toLowerCase() === contract.buyerAddress?.toLowerCase();
          const isSeller = user?.walletAddress?.toLowerCase() === contract.sellerAddress?.toLowerCase();
          
          if (contract.status === 'ACTIVE') {
            if (isSeller && contract.expiryTimestamp <= now) return true;
            if (isBuyer && contract.expiryTimestamp > now) return true;
          }
          return false;
        });
        break;
      case 'ACTIVE':
        filtered = filtered.filter(c => 
          'contractAddress' in c && c.status === 'ACTIVE'
        );
        break;
      case 'COMPLETED':
        filtered = filtered.filter(c => 
          'contractAddress' in c && (c.status === 'CLAIMED' || c.status === 'RESOLVED')
        );
        break;
      case 'DISPUTED':
        filtered = filtered.filter(c => 
          'contractAddress' in c && c.status === 'DISPUTED'
        );
        break;
    }
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.description?.toLowerCase().includes(search) ||
        c.buyerEmail?.toLowerCase().includes(search) ||
        c.sellerEmail?.toLowerCase().includes(search) ||
        ('contractAddress' in c && c.contractAddress?.toLowerCase().includes(search))
      );
    }
    
    // Sort by creation date, newest first
    filtered.sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? parseInt(a.createdAt) : a.createdAt;
      const bTime = typeof b.createdAt === 'string' ? parseInt(b.createdAt) : b.createdAt;
      return bTime - aTime;
    });
    
    return filtered;
  }, [allContracts, activeTab, searchTerm, user]);

  // Tab configuration
  const tabs: Tab[] = [
    { id: 'ALL', label: 'All', count: allContracts.length },
    { id: 'ACTION_NEEDED', label: 'Action Needed', count: stats.actionNeeded },
    { id: 'ACTIVE', label: 'Active', count: stats.active },
    { id: 'COMPLETED', label: 'Completed', count: stats.completed },
    { id: 'DISPUTED', label: 'Disputed', count: allContracts.filter(c => 
      'contractAddress' in c && c.status === 'DISPUTED'
    ).length }
  ];

  const handleContractAction = (contract: Contract | PendingContract, action: string) => {
    if (action === 'accept' && !('contractAddress' in contract)) {
      setContractToAccept(contract as PendingContract);
      setShowAcceptance(true);
    }
    // Handle other actions as needed
  };

  const handleContractClick = (contract: Contract | PendingContract) => {
    setSelectedContract(contract);
    // You can show a detailed modal or navigate to detail page
  };

  const handleViewDetails = (contract: Contract | PendingContract) => {
    setSelectedContract(contract);
    setShowDetailsModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      {/* Stats Cards - Mobile responsive grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Active"
          value={stats.active}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          }
        />
        <StatsCard
          title="Pending"
          value={stats.pending}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
        />
        <StatsCard
          title="Completed"
          value={stats.completed}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatsCard
          title="Total Value"
          value={displayCurrency(stats.totalValue, 'microUSDC')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Search Bar - Mobile optimized */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-secondary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as StatusFilter)}
        className="mb-6"
      />

      {/* Contract List or Empty State */}
      <TabPanel isActive={true}>
        {error ? (
          <ErrorEmptyState onRetry={fetchContracts} />
        ) : filteredContracts.length === 0 ? (
          searchTerm ? (
            <SearchEmptyState searchTerm={searchTerm} />
          ) : (
            <NoContractsEmptyState 
              userRole={activeTab === 'ALL' ? 'any' : 'seller'} 
            />
          )
        ) : (
          <div className="space-y-4">
            {filteredContracts.map((contract) => (
              <EnhancedContractCard
                key={contract.id || ('contractAddress' in contract ? contract.contractAddress : contract.chainAddress)}
                contract={contract}
                onAction={(action) => handleContractAction(contract, action)}
                onClick={() => handleContractClick(contract)}
                onViewDetails={() => handleViewDetails(contract)}
              />
            ))}
          </div>
        )}
      </TabPanel>

      {/* Contract Acceptance Modal */}
      {showAcceptance && contractToAccept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => {
                setShowAcceptance(false);
                setContractToAccept(null);
              }}
              className="absolute top-4 right-4 text-secondary-400 hover:text-secondary-600 z-10"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <ContractAcceptance
              contract={contractToAccept}
              onAcceptComplete={() => {
                setShowAcceptance(false);
                setContractToAccept(null);
                fetchContracts();
              }}
            />
          </div>
        </div>
      )}

      {/* Contract Details Modal */}
      {showDetailsModal && selectedContract && (
        <ContractDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedContract(null);
          }}
          contract={selectedContract}
        />
      )}
    </>
  );
}