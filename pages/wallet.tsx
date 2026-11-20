import { useState, useEffect, useCallback } from 'react';
import type { GetStaticProps } from 'next';
import { isr } from '@/utils/isr';
import SEO from '@/components/SEO';
import { rampFactsAtBuild, type RampFacts } from '@/lib/server/rampFacts';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FundingOptions from '@/components/funding/FundingOptions';
import ExchangeDirectory from '@/components/funding/ExchangeDirectory';
import WalletAddressBox from '@/components/funding/WalletAddressBox';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { getChainName } from '@/utils/chainNames';
import { useT } from '@/i18n';
import { CashOutPanel } from '@conduit-ucpi/whitelabel-sdk';
import { ethers } from 'ethers';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { mLog } from '@/utils/mobileLogger';

interface WalletBalances {
  native: string;
  tokens: Record<string, string>; // keyed by token symbol
}

interface SendFormData {
  recipient: string;
  amount: string;
  currency: string; // 'NATIVE' or token symbol
}

const card = 'bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6 mb-8';
const sectionHeading = 'text-lg font-semibold text-secondary-900 dark:text-white';
const sectionBlurb = 'mt-1 text-sm text-secondary-600 dark:text-secondary-300';

/**
 * The wallet: what it holds, then the three things done with it, in the order money moves: add it
 * (FundingOptions, the same list /buy-token and the payment screen show), cash it out (Coinbase's
 * sell order, or by hand through an exchange) and send it on.
 */
