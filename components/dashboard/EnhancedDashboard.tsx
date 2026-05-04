import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import { Contract, PendingContract } from '@/types';
import Button from '@/components/ui/Button';
import StatsCard from '@/components/ui/StatsCard';
import { Tabs, TabPanel, Tab } from '@/components/ui/Tabs';
import EnhancedContractCard from '@/components/contracts/EnhancedContractCard';
import { 
  NoContractsEmptyState, 
  SearchEmptyState, 
  ErrorEmptyState, 
  ActiveContractsEmptyState,
  ActionNeededEmptyState,
  CompletedContractsEmptyState,
  DisputedContractsEmptyState
} from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ContractDetailsModal from '@/components/contracts/ContractDetailsModal';
import DisputeManagementModal from '@/components/contracts/DisputeManagementModal';
import ProgressChecklist from '@/components/onboarding/ProgressChecklist';
import { displayCurrency } from '@/utils/validation';
import { useToast } from '@/components/ui/Toast';
import { buildReportCsv, ReportRow } from '@/components/dashboard/reportExport';
import { WalletSigningError } from '@/lib/auth/errors/WalletSigningError';

type StatusFilter = 'ALL' | 'ACTION_NEEDED' | 'ACTIVE' | 'COMPLETED' | 'DISPUTED';

