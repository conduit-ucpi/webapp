import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import { useWeb3AuthInstance } from '../auth/Web3AuthInstanceProvider';

export default function Header() {
  const { user, logout, isLoading } = useAuth();
  const { web3authProvider, isLoading: isWeb3AuthInstanceLoading } = useWeb3AuthInstance();

  const isAuthenticated = user && web3authProvider;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-gray-900 shadow-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-green-400">
              Conduit UCPI
            </Link>
          </div>

          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-300 hover:text-white">
              Home
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/create" className="text-gray-300 hover:text-white">
                  New Payment Request
                </Link>
                <Link href="/dashboard" className="text-gray-300 hover:text-white">
                  Dashboard
                </Link>
                <Link href="/wallet" className="text-gray-300 hover:text-white">
                  Wallet
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {isLoading || isWeb3AuthInstanceLoading ? (
              <div className="w-32 h-10 bg-gray-700 animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-300">
                  {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <ConnectWallet />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}