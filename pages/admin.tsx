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

  const handleContractSelect = (contract: AdminContract) => {
    setSelectedContract(contract);
  };

  const clearSelection = () => {
    setSelectedContract(null);
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
            <div className="flex justify-between items-center mb-4">
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
          onResolutionComplete={handleResolutionComplete}
        />
      )}
    </div>
  );
}