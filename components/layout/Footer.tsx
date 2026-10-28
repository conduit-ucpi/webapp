import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useConfig } from '@/components/auth/ConfigProvider';
import { getChainShortName } from '@/utils/chainNames';
import { openConsentSettings } from '@/lib/consent';
import { usePageT } from '@/config/locales';

export default function Footer() {
  const t = usePageT();
  const { config } = useConfig();
  // Null until the config names the chain, so SSR can show a translated generic word instead.
  const [chainName, setChainName] = useState<string | null>(null);

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
            {t('footer.copyright', {
              year: 2026,
              company: 'Conduit UCPI',
              chain: chainName ?? t('footer.genericChain'),
            })}
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
            <Link href="/terms-of-service" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
              {t('footer.terms')}
            </Link>
            <Link href="/privacy-policy" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
              {t('footer.privacy')}
            </Link>
            <button type="button" onClick={openConsentSettings} className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
              {t('footer.cookieSettings')}
            </button>
            <a href="mailto:info@stabledrop.me" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
              {t('footer.contact')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