export default function EnhancedDashboard() {
  // Track renders
  const renderCount = React.useRef(0);
  renderCount.current++;
  console.log(`🔧 EnhancedDashboard RENDER #${renderCount.current}`);
  
  const { user, authenticatedFetch } = useAuth();
  const { showToast } = useToast();
  
  // Track what's changing in auth
  console.log(`🔧 Dashboard auth values:`, {
    hasUser: !!user,
    userEmail: user?.email,
    hasAuthenticatedFetch: !!authenticatedFetch,
    authFetchType: typeof authenticatedFetch
  });
  const router = useRouter();
  const [allContracts, setAllContracts] = useState<(Contract | PendingContract)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Prevent duplicate API calls
  const hasFetched = React.useRef(false);
  const [selectedContract, setSelectedContract] = useState<Contract | PendingContract | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [contractToManage, setContractToManage] = useState<Contract | null>(null);
  const [showManageDispute, setShowManageDispute] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Sample demo data
  const createDemoData = (): (Contract | PendingContract)[] => {
    const now = Date.now() / 1000;
    return [
      {
        id: 'demo-1',
        contractAddress: '0x1234567890abcdef',
        buyerAddress: '0xbuyer123',
        sellerAddress: user?.walletAddress || '0xseller456',
        amount: 500000000, // $500 in microUSDC
        expiryTimestamp: now + 7 * 24 * 60 * 60, // 7 days from now
        description: 'Website design project - 5 page responsive site',
        status: 'ACTIVE',
        createdAt: now - 24 * 60 * 60, // 1 day ago
        funded: true,
        buyerEmail: 'client@example.com',
        sellerEmail: user?.email || 'seller@example.com',
        productName: 'Website Design',
        adminNotes: [],
        disputes: []
      } as Contract,
      {
        id: 'demo-2',
        sellerEmail: user?.email || 'seller@example.com',
        buyerEmail: 'customer@business.com',
        amount: 1200000000, // $1200 in microUSDC
        currency: 'USDC',
        sellerAddress: user?.walletAddress || '0xseller456',
        expiryTimestamp: now + 3 * 24 * 60 * 60, // 3 days from now
        chainId: '43113',
        chainAddress: undefined,
        description: 'Logo design and brand identity package',
        createdAt: now - 2 * 24 * 60 * 60, // 2 days ago
        createdBy: user?.walletAddress || '0xseller456',
        state: 'OK',
        adminNotes: []
      } as PendingContract,
      {
        id: 'demo-3',
        contractAddress: '0xabcdef1234567890',
        buyerAddress: '0xbuyer789',
        sellerAddress: user?.walletAddress || '0xseller456',
        amount: 250000000, // $250 in microUSDC
        expiryTimestamp: now - 24 * 60 * 60, // Expired (1 day ago)
        description: 'Social media content creation - 10 posts',
        status: 'CLAIMED',
        createdAt: now - 10 * 24 * 60 * 60, // 10 days ago
        funded: true,
        buyerEmail: 'marketing@startup.com',
        sellerEmail: user?.email || 'seller@example.com',
        productName: 'Social Media Content',
        adminNotes: [],
        disputes: []
      } as Contract
    ];
  };

  // Fetch contracts using the same API call
  const fetchContracts = async () => {
    try {
      // If in demo mode, use sample data
      if (isDemoMode) {
        setAllContracts(createDemoData());
        setError('');
        setIsLoading(false);
        return;
      }

      if (!authenticatedFetch) {
        throw new Error('Authentication not available');
      }
      
      const response = await authenticatedFetch('/api/combined-contracts');
      
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

        // A contract is only pending if it has NO chainAddress in MongoDB
        // Blockchain query failures don't make a deployed contract "pending"
        if (!contract.chainAddress) {
          // Pending contract (not yet deployed)
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
            adminNotes: contract.adminNotes || [],
            ctaType: item.ctaType,
            ctaLabel: item.ctaLabel,
            ctaVariant: item.ctaVariant
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
            status: item.status || 'UNKNOWN',
            createdAt: contract.createdAt || 0,
            funded: item.blockchainFunded || false,
            buyerEmail: contract.buyerEmail,
            sellerEmail: contract.sellerEmail,
            productName: contract.productName,
            adminNotes: contract.adminNotes || [],
            disputes: contract.disputes || [],
            blockchainQueryError: item.blockchainError,
            blockchainStatus: item.blockchainStatus,
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
      if (error instanceof WalletSigningError) {
        showToast({
          type: 'error',
          title: "Couldn't sign in with your wallet",
          message: error.message,
          duration: 12000,
        });
        setError('Wallet sign-in failed — see notification for details.');
      } else {
        setError(error.message || 'Failed to load contracts');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowDemo = () => {
    setIsDemoMode(true);
    setIsLoading(true);
    fetchContracts();
  };

  const handleExitDemo = () => {
    setIsDemoMode(false);
    setIsLoading(true);
    fetchContracts();
  };

  // Refresh function that doesn't trigger main loading state
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // If in demo mode, use sample data
      if (isDemoMode) {
        setAllContracts(createDemoData());
        setError('');
        return;
      }

      if (!authenticatedFetch) {
        throw new Error('Authentication not available');
      }
      
      const response = await authenticatedFetch('/api/combined-contracts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }

      const contractsData = await response.json();
      
      if (!Array.isArray(contractsData)) {
        throw new Error('Invalid response format - expected array');
      }
      
      // Transform contracts into unified array (same logic as fetchContracts)
      const unified: (Contract | PendingContract)[] = [];
      
      contractsData.forEach((item: any) => {
        if (!item.contract) {
          return;
        }
        
        const contract = item.contract;

        // A contract is only pending if it has NO chainAddress in MongoDB
        // Blockchain query failures don't make a deployed contract "pending"
        if (!contract.chainAddress) {
          // Pending contract (not yet deployed)
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
            adminNotes: contract.adminNotes || [],
            ctaType: item.ctaType,
            ctaLabel: item.ctaLabel,
            ctaVariant: item.ctaVariant
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
            status: item.status || 'UNKNOWN',
            createdAt: contract.createdAt || 0,
            funded: item.blockchainFunded || false,
            buyerEmail: contract.buyerEmail,
            sellerEmail: contract.sellerEmail,
            productName: contract.productName,
            adminNotes: contract.adminNotes || [],
            disputes: contract.disputes || [],
            blockchainQueryError: item.blockchainError,
            blockchainStatus: item.blockchainStatus,
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
      console.error('Failed to refresh contracts:', error);
      if (error instanceof WalletSigningError) {
        showToast({
          type: 'error',
          title: "Couldn't sign in with your wallet",
          message: error.message,
          duration: 12000,
        });
        setError('Wallet sign-in failed — see notification for details.');
      } else {
        setError(error.message || 'Failed to refresh contracts');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportReport = async () => {
    if (!authenticatedFetch) {
      showToast({ type: 'error', title: 'Export failed', message: 'Authentication not available' });
      return;
    }

    const wallet = user?.walletAddress?.toLowerCase();
    if (!wallet) {
      showToast({ type: 'error', title: 'Export failed', message: 'Wallet address not available' });
      return;
    }

    setIsExporting(true);
    try {
      const response = await authenticatedFetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerWalletId: wallet })
      });

      if (!response.ok) {
        throw new Error(`Report request failed (${response.status})`);
      }

      const data = await response.json();
      const rows: ReportRow[] = Array.isArray(data?.results) ? data.results : [];
      const csv = buildReportCsv(rows);

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = (today.getMonth() + 1).toString().padStart(2, '0');
      const dd = today.getDate().toString().padStart(2, '0');
      const filename = `conduit-report-${wallet}-${yyyy}-${mm}-${dd}.csv`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export report:', err);
      showToast({
        type: 'error',
        title: 'Export failed',
        message: err?.message || 'Could not generate report'
      });
    } finally {
      setIsExporting(false);
    }
  };


  useEffect(() => {
    console.log('🔧 Dashboard useEffect triggered');
    console.log('🔧 Dashboard auth state:', { hasAuthenticatedFetch: !!authenticatedFetch, hasFetched: hasFetched.current });

    // Only fetch if we have authenticatedFetch available AND haven't fetched yet
    // With lazy loading, user might be null but authenticatedFetch will trigger auth on first API call
    if (authenticatedFetch && !hasFetched.current) {
      console.log('🔧 Calling fetchContracts - will trigger lazy auth if needed');
      hasFetched.current = true;
      fetchContracts();
    } else {
      console.log('🔧 Skipping fetchContracts - either no authenticatedFetch or already fetched');
    }
  }, [authenticatedFetch]); // Only depend on authenticatedFetch

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
      // Use backend-provided CTA variant only (case-insensitive)
      return c.ctaVariant?.toLowerCase() === 'action';
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
        filtered = filtered.filter(c => {
          // Use backend-provided CTA variant only (case-insensitive)
          return c.ctaVariant?.toLowerCase() === 'action';
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
    const isPending = !('contractAddress' in contract);
    // Any primary CTA on a pending contract is "pay this request" — route to /contract-pay.
    // The card sometimes emits 'view-details' as a fallback when it doesn't recognize the
    // backend's ctaType, which would otherwise open the details modal instead of paying.
    if (isPending && (action === 'accept' || action === 'view-details')) {
      router.push(`/contract-pay?contractId=${contract.id}`);
    } else if (action === 'manage' && 'contractAddress' in contract) {
      setContractToManage(contract as Contract);
      setShowManageDispute(true);
    } else if (action === 'view-details' || action === 'dispute' || action === 'claim') {
      // Open details modal for actions handled by ContractActions component
      setSelectedContract(contract);
      setShowDetailsModal(true);
    }
    // Note: 'dispute' and 'claim' actions are now handled by ContractActions component
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
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-amber-800">Demo Mode Active</h4>
                <p className="text-xs text-amber-700">You're viewing sample data to explore the interface.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitDemo}
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
            >
              Exit Demo
            </Button>
          </div>
        </div>
      )}

      {/* Progress Checklist for new users */}
      <ProgressChecklist />

      {/* Stats Cards - Mobile responsive grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-tour="stats-cards">
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
      <div className="mb-6" data-tour="search-bar">
        <div className="relative">
          <input
            type="text"
            placeholder="Search payment agreements..."
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

      {/* Section Header with Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4 sm:mb-0">Your payment agreements</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            className="w-full sm:w-auto"
          >
            {isRefreshing ? (
              <>
                <LoadingSpinner size="sm" className="w-4 h-4 mr-2" />
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </Button>
          <Button
            onClick={handleExportReport}
            variant="outline"
            size="sm"
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <>
                <LoadingSpinner size="sm" className="w-4 h-4 mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export Report
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div data-tour="filter-tabs">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as StatusFilter)}
          className="mb-6"
        />
      </div>

      {/* Contract List or Empty State */}
      <TabPanel isActive={true} children={
        error ? (
          <ErrorEmptyState onRetry={fetchContracts} />
        ) : filteredContracts.length === 0 ? (
          searchTerm ? (
            <SearchEmptyState searchTerm={searchTerm} />
          ) : (() => {
            // Show different empty states based on active tab
            switch (activeTab) {
              case 'ACTION_NEEDED':
                return <ActionNeededEmptyState />;
              case 'ACTIVE':
                return <ActiveContractsEmptyState />;
              case 'COMPLETED':
                return <CompletedContractsEmptyState />;
              case 'DISPUTED':
                return <DisputedContractsEmptyState />;
              default:
                return <NoContractsEmptyState 
                  userRole="any" 
                  onShowDemo={allContracts.length === 0 && !isDemoMode ? handleShowDemo : undefined}
                />;
            }
          })()
        ) : (
          <div className="space-y-4">
            {filteredContracts.map((contract) => (
              <div key={contract.id || ('contractAddress' in contract ? contract.contractAddress : contract.chainAddress)}>
                <EnhancedContractCard
                  contract={contract}
                  onAction={(action) => handleContractAction(contract, action)}
                  onClick={() => handleContractClick(contract)}
                  onViewDetails={() => handleViewDetails(contract)}
                />
              </div>
            ))}
          </div>
        )
      } />

      {/* Contract Details Modal */}
      {showDetailsModal && selectedContract && (
        <ContractDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedContract(null);
          }}
          contract={selectedContract}
          onRefresh={fetchContracts}
        />
      )}


      {/* Manage Dispute Modal */}
      {showManageDispute && contractToManage && (
        <DisputeManagementModal
          isOpen={showManageDispute}
          onClose={() => {
            setShowManageDispute(false);
            setContractToManage(null);
          }}
          contract={contractToManage}
          onRefresh={fetchContracts}
        />
      )}
    </>
  );
}