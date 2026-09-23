import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useNavigation } from '@/components/navigation/NavigationProvider';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { useOptionalBrand, useBrandSource } from '@conduit-ucpi/whitelabel-sdk';
import MobileDrawer from './MobileDrawer';
import {
  Bars3Icon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const SSR_DEFAULT_SITE_NAME = 'Instant Escrow';

export default function Header() {
  const router = useRouter();
  const [siteName, setSiteName] = useState(SSR_DEFAULT_SITE_NAME);

  useEffect(() => {
    setSiteName(getSiteNameFromDomain());
  }, []);

  // A partner brand overrides the wordmark; the hostname still decides it
  // otherwise, so instantescrow.nz and usdcbay.com keep naming themselves. Only
  // an explicitly selected brand ('query' | 'session' | 'contract') counts as a
  // partner — the default resolution must not override the domain.
  const brand = useOptionalBrand();
  const brandSource = useBrandSource();
  const partnerBrand = brand && brandSource && brandSource !== 'default' ? brand : null;
  const displayName = partnerBrand ? partnerBrand.name : siteName;
  const displaySubtitle = partnerBrand?.tagline ?? 'Conduit UCPI';
  const partnerLogo = partnerBrand?.assets.logo;
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
                {partnerLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={partnerLogo}
                    alt={displayName}
                    style={{ height: partnerBrand?.assets.logoHeight ?? '1.75rem' }}
                    className="w-auto"
                  />
                ) : (
                  <span className="text-lg font-bold italic text-secondary-900 dark:text-white">
                    {displayName}
                  </span>
                )}
                <span className="text-xs text-primary-600 dark:text-primary-400 -mt-1">
                  {displaySubtitle}
                </span>
              </Link>
            </div>

            {/* Right side: Menu */}
            <div className="flex items-center">
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