export default function Wallet({ ramps }: { ramps?: RampFacts }) {
  const t = useT();
  const { user, state, isLoading: authLoading, getEthersProvider, showWalletUI, canExportWallet, exportWallet } = useAuth();
  // Embedded wallets only: the provider shows the key in its own isolated UI, never to this app.
  const showExport = typeof canExportWallet === 'function' && canExportWallet();
  const { fundAndSendTransaction, getNativeBalance, getTokenBalance, getUserAddress } = useSimpleEthers();
  const { isInFarcaster } = useFarcaster();
  const { config } = useConfig();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();
  // Using ethers directly instead of SDK
  const [balances, setBalances] = useState<WalletBalances>({ native: '0.0000', tokens: {} });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  // `ramps` is what the server knew when it wrote the page; the loaded config replaces it.
  const defaultTokenSymbol = config?.defaultToken?.symbol || config?.defaultTokenSymbol || ramps?.tokenSymbols[0] || 'USDC';
  const [sendForm, setSendForm] = useState<SendFormData>({
    recipient: '',
    amount: '',
    currency: defaultTokenSymbol
  });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // The token the "add" section is for. Cashing out names the default one: its panel has its own choice.
  const [addSymbol, setAddSymbol] = useState<string | null>(null);
  const addTokenSymbol = addSymbol ?? defaultTokenSymbol;
  const addToken = config?.supportedTokens?.find((token) => token.symbol === addTokenSymbol);
  // "Base", not "Base Mainnet": it is the word an exchange's deposit and withdrawal screens use.
  const chainId = config?.chainId ?? ramps?.chainId;
  const networkName = chainId === undefined ? '' : getChainName(chainId).replace(/ Mainnet$/, '');
  const showCoinbase = !!config?.coinbaseProjectId;
  const coinbase = useCoinbaseAvailability(showCoinbase);
  const coinbaseMinimum = useOnrampMinimum(addTokenSymbol, showCoinbase)?.inTokens;

  const loadBalances = useCallback(async () => {
    if (!user || !config || !walletAddress) {
      mLog.info('WalletPage', 'Skipping balance load - missing requirements', {
        hasUser: !!user,
        hasConfig: !!config,
        hasWalletAddress: !!walletAddress
      });
      console.log('Skipping balance load:', { user: !!user, config: !!config, walletAddress: !!walletAddress });
      return;
    }

    mLog.info('WalletPage', 'Starting balance load');
    mLog.info('WalletPage', '✅ NO WALLET ACCESS NEEDED - using READ-ONLY RPC provider');
    setIsLoadingBalances(true);
    try {
      console.log('🔧 Wallet: Loading balances via READ-ONLY RPC (no wallet access!)');

      // Fetch native balance + all supported token balances in parallel
      const supportedTokens = config.supportedTokens || [];
      const tokenBalancePromises = supportedTokens.map(token =>
        getTokenBalance(walletAddress, token.address)
          .then(balance => ({ symbol: token.symbol, balance }))
          .catch(err => {
            console.error(`Failed to fetch ${token.symbol} balance:`, err);
            return { symbol: token.symbol, balance: 'Error' };
          })
      );

      const [nativeBalance, ...tokenResults] = await Promise.all([
        getNativeBalance(walletAddress),
        ...tokenBalancePromises
      ]);

      const tokenBalances: Record<string, string> = {};
      for (const result of tokenResults) {
        tokenBalances[result.symbol] = result.balance;
      }

      mLog.info('WalletPage', '✅ Balances loaded successfully (no wallet interaction)', {
        native: nativeBalance,
        tokens: tokenBalances
      });
      console.log('✅ Balances loaded via READ-ONLY RPC:', {
        native: nativeBalance,
        tokens: tokenBalances
      });

      setBalances({
        native: nativeBalance,
        tokens: tokenBalances
      });
    } catch (error) {
      mLog.error('WalletPage', '❌ Error loading balances', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error ? error.constructor.name : 'unknown'
      });
      console.error('Error loading balances:', error);
      setBalances({ native: 'Error', tokens: {} });
    } finally {
      setIsLoadingBalances(false);
      mLog.info('WalletPage', 'Balance loading complete');
    }
  }, [user, config, walletAddress, getNativeBalance, getTokenBalance]);

  useEffect(() => {
    // Load balances when user is authenticated AND wallet is connected
    // This applies to ALL users (including Dynamic embedded wallet users)
    // Dynamic embedded wallet users get the same balance display as everyone else
    if (user && config && state?.isConnected) {
      loadBalances();
    }
    // Note: loadBalances is omitted from deps because it is memoized with useCallback
    // Including them would cause a render loop as their dependencies (getNativeBalance, getUSDCBalance, etc.)
    // may change identity on each render even though they're functionally stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, config, state?.isConnected]);

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !config) {
      setSendError(t('walletPage.send.notReady'));
      return;
    }

    setSendError(null);
    setSendSuccess(null);
    setIsSending(true);

    try {
      console.log('🔧 Wallet: Sending transaction via Web3Service');

      if (sendForm.currency === 'NATIVE') {
        // Send native token via fundAndSendTransaction
        const txHash = await fundAndSendTransaction({
          to: sendForm.recipient,
          data: '0x',
          value: ethers.parseEther(sendForm.amount).toString()
        });
        setSendSuccess(t('walletPage.send.sentNative', { hash: txHash }));
      } else {
        // Send ERC20 token via fundAndSendTransaction
        const token = config?.supportedTokens?.find(t => t.symbol === sendForm.currency);
        if (!token) {
          throw new Error(`Token ${sendForm.currency} not found in config`);
        }

        // Encode ERC20 transfer function call
        const tokenContract = new ethers.Contract(
          token.address,
          ['function transfer(address to, uint256 amount) returns (bool)']
        );

        const amountInSmallestUnit = ethers.parseUnits(sendForm.amount, token.decimals);

        const txData = tokenContract.interface.encodeFunctionData('transfer', [
          sendForm.recipient,
          amountInSmallestUnit
        ]);

        const txHash = await fundAndSendTransaction({
          to: token.address,
          data: txData
        });

        setSendSuccess(t('walletPage.send.sentToken', { token: token.symbol, hash: txHash }));
      }

      // Reset form and reload balances
      setSendForm({ recipient: '', amount: '', currency: defaultTokenSymbol });
      setTimeout(loadBalances, 2000); // Reload after 2 seconds
    } catch (error: any) {
      console.error('Send error:', error);
      setSendError(error.message || t('walletPage.send.failed'));
    } finally {
      setIsSending(false);
    }
  };

  const isValidAddress = (address: string) => {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  };

  const isValidAmount = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const maxBalance = currency === 'NATIVE'
      ? parseFloat(balances.native)
      : parseFloat(balances.tokens[currency] || '0');
    return !isNaN(num) && num > 0 && num <= maxBalance;
  };

  // The native token is chosen as 'NATIVE'; that is a value, not a word to show.
  const sendCurrencyLabel = sendForm.currency === 'NATIVE' ? t('walletPage.native') : sendForm.currency;

  const canSubmit = () => {
    return (
      isValidAddress(sendForm.recipient) &&
      isValidAmount(sendForm.amount, sendForm.currency) &&
      !isSending
    );
  };

  /*
   * ⚠️ WITH NO WALLET, THE PAGE IS STILL A PAGE: every way to add money and to cash out, laid out
   *    as it is for a signed-in user, with nothing to press. It is also what the SERVER writes,
   *    since the server never has a user, so it is the HTML a search engine or an AI agent reads.
   *    This used to be a spinner while sign-in resolved and a bare "connect your wallet" after,
   *    and the page a bot was sent had no content at all (2026-11-20).
   *
   *    So it must not wait on anything the browser loads: `ramps` (getStaticProps) says which
   *    chain, tokens and providers, and only the connect button waits for sign-in to settle.
   */
  if (authLoading || isWalletAddressLoading || !user || !walletAddress || isInFarcaster) {
    const settling = authLoading || isWalletAddressLoading;
    const catalogue = {
      coinbase: !!config?.coinbaseProjectId || !!ramps?.coinbase,
      card: !!ramps?.card,
    };
    return (
      <div className="py-10 bg-white dark:bg-secondary-900 transition-colors">
        <SEO
          title={`Add and cash out ${defaultTokenSymbol} - Stabledrop wallet`}
          description={`Every way to add ${defaultTokenSymbol} to a Stabledrop wallet and to cash it out: card, bank transfer, Coinbase, Kraken, Link, a transfer from another wallet, and exchanges by region.`}
          canonical="/wallet"
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">{t('walletPage.title')}</h1>
            <p className="mt-2 text-secondary-600 dark:text-secondary-300">{t('walletPage.subtitle')}</p>
            <nav className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
              {([['#add', 'walletPage.jump.add'], ['#cash-out', 'walletPage.jump.cashOut'], ['#send', 'walletPage.jump.send']] as const).map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-full border border-secondary-300 dark:border-secondary-600 px-4 py-1.5 text-secondary-700 dark:text-secondary-200 hover:border-primary-500"
                >
                  {t(label)}
                </a>
              ))}
            </nav>
          </div>

          <section className={`${card} text-center`} aria-labelledby="connect-heading">
            <h2 id="connect-heading" className={sectionHeading}>{t('walletPage.connect.title')}</h2>
            <p className={`${sectionBlurb} mb-6`}>{t('walletPage.connect.blurb')}</p>
            {settling ? (
              <div className="flex justify-center"><LoadingSpinner size="lg" /></div>
            ) : (
              <ConnectWalletEmbedded useSmartRouting={true} />
            )}
          </section>

          <section id="add" className={`${card} scroll-mt-4`} aria-labelledby="add-heading">
            <h2 id="add-heading" className={sectionHeading}>{t('walletPage.add.title', { token: defaultTokenSymbol })}</h2>
            <p className={`${sectionBlurb} mb-5`}>{t('walletPage.add.blurb')}</p>
            <FundingOptions
              walletAddress=""
              tokenSymbol={defaultTokenSymbol}
              chainId={chainId}
              networkName={networkName}
              purpose="guide"
              lookOnly
              catalogue={catalogue}
              exchangesOpen
            />
          </section>

          <div id="cash-out" className="scroll-mt-4">
            {catalogue.coinbase && (
              <section className={card} aria-labelledby="cash-out-heading">
                <h2 id="cash-out-heading" className={sectionHeading}>{t('cashOut.title')}</h2>
                <p className={sectionBlurb}>{t('cashOut.blurb')}</p>
              </section>
            )}
            <section className={card} aria-labelledby="cash-out-exchange-heading">
              <h2 id="cash-out-exchange-heading" className={sectionHeading}>
                {t('funding.sell.title', { token: defaultTokenSymbol })}
              </h2>
              <div className="mt-4">
                <ExchangeDirectory mode="sell" tokenSymbol={defaultTokenSymbol} networkName={networkName} />
              </div>
            </section>
          </div>

          <section id="send" className={`${card} scroll-mt-4`} aria-labelledby="send-heading">
            <h2 id="send-heading" className={sectionHeading}>{t('walletPage.send.title')}</h2>
            <p className={sectionBlurb}>{t('walletPage.send.blurb', { network: networkName })}</p>
          </section>
        </div>
      </div>
    );
  }

  // Note: We no longer have a special UI for embedded wallets
  // All users see the same full wallet interface below
  // Embedded wallet users get an additional button to open the Dynamic modal

  return (
    <div className="py-10 bg-white dark:bg-secondary-900 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">{t('walletPage.title')}</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-300">{t('walletPage.subtitle')}</p>
          <nav className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
            {([['#add', 'walletPage.jump.add'], ['#cash-out', 'walletPage.jump.cashOut'], ['#send', 'walletPage.jump.send']] as const).map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full border border-secondary-300 dark:border-secondary-600 px-4 py-1.5 text-secondary-700 dark:text-secondary-200 hover:border-primary-500"
              >
                {t(label)}
              </a>
            ))}
          </nav>
        </div>

        {/* Wallet Info */}
        <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">{t('walletPage.connected')}</h2>
              <WalletAddressBox walletAddress={walletAddress} />
              {networkName && (
                <div className="mt-2 flex items-center text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  <span className="font-medium text-secondary-700 dark:text-secondary-200">{networkName}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {showWalletUI && (
                <Button
                  onClick={async () => {
                    try {
                      await showWalletUI();
                    } catch (error) {
                      console.error('Failed to open wallet UI:', error);
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  {t('walletPage.manage')}
                </Button>
              )}
              {showExport && (
                <Button
                  onClick={async () => {
                    try {
                      await exportWallet();
                    } catch (error) {
                      console.error('Failed to open key export:', error);
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  {t('walletPage.exportKeys')}
                </Button>
              )}
              <Button
                onClick={() => loadBalances()}
                disabled={isLoadingBalances}
                variant="outline"
                size="sm"
              >
                {isLoadingBalances ? t('walletPage.refreshing') : t('walletPage.refresh')}
              </Button>
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Native Token Balance */}
            <div className="bg-gradient-to-r from-secondary-50 to-secondary-100 dark:from-secondary-800 dark:to-secondary-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-secondary-800 dark:text-secondary-100">{t('walletPage.nativeBalance')}</p>
                  <div className="flex items-center">
                    {isLoadingBalances ? (
                      <div className="w-16 h-6 bg-secondary-200 dark:bg-secondary-700 animate-pulse rounded" />
                    ) : (
                      <p className="text-2xl font-bold text-secondary-900 dark:text-white">{balances.native}</p>
                    )}
                    <span className="ml-2 text-sm text-secondary-700 dark:text-secondary-200">{networkName || t('walletPage.native')}</span>
                  </div>
                </div>
                <div className="w-10 h-10 bg-secondary-200 dark:bg-secondary-700 rounded-full flex items-center justify-center">
                  <span className="text-secondary-800 dark:text-secondary-200 font-bold text-sm">N</span>
                </div>
              </div>
            </div>

            {/* Supported Token Balances */}
            {(config?.supportedTokens || []).map((token) => (
              <div key={token.symbol} className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('walletPage.tokenBalance', { name: token.name })}</p>
                    <div className="flex items-center">
                      {isLoadingBalances ? (
                        <div className="w-16 h-6 bg-blue-200 dark:bg-blue-700 animate-pulse rounded" />
                      ) : (
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{balances.tokens[token.symbol] || '0.0000'}</p>
                      )}
                      <span className="ml-2 text-sm text-blue-700 dark:text-blue-300">{token.symbol}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-200 dark:bg-blue-700 rounded-full flex items-center justify-center">
                    <span className="text-blue-800 dark:text-blue-200 font-bold text-sm">{token.symbol.charAt(0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add: the same list /buy-token and the payment screen show, asking how much. */}
        <section id="add" className={`${card} scroll-mt-4`} aria-labelledby="add-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="add-heading" className={sectionHeading}>{t('walletPage.add.title', { token: addTokenSymbol })}</h2>
            {(config?.supportedTokens?.length ?? 0) > 1 && (
              <select
                aria-label={t('walletPage.add.token')}
                value={addTokenSymbol}
                onChange={(e) => setAddSymbol(e.target.value)}
                className="rounded-md border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white px-2 py-1 text-sm"
              >
                {(config?.supportedTokens || []).map((token) => (
                  <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
                ))}
              </select>
            )}
          </div>
          <p className={`${sectionBlurb} mb-5`}>{t('walletPage.add.blurb')}</p>
          <FundingOptions
            // A fresh one per token, so nothing chosen for one is carried to the other.
            key={addTokenSymbol}
            walletAddress={walletAddress}
            tokenSymbol={addTokenSymbol}
            tokenAddress={addToken?.address}
            tokenDecimals={addToken?.decimals}
            chainId={config?.chainId}
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
            returnPath="/wallet"
            purpose="guide"
            onFunded={loadBalances}
          />
        </section>

        {/* Cash out: Coinbase's sell order (it hides itself when Coinbase is unconfigured), then by
            hand through any exchange, which ends in the send form below. */}
        <div id="cash-out" className="scroll-mt-4">
          <CashOutPanel
            walletAddress={walletAddress}
            balances={balances.tokens}
            onSent={loadBalances}
          />
          <details className={card}>
            <summary className={`cursor-pointer ${sectionHeading}`}>
              {t('funding.sell.title', { token: defaultTokenSymbol })}
            </summary>
            <div className="mt-4">
              <ExchangeDirectory mode="sell" tokenSymbol={defaultTokenSymbol} networkName={networkName} />
            </div>
          </details>
        </div>

        {/* Send Funds */}
        <div id="send" className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6 scroll-mt-4">
          <h2 className={sectionHeading}>{t('walletPage.send.title')}</h2>
          <p className={`${sectionBlurb} mb-6`}>{t('walletPage.send.blurb', { network: networkName })}</p>

          <form onSubmit={handleSendSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
                {t('walletPage.send.currency')}
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center text-secondary-700 dark:text-secondary-200">
                  <input
                    type="radio"
                    name="currency"
                    value="NATIVE"
                    checked={sendForm.currency === 'NATIVE'}
                    onChange={(e) => setSendForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="mr-2"
                  />
                  {t('walletPage.native')}
                </label>
                {(config?.supportedTokens || []).map((token) => (
                  <label key={token.symbol} className="flex items-center text-secondary-700 dark:text-secondary-200">
                    <input
                      type="radio"
                      name="currency"
                      value={token.symbol}
                      checked={sendForm.currency === token.symbol}
                      onChange={(e) => setSendForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="mr-2"
                    />
                    {token.symbol}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
                {t('walletPage.send.recipient')}
              </label>
              <Input
                id="recipient"
                type="text"
                value={sendForm.recipient}
                onChange={(e) => setSendForm(prev => ({ ...prev, recipient: e.target.value }))}
                placeholder="0x..."
                className={sendForm.recipient && !isValidAddress(sendForm.recipient) ? 'border-red-300' : ''}
              />
              {sendForm.recipient && !isValidAddress(sendForm.recipient) && (
                <p className="text-sm text-red-600 mt-1">{t('walletPage.send.invalidAddress')}</p>
              )}
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
                {t('walletPage.send.amount')}
              </label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className={sendForm.amount && !isValidAmount(sendForm.amount, sendForm.currency) ? 'border-red-300' : ''}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-secondary-500 dark:text-secondary-400 text-sm">{sendCurrencyLabel}</span>
                </div>
              </div>
              {sendForm.amount && !isValidAmount(sendForm.amount, sendForm.currency) && (
                <p className="text-sm text-red-600 mt-1">
                  {t('walletPage.send.invalidAmount')}
                </p>
              )}
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
                {t('walletPage.send.available', {
                  balance: sendForm.currency === 'NATIVE' ? balances.native : (balances.tokens[sendForm.currency] || '0.0000'),
                  currency: sendCurrencyLabel,
                })}
              </p>
            </div>

            {sendError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-sm text-red-600">{sendError}</p>
              </div>
            )}

            {sendSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                <p className="text-sm text-green-600">{sendSuccess}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit()}
              className="w-full"
            >
              {isSending ? t('walletPage.send.sending') : t('walletPage.send.submit', { currency: sendCurrencyLabel })}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Written at build time, not per request: the public site is a static export with no server
 * behind its pages, so getServerSideProps cannot be used here (see rampFactsAtBuild). The box
 * build refreshes it every few minutes from its own environment.
 */
export const getStaticProps: GetStaticProps<{ ramps: RampFacts }> = async () => ({
  props: { ramps: await rampFactsAtBuild() },
  ...isr(300),
});
