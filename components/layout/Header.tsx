import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useNavigation } from '@/components/navigation/NavigationProvider';
import { useAuth } from '@/components/auth';
import { getSiteNameFromDomain } from '@/utils/siteName';
import MobileDrawer from './MobileDrawer';
import {
  Bars3Icon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

// Desktop-only nav links; the full list lives in the drawer.
const DESKTOP_NAV_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/merchant-savings-calculator', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
];

const SSR_DEFAULT_SITE_NAME = 'StableDrop';

export default function Header() {
  const router = useRouter();
  const [siteName, setSiteName] = useState(SSR_DEFAULT_SITE_NAME);
  // Render auth-dependent UI only after mount to avoid SSR hydration mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSiteName(getSiteNameFromDomain());
    setMounted(true);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { canGoBack, goBack } = useNavigation();
  const { isConnected } = useAuth();

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
            {/* Left side: Back button + site name */}
            <div className="flex items-center">
              {canGoBack && (
                <button
                  onClick={handleBack}
                  className="mr-3 p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
                </button>
              )}

              <Link href="/" className="flex flex-col">
                <span className="text-lg font-bold italic text-secondary-900 dark:text-white">
                  {siteName}
                </span>
                <span className="text-xs text-primary-600 dark:text-primary-400 -mt-1">
                  Escrow-protected payments
                </span>
              </Link>
            </div>

            {/* Right side: desktop nav + sign-in, then menu */}
            <div className="flex items-center gap-1">
              <nav className="hidden md:flex items-center gap-1 mr-2" aria-label="Primary">
                {DESKTOP_NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      router.pathname === link.href
                        ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                {mounted && (
                  <Link
                    href="/dashboard"
                    className={
                      isConnected
                        ? `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            router.pathname === '/dashboard'
                              ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20'
                              : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                          }`
                        : 'ml-1 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors'
                    }
                  >
                    {isConnected ? 'Dashboard' : 'Get Started'}
                  </Link>
                )}
              </nav>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
                aria-label="Open menu"
              >
                <Bars3Icon className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
              </button>
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