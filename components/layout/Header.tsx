import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import ThemeToggle from '@/components/theme/ThemeToggle';
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

  const isAuthenticated = !!user;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white dark:bg-secondary-800 shadow-sm border-b border-secondary-200 dark:border-secondary-700 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex flex-col">
              <span className="text-xl font-bold italic text-secondary-900 dark:text-white">
                Instant Escrow
              </span>
              <span className="text-xs text-primary-600 dark:text-primary-400 -mt-1">
                running on Conduit UCPI
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white">
              <HomeIcon className="w-4 h-4" />
              Home
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/create" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white">
                  <PlusIcon className="w-4 h-4" />
                  New Request
                </Link>
                <Link href="/dashboard" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white">
                  <RectangleStackIcon className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link href="/wallet" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white">
                  <WalletIcon className="w-4 h-4" />
                  Wallet
                </Link>
              </>
            )}
            <Link href="/faq" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white">
              <QuestionMarkCircleIcon className="w-4 h-4" />
              FAQ
            </Link>
            <Link href="/arbitration-policy" className="flex items-center gap-1.5 text-secondary-600 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white">
              <ScaleIcon className="w-4 h-4" />
              Arbitration
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {isLoading ? (
              <div className="w-32 h-10 bg-secondary-100 dark:bg-secondary-700 animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-secondary-600 dark:text-secondary-300">
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