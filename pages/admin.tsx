import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ContractCard from '@/components/contracts/ContractCard';
import PendingContractCard from '@/components/contracts/PendingContractCard';
import AdminDatabaseList from '@/components/admin/AdminDatabaseList';
import { normalizeTimestamp } from '@/utils/validation';
import DisputeResolutionModal from '@/components/admin/DisputeResolutionModal';
import { Contract, PendingContract } from '@/types';
import { useWalletAddress } from '@/hooks/useWalletAddress';

// Extended type for admin contracts that includes chain data
type AdminContract = PendingContract & {
  status?: 'PENDING_ACCEPTANCE' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED' | 'ERROR' | 'UNKNOWN' | 'AWAITING_FUNDING' | 'PENDING' | 'CREATED';
  funded?: boolean;
  fundedAt?: string;
  disputedAt?: string;
  resolvedAt?: string;
  claimedAt?: string;
  buyerAddress?: string;
  contractAddress?: string;
  notes?: string;
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const { walletAddress } = useWalletAddress();
  const router = useRouter();
  const [selectedContract, setSelectedContract] = useState<AdminContract | null>(null);
  const [detailedContract, setDetailedContract] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [rawContractData, setRawContractData] = useState<{
    contractservice: any;
    chainservice: any;
  } | null>(null);
  const [isLoadingRawData, setIsLoadingRawData] = useState(false);

  const fetchDetailedContract = async (contractId: string) => {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contract details');
      }
      const data = await response.json();
      setDetailedContract(data);
    } catch (error) {
      console.error('Failed to fetch contract details:', error);
      setDetailedContract(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const fetchRawContractData = async (contractId: string) => {
    setIsLoadingRawData(true);
    try {
      const response = await fetch(`/api/admin/contracts/raw?contractId=${contractId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch raw contract data');
      }
      const data = await response.json();
      setRawContractData(data);
    } catch (error) {
      console.error('Failed to fetch raw contract data:', error);
      setRawContractData(null);
    } finally {
      setIsLoadingRawData(false);
    }
  };

  const handleContractSelect = (contract: AdminContract) => {
    setSelectedContract(contract);
    fetchDetailedContract(contract.id);
    fetchRawContractData(contract.id);
  };

  const clearSelection = () => {
    setSelectedContract(null);
    setDetailedContract(null);
    setRawContractData(null);
  };

  const handleManageDispute = () => {
    setIsDisputeModalOpen(true);
  };

  // Check if contract has DISPUTED status on blockchain
  const isDisputedOnBlockchain = () => {
    return rawContractData?.chainservice?.data?.status === 'DISPUTED';
  };

  const handleDisputeModalClose = () => {
    setIsDisputeModalOpen(false);
  };

  const handleResolutionComplete = () => {
    // Refresh the contract list after dispute resolution
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
        <p className="text-gray-600 mb-6">
          You need to connect your wallet to access this page.
        </p>
        <ConnectWalletEmbedded useSmartRouting={true} />
      </div>
    );
  }

  // Check if user is authorized admin
  if (user.userType !== 'admin') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You are not authorized to access this page.
        </p>
        <p className="text-sm text-gray-500">
          Current user: {user.email}
        </p>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Administrative tools and system management
          </p>
        </div>

        {/* Admin Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin User Info</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Wallet Address:</span>
              <span className="font-mono text-sm">{walletAddress}</span>
            </div>
          </div>
        </div>

        {/* Contract List */}
        <div className="mb-8">
          <AdminDatabaseList onContractSelect={handleContractSelect} />
        </div>

        {/* Selected Contract Details */}
        {selectedContract && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-gray-900">Contract Details</h2>
                {isDisputedOnBlockchain() && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Disputed (Blockchain)
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                {isDisputedOnBlockchain() && (
                  <Button 
                    onClick={handleManageDispute}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Manage Dispute
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={clearSelection}
                  size="sm"
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Contract Card Display */}
            <div className="mb-6">
              {isLoadingDetails ? (
                <div className="flex justify-center items-center py-8">
                  <LoadingSpinner size="md" />
                  <span className="ml-2 text-gray-600">Loading contract details...</span>
                </div>
              ) : detailedContract ? (
                <div className="space-y-4">
                  {/* Contract Card based on detailed data */}
                  {detailedContract.chainAddress ? (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">Contract Card (from detailed data)</h3>
                      <ContractCard
                        contract={{
                          contractAddress: detailedContract.chainAddress,
                          buyerAddress: detailedContract.buyerAddress || '',
                          sellerAddress: detailedContract.sellerAddress,
                          amount: detailedContract.amount,
                          expiryTimestamp: detailedContract.expiryTimestamp,
                          description: detailedContract.description,
                          status: detailedContract.status || 'PENDING',
                          createdAt: normalizeTimestamp(detailedContract.createdAt) / 1000,
                          funded: detailedContract.funded,
                          fundedAt: detailedContract.fundedAt,
                          disputedAt: detailedContract.disputedAt,
                          resolvedAt: detailedContract.resolvedAt,
                          claimedAt: detailedContract.claimedAt,
                          buyerEmail: detailedContract.buyerEmail,
                          sellerEmail: detailedContract.sellerEmail,
                          notes: detailedContract.notes
                        }}
                        onAction={() => {}}
                      />
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">Pending Contract (from detailed data)</h3>
                      <PendingContractCard
                        contract={detailedContract}
                        currentUserEmail=""
                        onAccept={undefined}
                      />
                    </div>
                  )}

                  {/* Full Contract Details for Debugging */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                    <h3 className="text-md font-semibold text-gray-900 mb-4">Complete Contract Data (for debugging)</h3>
                    <div className="bg-white rounded-lg border border-purple-300 p-4 max-h-96 overflow-y-auto">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-mono">
                        {JSON.stringify(detailedContract, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="text-md font-semibold text-gray-900 mb-2">No Contract Details Available</h3>
                  <p className="text-gray-600 text-sm">
                    Failed to load detailed contract information from the contract service.
                  </p>
                </div>
              )}
            </div>

            {/* Raw Data Tickets */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Raw Service Data</h3>
              
              {isLoadingRawData ? (
                <div className="flex justify-center items-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Contract Service Data */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-blue-900">Local Storage</h4>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">ContractService</span>
                    </div>
                    
                    {rawContractData?.contractservice?.error ? (
                      <div className="text-red-600 text-sm">
                        Error: {rawContractData.contractservice.error}
                      </div>
                    ) : rawContractData?.contractservice?.data ? (
                      <div className="bg-white rounded border p-3 max-h-96 overflow-y-auto">
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                          {JSON.stringify(rawContractData.contractservice.data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">No data available</div>
                    )}
                  </div>

                  {/* Chain Service Data */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-green-900">Blockchain</h4>
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">ChainService</span>
                    </div>
                    
                    {rawContractData?.chainservice?.error ? (
                      <div className="text-red-600 text-sm">
                        Error: {rawContractData.chainservice.error}
                      </div>
                    ) : rawContractData?.chainservice?.message ? (
                      <div className="text-gray-500 text-sm">
                        {rawContractData.chainservice.message}
                      </div>
                    ) : rawContractData?.chainservice?.data ? (
                      <div className="bg-white rounded border p-3 max-h-96 overflow-y-auto">
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                          {JSON.stringify(rawContractData.chainservice.data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">No data available</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Development Info */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Development Mode</h3>
          <p className="text-yellow-700 text-sm">
            This admin panel is currently in development. Features will be added as needed.
            Access is restricted to authorized administrators only.
          </p>
        </div>
      </div>

      {/* Dispute Resolution Modal */}
      {selectedContract && (
        <DisputeResolutionModal
          isOpen={isDisputeModalOpen}
          onClose={handleDisputeModalClose}
          contractId={selectedContract.id}
          chainAddress={detailedContract?.chainAddress || selectedContract.chainAddress}
          onResolutionComplete={handleResolutionComplete}
        />
      )}
    </div>
  );
}