import Link from 'next/link';
import { useAuth } from '@/components/auth';
import EnhancedDashboard from '@/components/dashboard/EnhancedDashboard';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import DashboardTour from '@/components/onboarding/DashboardTour';

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();

  if (isLoading || isWalletAddressLoading) {
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

  if (!user) {
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


        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 p-4 mb-8" data-tour="wallet-section">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ExpandableHash hash={walletAddress || ''} className="text-sm" />
                  <span className="text-xs text-secondary-500 dark:text-secondary-400">•</span>
                  <span className="text-xs text-secondary-600 dark:text-secondary-400">{user.email}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link href="/wallet" className="group">
                <button 
                  className="p-1.5 text-secondary-700 dark:text-secondary-300 bg-secondary-50 dark:bg-secondary-700/50 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded-md transition-colors"
                  title="Manage Wallet"
                  aria-label="Manage Wallet"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l8-5 8 5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 13h2M7 16h4" />
                  </svg>
                </button>
              </Link>
              <Link href="/buy-usdc" className="group">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-900/20 hover:bg-success-100 dark:hover:bg-success-900/30 rounded-md transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Buy USDC</span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div>
          <EnhancedDashboard />
        </div>
        
        <DashboardTour />
      </div>
    </div>
  );
}