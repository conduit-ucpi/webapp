import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import EnhancedDashboard from '@/components/dashboard/EnhancedDashboard';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthContextProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import DashboardTour from '@/components/onboarding/DashboardTour';

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const { web3authProvider, isLoading: isWeb3AuthInstanceLoading } = useWeb3AuthInstance();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();

  if (isLoading || isWeb3AuthInstanceLoading || isWalletAddressLoading) {
    return (
      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 w-48 bg-secondary-200 animate-pulse rounded mb-2" />
              <div className="h-4 w-96 bg-secondary-200 animate-pulse rounded" />
            </div>
            <div className="h-10 w-32 bg-secondary-200 animate-pulse rounded" />
          </div>
          <SkeletonCard className="mb-8" />
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !web3authProvider) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 mb-6">
          You need to connect your wallet to view your contracts.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8" data-tour="dashboard-header">
          <div>
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Dashboard</h1>
            <p className="mt-2 text-secondary-600 dark:text-secondary-300">
              Manage your escrow contracts and view transaction history
            </p>
          </div>

          <Link href="/create" data-tour="create-button">
            <Button className="bg-primary-500 hover:bg-primary-600">
              New Payment Request
            </Button>
          </Link>
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 p-6 mb-8" data-tour="wallet-section">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">Connected Wallet</h2>
              <div className="text-sm text-secondary-600 dark:text-secondary-300 mt-1">
                <ExpandableHash hash={walletAddress || ''} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-secondary-600 dark:text-secondary-400">Email</p>
              <p className="text-sm text-secondary-900 dark:text-white">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-secondary-200 dark:border-secondary-600">
            <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-3">Wallet Management</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/wallet">
                <Button variant="outline" size="sm" className="text-primary-600 border-primary-300 hover:bg-primary-50">
                  Manage Wallet
                </Button>
              </Link>
              <Link href="/buy-usdc">
                <Button variant="outline" size="sm" className="text-success-600 border-success-500 hover:bg-success-50">
                  Buy/Sell USDC
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-6">Your payment agreements</h2>
          <EnhancedDashboard />
        </div>
        
        <DashboardTour />
      </div>
    </div>
  );
}