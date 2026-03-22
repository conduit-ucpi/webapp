import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useConfig } from '@/components/auth/ConfigProvider';
import { getChainShortName } from '@/utils/chainNames';

const SSR_DEFAULT_CHAIN_NAME = 'blockchain';

export default function Footer() {
  const { config } = useConfig();
  const [chainName, setChainName] = useState(SSR_DEFAULT_CHAIN_NAME);

  useEffect(() => {
    if (config) {
      setChainName(getChainShortName(config.chainId));
    }
  }, [config]);

  return (
    <footer className="border-t border-secondary-100 dark:border-secondary-800 bg-white dark:bg-secondary-900">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <p className="text-xs text-secondary-400 dark:text-secondary-500">
            &copy; 2026 Conduit UCPI. Secure escrow contracts on {chainName}. Company No. 880319.
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
            <Link href="/terms-of-service" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
              Privacy Policy
            </Link>
            <a href="mailto:info@conduit-ucpi.com" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
