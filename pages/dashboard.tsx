import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ContractList from '@/components/contracts/ContractList';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthInstanceProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const { web3authProvider, isLoading: isWeb3AuthInstanceLoading } = useWeb3AuthInstance();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();

  if (isLoading || isWeb3AuthInstanceLoading || isWalletAddressLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !web3authProvider) {
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
              New Payment Request
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connected Wallet</h2>
              <div className="text-sm text-gray-600 mt-1">
                <ExpandableHash hash={walletAddress || ''} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-sm text-gray-900">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Wallet Management</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/wallet">
                <Button variant="outline" size="sm" className="text-primary-600 border-primary-300 hover:bg-primary-50">
                  Manage Wallet
                </Button>
              </Link>
              <Link href="/buy-usdc?mode=buy">
                <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50">
                  Buy USDC
                </Button>
              </Link>
              <Link href="/buy-usdc?mode=sell">
                <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                  Sell USDC
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Your payment agreements</h2>
          <ContractList />
        </div>
      </div>
    </div>
  );
}