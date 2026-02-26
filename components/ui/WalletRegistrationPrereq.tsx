import { useState } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { btnPrimary, btnOutline } from '@/utils/landingStyles';

export default function WalletRegistrationPrereq() {
  const { config } = useConfig();
  const { connect, disconnect, isConnected, address } = useAuth();
  const [copied, setCopied] = useState(false);

  const currencyList = config?.supportedTokens?.length
    ? config.supportedTokens.map(t => t.symbol).join('/')
    : config?.tokenSymbol || 'USDC';

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = address;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegister = async () => {
    if (connect) {
      await connect('walletconnect');
    }
  };

  const registered = isConnected && address;

  return (
    <section
      className="border-t border-secondary-100 dark:border-secondary-800"
      aria-label="Wallet registration"
    >
      <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
        <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
          Prerequisites
        </p>
        <h2
          className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          {registered
            ? 'This wallet is going to receive your payments:'
            : 'Set up your wallet to receive payments.'}
        </h2>
        <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8 max-w-md">
          One-time setup. Your wallet address establishes the settlement endpoint for all {currencyList} transactions.
        </p>

        {registered ? (
          <div>
            <div className="flex items-center gap-3">
              <code className="text-sm text-secondary-900 dark:text-white bg-secondary-50 dark:bg-secondary-800 px-3 py-2 rounded break-all">
                {address}
              </code>
              <button
                onClick={copyAddress}
                className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors flex-shrink-0"
                title={copied ? 'Copied!' : 'Copy address'}
              >
                {copied ? (
                  <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={() => disconnect()}
              className={`${btnOutline} mt-4`}
            >
              Register a different address
            </button>
          </div>
        ) : (
          <button onClick={handleRegister} className={btnPrimary}>
            Register My Wallet
          </button>
        )}
      </div>
    </section>
  );
}
