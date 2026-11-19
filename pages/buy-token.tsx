import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExchangeDirectory from '@/components/funding/ExchangeDirectory';
import FundingOptions from '@/components/funding/FundingOptions';
import WalletAddressBox from '@/components/funding/WalletAddressBox';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { getChainName } from '@/utils/chainNames';
import { useT } from '@/i18n';

const card = 'bg-white dark:bg-secondary-800 rounded-lg shadow-md dark:shadow-none p-6 sm:p-8';
const heading = 'text-xl font-bold text-secondary-900 dark:text-white';
const blurb = 'mt-1 text-sm text-secondary-600 dark:text-secondary-300';

/**
 * Every way we know to get the token into the connected wallet, on one page: FundingOptions with
 * no amount, so it asks. The payment screen shows the same component for what a payment is short
 * (PaymentActionPanel, "top up this wallet").
 *
 * The exchange list is shown signed out too: it needs no wallet to read, and a visitor may want to
 * open an account before they have one here.
 */
export default function BuyToken() {
  const t = useT();
  const { user, isLoading: authLoading } = useAuth();
  const { config, isLoading: configLoading } = useConfig();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();

  const tokens = useMemo(() => {
    if (config?.supportedTokens?.length) return config.supportedTokens;
    return config?.defaultToken ? [config.defaultToken] : [];
  }, [config]);
  const [chosenSymbol, setChosenSymbol] = useState<string | null>(null);
  const tokenSymbol = chosenSymbol ?? config?.defaultToken?.symbol ?? config?.tokenSymbol ?? 'USDC';
  const token = tokens.find((candidate) => candidate.symbol === tokenSymbol);

  const chainId = config?.chainId;
  // "Base", not "Base Mainnet": it is the word an exchange's withdrawal screen uses.
  const networkName = chainId === undefined ? '' : getChainName(chainId).replace(/ Mainnet$/, '');

  const showCoinbase = !!config?.coinbaseProjectId;
  const coinbase = useCoinbaseAvailability(showCoinbase);
  const coinbaseMinimum = useOnrampMinimum(tokenSymbol, showCoinbase)?.inTokens;

  if (authLoading || configLoading || isWalletAddressLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const connected = !!user && !!walletAddress;

  return (
    <div className="py-10 bg-white dark:bg-secondary-900 transition-colors">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">{t('buyToken.title', { token: tokenSymbol })}</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-300">
            {networkName ? t('buyToken.introOnNetwork', { network: networkName }) : t('buyToken.intro')}
          </p>
        </div>

        {connected && walletAddress ? (
          <>
            <section className={card} aria-labelledby="your-wallet">
              <h2 id="your-wallet" className={heading}>{t('buyToken.yourWallet')}</h2>
              <p className={blurb}>{t('buyToken.yourWalletBlurb', { token: tokenSymbol })}</p>
              <WalletAddressBox walletAddress={walletAddress} />
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-secondary-500 dark:text-secondary-400">{t('buyToken.network')}</dt>
                  <dd className="font-semibold text-secondary-900 dark:text-white">{networkName}</dd>
                </div>
                <div>
                  <dt className="text-secondary-500 dark:text-secondary-400">
                    <label htmlFor="buy-token-token">{t('buyToken.token')}</label>
                  </dt>
                  <dd className="font-semibold text-secondary-900 dark:text-white">
                    {tokens.length > 1 ? (
                      <select
                        id="buy-token-token"
                        value={tokenSymbol}
                        onChange={(e) => setChosenSymbol(e.target.value)}
                        className="rounded-md border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 px-2 py-1"
                      >
                        {tokens.map((candidate) => (
                          <option key={candidate.symbol} value={candidate.symbol}>{candidate.symbol}</option>
                        ))}
                      </select>
                    ) : (
                      tokenSymbol
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-300">
                {t('addFunds.sendOnly', { token: tokenSymbol, network: networkName })}
              </p>
            </section>

            <section className={card} aria-labelledby="ways-to-add">
              <h2 id="ways-to-add" className={heading}>{t('buyToken.ways', { token: tokenSymbol })}</h2>
              <p className={`${blurb} mb-5`}>
                {t('buyToken.waysBlurb')}
              </p>
              <FundingOptions
                // A fresh one per token, so nothing chosen for one is carried to the other.
                key={tokenSymbol}
                walletAddress={walletAddress}
                tokenSymbol={tokenSymbol}
                tokenAddress={token?.address}
                tokenDecimals={token?.decimals}
                chainId={chainId}
                networkName={networkName}
                minimumPurchase={coinbaseMinimum}
                coinbaseUnavailable={
                  coinbase.unavailable
                    ? t('paymentActionPanel.whyNoCoinbase', { country: coinbase.countryName ?? '' })
                    : undefined
                }
                coinbaseOverrule={{
                  label: t('paymentActionPanel.notInCountry', { country: coinbase.countryName ?? '' }),
                  onClick: coinbase.overrule,
                }}
                purpose="guide"
                exchangesOpen
              />
            </section>
          </>
        ) : (
          <>
            <section className={`${card} text-center`}>
              <h2 className={heading}>{t('buyToken.connect.title')}</h2>
              <p className={`${blurb} mb-6`}>
                {t('buyToken.connect.blurb')}
              </p>
              <ConnectWalletEmbedded useSmartRouting={true} />
            </section>
            <section className={card} aria-labelledby="buy-on-exchange">
              <h2 id="buy-on-exchange" className={`${heading} mb-2`}>{t('funding.exchanges.title', { token: tokenSymbol })}</h2>
              <ExchangeDirectory tokenSymbol={tokenSymbol} networkName={networkName} />
            </section>
          </>
        )}

        <p className="text-center text-sm text-secondary-500 dark:text-secondary-400">
          {t('buyToken.cashingOut')}{' '}
          <Link href="/wallet" className="underline hover:text-secondary-900 dark:hover:text-white">
            {t('buyToken.goToWallet')}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
