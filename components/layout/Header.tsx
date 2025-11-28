import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useNavigation } from '@/components/navigation/NavigationProvider';
import { getSiteNameFromDomain } from '@/utils/siteName';
import MobileDrawer from './MobileDrawer';
import {
  Bars3Icon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
export default function Header() {
  const router = useRouter();
  const siteName = getSiteNameFromDomain();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { canGoBack, goBack } = useNavigation();

  // Don't show header on plugin pages
  if (router.pathname === '/contract-create') {
    return null;
  }

  const handleBack = () => {
    goBack();
  };

  return (
    <>
      <header className="bg-white dark:bg-secondary-800 shadow-sm border-b border-secondary-200 dark:border-secondary-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Left side: Back button or Menu */}
            <div className="flex items-center">
              {canGoBack ? (
                <button
                  onClick={handleBack}
                  className="mr-3 p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
                </button>
              ) : (
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="mr-3 p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
                  aria-label="Open menu"
                >
                  <Bars3Icon className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
                </button>
              )}
              
              <Link href="/" className="flex flex-col">
                <span className="text-lg font-bold italic text-secondary-900 dark:text-white">
                  {siteName}
                </span>
                <span className="text-xs text-primary-600 dark:text-primary-400 -mt-1">
                  Conduit UCPI
                </span>
              </Link>
            </div>

            {/* Right side: Empty for now */}
            <div className="flex items-center">
              {/* Authentication moved to individual pages */}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <MobileDrawer 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />
    </>
  );
}