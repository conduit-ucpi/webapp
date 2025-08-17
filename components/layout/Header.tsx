import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import { useWeb3AuthInstance } from '../auth/Web3AuthContextProvider';
import {
  HomeIcon,
  PlusIcon,
  RectangleStackIcon,
  WalletIcon,
  QuestionMarkCircleIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';
export default function Header() {
  const { user, logout, isLoading } = useAuth();
  const { web3authProvider, isLoading: isWeb3AuthInstanceLoading } = useWeb3AuthInstance();

  const isAuthenticated = user && web3authProvider;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white shadow-sm border-b border-secondary-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex flex-col">
              <span className="text-xl font-bold italic text-secondary-900">
                Instant Escrow
              </span>
              <span className="text-xs text-primary-600 -mt-1">
                running on Conduit UCPI
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900">
              <HomeIcon className="w-4 h-4" />
              Home
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/create" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900">
                  <PlusIcon className="w-4 h-4" />
                  New Request
                </Link>
                <Link href="/dashboard" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900">
                  <RectangleStackIcon className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link href="/wallet" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900">
                  <WalletIcon className="w-4 h-4" />
                  Wallet
                </Link>
              </>
            )}
            <Link href="/faq" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900">
              <QuestionMarkCircleIcon className="w-4 h-4" />
              FAQ
            </Link>
            <Link href="/arbitration-policy" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900">
              <ScaleIcon className="w-4 h-4" />
              Arbitration
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            {isLoading || isWeb3AuthInstanceLoading ? (
              <div className="w-32 h-10 bg-secondary-100 animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-secondary-600">
                  {user.email}
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