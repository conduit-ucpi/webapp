import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ContractList from '@/components/contracts/ContractList';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Dashboard() {
  const { user, isLoading } = useAuth();

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
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
        <p className="text-gray-600 mb-6">
          You need to connect your wallet to view your contracts.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Manage your escrow contracts and view transaction history
            </p>
          </div>
          
          <Link href="/create">
            <Button className="bg-primary-500 hover:bg-primary-600">
              Create New Contract
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connected Wallet</h2>
              <p className="text-sm text-gray-600 font-mono mt-1">{user.walletAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-sm text-gray-900">{user.email}</p>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Contracts</h2>
          <ContractList />
        </div>
      </div>
    </div>
  );
}