import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ContractCard from '@/components/contracts/ContractCard';
import PendingContractCard from '@/components/contracts/PendingContractCard';
import AdminContractList from '@/components/admin/AdminContractList';
import DisputeResolutionModal from '@/components/admin/DisputeResolutionModal';
import { Contract, PendingContract } from '@/types';

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
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [selectedContract, setSelectedContract] = useState<AdminContract | null>(null);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [rawContractData, setRawContractData] = useState<{
    contractservice: any;
    chainservice: any;
  } | null>(null);
  const [isLoadingRawData, setIsLoadingRawData] = useState(false);

  const fetchRawContractData = async (contractId: string) => {
    setIsLoadingRawData(true);
    try {
      const response = await fetch(`${router.basePath}/api/admin/contracts/raw?contractId=${contractId}`);
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
    fetchRawContractData(contract.id);
  };

  const clearSelection = () => {
    setSelectedContract(null);
    setRawContractData(null);
  };

  const handleAddressDispute = () => {
    setIsDisputeModalOpen(true);
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
        <ConnectWallet />
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
              <span className="font-mono text-sm">{user.walletAddress}</span>
            </div>
          </div>
        </div>

        {/* Contract List */}
        <div className="mb-8">
          <AdminContractList onContractSelect={handleContractSelect} />
        </div>

        {/* Selected Contract Details */}
        {selectedContract && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Contract Details</h2>
              <div className="flex space-x-2">
                {selectedContract.status === 'DISPUTED' && (
                  <Button 
                    onClick={handleAddressDispute}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Address Dispute
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
              {selectedContract.chainAddress ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-md font-semibold text-gray-900 mb-3">On-Chain Contract</h3>
                  <ContractCard
                    contract={selectedContract as unknown as Contract}
                    onAction={() => {}}
                  />
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-md font-semibold text-gray-900 mb-3">Pending Contract</h3>
                  <PendingContractCard
                    contract={selectedContract}
                    currentUserEmail=""
                    onAccept={undefined}
                  />
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

        {/* Admin Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">System Monitoring</h3>
            <p className="text-gray-600 text-sm mb-4">
              Monitor system health and performance metrics
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">User Management</h3>
            <p className="text-gray-600 text-sm mb-4">
              View and manage user accounts and permissions
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Contract Analytics</h3>
            <p className="text-gray-600 text-sm mb-4">
              View contract statistics and analytics
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">System Configuration</h3>
            <p className="text-gray-600 text-sm mb-4">
              Configure system settings and parameters
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Transaction Logs</h3>
            <p className="text-gray-600 text-sm mb-4">
              View detailed transaction logs and audit trails
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Emergency Controls</h3>
            <p className="text-gray-600 text-sm mb-4">
              Emergency system controls and overrides
            </p>
            <Button variant="outline" className="w-full text-red-600 border-red-300" disabled>
              Coming Soon
            </Button>
          </div>
        </div>

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
          chainAddress={selectedContract.chainAddress}
          onResolutionComplete={handleResolutionComplete}
        />
      )}
    </div>
  );
}