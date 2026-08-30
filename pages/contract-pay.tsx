import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { useTokenSelection } from '@/hooks/useTokenSelection';
import { useQrPayment } from '@/hooks/useQrPayment';
import { useLazyUserData } from '@/hooks/useLazyUserData';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useContractPayment } from '@/hooks/useContractPayment';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConnectPaymentStage from '@/components/contracts/ConnectPaymentStage';
import PaymentRequestIntro from '@/components/contracts/PaymentRequestIntro';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';
import CreateProgressSteps, { PAY_JOURNEY_STEPS } from '@/components/contracts/CreateProgressSteps';
import CustomArbiterNotice from '@/components/contracts/CustomArbiterNotice';
import PaymentProgress from '@/components/contracts/PaymentProgress';
import QrPaymentPanel from '@/components/contracts/QrPaymentPanel';
import { usePaymentSteps } from '@/hooks/usePaymentSteps';
import { usePayableContract } from '@/hooks/usePayableContract';
import { toMicroUSDC, toUSDCForWeb3, formatDateTimeWithTZ, displayCurrency } from '@/utils/validation';
import { resolveOrCreateOnChainContract } from '@/utils/contractTransactionSequence';
import { getNetworkName } from '@/utils/networkUtils';
import { detectDevice } from '@/utils/deviceDetection';

type PaymentMethod = 'wallet' | 'qr' | null;

/**
 * AppKit's AUTH (embedded wallet) connector rehydrates through an auth iframe.
 * Until that round-trip finishes, isConnected is false while authLoading is
 * true — and on a flaky connection it may never finish. An unbounded wait
 * leaves a buyer who followed an email link staring at a spinner, so give up
 * after this and render the signed-out screens instead. Connecting from there
 * is harmless if the session does rehydrate later.
 */
const AUTH_REHYDRATE_TIMEOUT_MS = 5000;

export default function ContractPay() {
  const router = useRouter();
  const { contractId } = router.query;
  const { config } = useConfig();
  const { user, authenticatedFetch, isLoading: authLoading, isConnected, address, refreshUserData } = useAuth();
  const {
    approveUSDC, depositToContract, depositFundsAsProxy,
    getWeb3Service, transferToContract, getTokenBalance
  } = useSimpleEthers();
  const { runDirectPayment, runLegacyPayment } = useContractPayment();

  // State
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);

  /**
   * Restore the panel from the URL.
   *
   * Payment method is local state, so any step that leaves the page — the
   * Coinbase onramp, most obviously — comes back to the method chooser with the
   * user's progress apparently lost. Carrying it in the query means they land
   * back on the "I have paid" panel, where the sweep is one button away.
   */
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.method === 'qr') setPaymentMethod('qr');
  }, [router.isReady, router.query.method]);
  // The intro is a landing step, not a stage: it shows once on arrival, and
  // "Change payment method" returns to the chooser rather than back to here.
  const [introDismissed, setIntroDismissed] = useState(false);
  // Bounds the wait on wallet rehydration — see AUTH_REHYDRATE_TIMEOUT_MS.
  const [authWaitElapsed, setAuthWaitElapsed] = useState(false);
  // "Choose how to pay" is no longer part of arriving at the page: someone who
  // follows a payment link already signed in goes straight to the payment
  // screen. It is only reachable by asking for it via "Change payment method".
  const [methodChoiceRequested, setMethodChoiceRequested] = useState(false);

  // QR flow state. The QR-payment subsystem (countdown, balance polling,
  // activation) lives in useQrPayment; the page keeps only the bits that are
  // not part of that subsystem (mobile-vs-deeplink rendering, clipboard copy).
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Fetch + validate the payable contract by id (one-shot, lazy-auth aware).
  const { contract, isLoadingContract, contractError } = usePayableContract({
    contractId,
    isConnected,
    address,
    authenticatedFetch,
  });

  // Payment step state + update algorithm live in usePaymentSteps; the initial
  // (wallet-flow) labels are page-specific.
  const {
    steps: paymentSteps,
    updateStep: updatePaymentStep,
    setSteps: setPaymentSteps,
    getActiveStep,
  } = usePaymentSteps([
    { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
    { id: 'transfer', label: 'Transferring funds to escrow', status: 'pending' },
    { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
    { id: 'activate', label: 'Activating contract', status: 'pending' },
    { id: 'complete', label: 'Payment complete', status: 'pending' }
  ]);

  console.log('ContractPay: Query params', { contractId });

  // Extract token symbol from contract's currency field
  const contractTokenSymbol = useMemo(() => {
    if (!contract?.currency) return undefined;
    return contract.currency.replace('micro', '').toUpperCase();
  }, [contract]);

  // Use centralized token selection logic
  const {
    selectedToken,
    selectedTokenSymbol,
    selectedTokenAddress,
    availableTokens
  } = useTokenSelection(config, contractTokenSymbol);

  // Lazy-auth one-shot user-data fetch (triggers SIWX if no session exists).
  useLazyUserData({ isConnected, address, user, refreshUserData });

  // Token balance (read-only). Enabled once the contract is loaded and the RPC
  // is configured; the hook also internally requires address + tokenAddress.
  const { tokenBalance, isLoadingBalance } = useTokenBalance({
    enabled: !!config?.rpcUrl && !!contract,
    address,
    tokenAddress: selectedTokenAddress,
    getTokenBalance,
  });

  // QR-payment subsystem (countdown, balance polling, activation). The
  // page-specific creator (resolveOrCreateOnChainContract) and the on-activated
  // redirect (router.push('/dashboard')) are injected; all timing lives in the
  // hook. Behavior is unchanged from the previous inline implementation.
  const qr = useQrPayment({
    authenticatedFetch,
    getTokenBalance,
    selectedTokenAddress,
    chainId: config?.chainId,
    requiredAmount: contract ? contract.amount / 1000000 : 0,
    requiredAmountMicro: contract?.amount ?? 0,
    createContract: useCallback(async () => {
      if (!contract || !config || !address || !authenticatedFetch) return undefined;
      try {
        // resolveOrCreateOnChainContract ensures we never deploy a second escrow
        // when one is already linked to this pending contract, and that the QR
        // address is the one contractservice considers authoritative.
        const { contractAddress: resolvedAddress } = await resolveOrCreateOnChainContract(
          {
            contractserviceId: contract.id,
            tokenAddress: selectedTokenAddress,
            buyer: address,
            seller: contract.sellerAddress,
            amount: contract.amount,
            expiryTimestamp: contract.expiryTimestamp,
            description: contract.description,
            arbiterAddress: contract.arbiterAddress
          },
          { authenticatedFetch, getWeb3Service }
        );
        console.log('ContractPay: QR escrow address resolved:', resolvedAddress);
        return resolvedAddress;
      } catch (error: any) {
        console.error('ContractPay: Failed to resolve contract for QR:', error);
        alert(error.message || 'Failed to prepare contract');
        return undefined;
      }
    }, [contract, config, address, authenticatedFetch, selectedTokenAddress, getWeb3Service]),
    onActivated: useCallback(() => {
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }, [router]),
  });

  /**
   * Pay from the connected wallet.
   *
   * Settlement is identical to the external-wallet route: a plain ERC-20
   * transfer to the escrow address, which is then swept in. The only difference
   * is how the transfer is originated — signed here rather than scanned — so
   * this reuses the same two calls the QR route makes (qr.createContract to
   * resolve the escrow, then transferToContract) and hands off to the same
   * panel, where the sweep can be waited out or triggered by hand.
   */
  const handlePayFromConnectedWallet = async () => {
    if (!contract || !config || !address) {
      console.error('ContractPay: Missing required data for payment');
      return;
    }

    setIsPaymentInProgress(true);
    try {
      setLoadingMessage('Preparing escrow contract...');
      // Reuses the QR route's creator, so the address is the one contractservice
      // considers authoritative and no second escrow is ever deployed.
      const escrowAddress = qr.qrContractAddress ?? (await qr.createContract());
      if (!escrowAddress) return;

      setLoadingMessage('Confirm the transfer in your wallet...');
      await transferToContract(selectedTokenAddress, escrowAddress, String(contract.amount));

      // Same destination as the QR, so the same panel picks it up from here:
      // it polls the escrow balance and offers manual activation.
      setPaymentMethod('qr');
    } catch (error: any) {
      console.error('ContractPay: Transfer to escrow failed:', error);
      alert(error?.message || 'Payment failed');
    } finally {
      setIsPaymentInProgress(false);
      setLoadingMessage('');
    }
  };

  // Handle wallet-connected payment (direct transfer)
  const handleWalletPayment = async () => {
    if (!contract || !config || !address) {
      console.error('ContractPay: Missing required data for payment');
      return;
    }

    console.log('ContractPay: Starting wallet payment process');

    // Reset to the wallet-flow steps (labels are page-specific; the hook drives statuses).
    setPaymentSteps([
      { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
      { id: 'transfer', label: 'Transferring funds to escrow', status: 'pending' },
      { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
      { id: 'activate', label: 'Activating contract', status: 'pending' },
      { id: 'complete', label: 'Payment complete', status: 'pending' }
    ]);

    await runDirectPayment(
      {
        contractserviceId: contract.id,
        tokenAddress: selectedTokenAddress,
        buyer: address,
        seller: contract.sellerAddress,
        amount: contract.amount,
        expiryTimestamp: contract.expiryTimestamp,
        description: contract.description,
        arbiterAddress: contract.arbiterAddress
      },
      {
        selectedTokenSymbol,
        tokenBalance,
        requiredAmount: contract.amount / 1000000,
        authenticatedFetch,
        transferToContract,
        approveUSDC,
        depositToContract,
        depositFundsAsProxy,
        getWeb3Service,
        updatePaymentStep,
        setLoadingMessage,
        setBusy: setIsPaymentInProgress,
        getActiveStep,
        onSuccess: (result) => {
          console.log('ContractPay: Wallet payment completed successfully:', result);
          setLoadingMessage('Payment completed! Redirecting...');
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        },
        onError: (error) => {
          console.error('ContractPay: Wallet payment failed:', error);
          alert(error.message || 'Payment failed');
        },
      }
    );
  };

  // Legacy payment handler (approve + deposit flow for backward compatibility)
  const handleLegacyPayment = async () => {
    if (!contract || !config || !address) {
      console.error('ContractPay: Missing required data for payment');
      return;
    }

    console.log('ContractPay: Starting legacy payment process');

    // Reset payment steps to legacy steps (labels are page-specific).
    setPaymentSteps([
      { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
      { id: 'approve', label: `Approving ${selectedTokenSymbol} payment`, status: 'pending' },
      { id: 'escrow', label: 'Securing funds in escrow', status: 'pending' },
      { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
      { id: 'complete', label: 'Payment complete', status: 'pending' }
    ]);

    await runLegacyPayment(
      {
        contractserviceId: contract.id,
        tokenAddress: selectedTokenAddress,
        buyer: address,
        seller: contract.sellerAddress,
        amount: contract.amount,
        expiryTimestamp: contract.expiryTimestamp,
        description: contract.description
      },
      {
        selectedTokenSymbol,
        tokenBalance,
        requiredAmount: contract.amount / 1000000,
        authenticatedFetch,
        transferToContract,
        approveUSDC,
        depositToContract,
        depositFundsAsProxy,
        getWeb3Service,
        updatePaymentStep,
        setLoadingMessage,
        setBusy: setIsPaymentInProgress,
        getActiveStep,
        onSuccess: (result) => {
          console.log('ContractPay: Legacy payment completed successfully:', result);
          setLoadingMessage('Payment completed! Redirecting...');
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        },
        onError: (error) => {
          console.error('ContractPay: Legacy payment failed:', error);
          alert(error.message || 'Payment failed');
        },
      }
    );
  };

  // Copy contract address to clipboard
  const handleCopyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // Detect mobile device for QR code vs deep link rendering
  useEffect(() => {
    const device = detectDevice();
    setIsMobileDevice(device.isMobile || device.isTablet);
  }, []);

  // Bound the wait on wallet rehydration — see AUTH_REHYDRATE_TIMEOUT_MS.
  useEffect(() => {
    const timer = setTimeout(() => setAuthWaitElapsed(true), AUTH_REHYDRATE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // ================================================================
  // RENDER SECTION
  // ================================================================

  const pageTitle = 'Pay Contract - Conduit UCPI';

  // Loading screen for initialization. The auth half of this is time-bounded so
  // a stalled rehydration falls through to the signed-out screens rather than
  // spinning forever; config is not, since without it nothing can render.
  if (!config || (authLoading && !isConnected && !address && !authWaitElapsed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-secondary-600 dark:text-secondary-300">Loading payment request...</p>
        </div>
      </div>
    );
  }

  // No contract ID provided
  if (!contractId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Invalid Payment Link</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">No payment request ID was provided.</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  // ================================================================
  // STAGE 0: Payment Request Intro
  // The landing step for a signed-out buyer arriving from an email link or QR
  // code. It shows no contract detail because none is readable until they sign
  // in — so someone who is already signed in has nothing to gain here and goes
  // straight through to the payment screen instead.
  // ================================================================
  if (paymentMethod === null && !introDismissed && !isConnected && !address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <PaymentRequestIntro onContinue={() => setIntroDismissed(true)} />
      </div>
    );
  }

  // ================================================================
  // STAGE 1: Payment Method Choice
  // Shown whenever no method is selected — including after the user
  // clicks "Change payment method" while already connected.
  // ================================================================
  // Not connected yet: the wallet gate, presented exactly as /create presents it.
  // The payment summary only renders once a contract has been loaded, which
  // cannot happen before the buyer is authenticated.
  if (paymentMethod === null && !isConnected && !address) {
    return (
      <div className="min-h-screen bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <CreateProgressSteps current={0} steps={PAY_JOURNEY_STEPS} />

          <h1 className="text-center text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white tracking-tight">
            Complete Your Payment
          </h1>

          {contract && (
            <div className="mt-8 rounded-2xl bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 p-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                  Pay to {contract.sellerEmail}
                </p>
                {contract.description && (
                  <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
                    &ldquo;{contract.description}&rdquo;
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-secondary-900 dark:text-white">
                  {displayCurrency(contract.amount, contract.currency || 'microUSDC')}
                </p>
                <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
                  {config ? getNetworkName(config.chainId) : ''}
                </p>
              </div>
            </div>
          )}

          <hr className="mt-10 border-secondary-200 dark:border-secondary-700" />

          <p className="mt-8 text-center text-lg text-secondary-600 dark:text-secondary-300">
            Connect a wallet to continue or we&apos;ll create one for you
          </p>

          {/* This is the pay journey, not /create: connecting here must drop the
              buyer straight into the payment stage rather than back to a choice
              screen. Selecting the method as part of success does that, and also
              stops the "Choose how to pay" branch below flashing up in the gap
              between isConnected flipping and this callback running. */}
          <WalletChoiceCards onSuccess={() => setPaymentMethod('wallet')} />
        </div>
      </div>
    );
  }

  // Reached only by asking for it via "Change payment method" — never on
  // arrival. The wallet gate above is meaningless once connected, so this stays
  // the method choice it always was.
  if (paymentMethod === null && methodChoiceRequested) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
          <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
          <div className="p-6 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2 text-center">Choose how to pay</h2>
            <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4 text-center">Not sure? If you don&apos;t already hold USDC in a crypto wallet, choose the first option.</p>

            <div className="space-y-3">
              {/* Wallet / sign-in option */}
              <button
                onClick={() => { setPaymentMethod('wallet'); setMethodChoiceRequested(false); }}
                className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 dark:text-white">Pay with Stabledrop</p>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">Sign in with Google, email, or connect a wallet like MetaMask. We&apos;ll help you get USDC if you don&apos;t have any yet.</p>
                  </div>
                </div>
              </button>

              {/* Own wallet / QR option */}
              <button
                onClick={() => { setPaymentMethod('qr'); setMethodChoiceRequested(false); }}
                className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 dark:text-white">Pay from my own wallet</p>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">Send USDC directly from your wallet app using a payment link or QR code.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
    );
  }

  // ================================================================
  // STAGE 2: Authentication (method chosen but user not yet connected)
  // ================================================================
  if (!isConnected && !address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <ConnectPaymentStage
          paymentMethod={paymentMethod ?? 'wallet'}
          onBack={() => { setPaymentMethod(null); setMethodChoiceRequested(true); }}
          onConnectSuccess={() => {
            console.log('ContractPay: Auth success callback triggered');
          }}
        />
      </div>
    );
  }

  // ================================================================
  // POST-AUTH GUARDS: Loading, errors, and not-found states
  // These only apply once the user is authenticated and we've attempted the contract fetch.
  // ================================================================

  // Loading contract after auth
  if (isLoadingContract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-secondary-600 dark:text-secondary-300">Loading payment request...</p>
        </div>
      </div>
    );
  }

  // Contract error
  if (contractError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Unable to Process Payment</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">{contractError}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Contract not found
  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Payment Request Not Found</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">The payment request could not be found.</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  // ================================================================
  // STAGE 3: Authenticated - Show payment UI based on method
  // ================================================================

  // Contract data derived values
  const amountInTokens = contract.amount / 1000000;
  const balanceFloat = parseFloat(tokenBalance);
  const hasInsufficientBalance = balanceFloat < amountInTokens;
  const isInstantPayment = contract.expiryTimestamp === 0;
  const isSameAddress = address?.toLowerCase() === contract.sellerAddress?.toLowerCase();
  const networkName = config ? getNetworkName(config.chainId) : 'Unknown Network';

  // If user connected without choosing a method (e.g., already connected), default to wallet
  const effectiveMethod = paymentMethod || 'wallet';

  return (
    <div className="min-h-screen bg-white dark:bg-secondary-900 transition-colors">
      <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>

      <div className="container mx-auto p-6 max-w-md mx-auto">
        {/* Wallet address and balance are no longer repeated here — they live in
            the connected-wallet box inside PaymentActionPanel below. */}
        <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Payment Request</h2>

          {/* Contract Details */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Amount:</span>
              <span className="font-medium text-lg text-secondary-900 dark:text-white">
                {displayCurrency(contract.amount, contract.currency || 'microUSDC')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Seller:</span>
              <span className="text-sm font-mono text-secondary-900 dark:text-white">{contract.sellerAddress.slice(0, 6)}...{contract.sellerAddress.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Payout Date:</span>
              <span className="font-medium text-secondary-900 dark:text-white">
                {isInstantPayment ? 'Instant (no delay)' : formatDateTimeWithTZ(contract.expiryTimestamp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Description:</span>
              <span className="text-right max-w-xs text-sm text-secondary-900 dark:text-white">{contract.description}</span>
            </div>
          </div>

          {/* Custom arbiter warning — only rendered when the seller has set a
              non-default arbiter address on the pending contract. */}
          <CustomArbiterNotice arbiterAddress={contract.arbiterAddress} />

          {/* Change payment method link (hidden while a payment is in progress) */}
          {!isPaymentInProgress && !qr.qrContractAddress && (
            <div className="mb-6 text-right">
              <button
                onClick={() => { setPaymentMethod(null); setMethodChoiceRequested(true); }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Change payment method
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* STAGE 3a: Wallet-Connected Payment */}
          {/* ============================================================ */}
          {effectiveMethod === 'wallet' && (
            <>
              {/* Payment Progress Steps */}
              {isPaymentInProgress && (
                <PaymentProgress steps={paymentSteps} loadingMessage={loadingMessage} />
              )}

              {/* Escrow reassurance. Stated once for the whole screen: the
                  signed-in wallet is the contract's buyer whichever route the
                  funds take, so this holds for all three. */}
              {!isPaymentInProgress && !hasInsufficientBalance && !isSameAddress && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    {isInstantPayment
                      ? `Your ${displayCurrency(contract.amount, contract.currency || 'microUSDC')} will be released to the seller immediately after payment confirmation.`
                      : `Your ${displayCurrency(contract.amount, contract.currency || 'microUSDC')} will be held securely in escrow and released to the seller on the payout date unless you raise a dispute.`
                    }
                  </p>
                </div>
              )}

              <PaymentActionPanel
                amountLabel={displayCurrency(contract.amount, contract.currency || 'microUSDC')}
                amountInTokens={amountInTokens}
                balanceFloat={balanceFloat}
                tokenSymbol={selectedTokenSymbol}
                tokenAddress={selectedTokenAddress}
                tokenDecimals={selectedToken?.decimals ?? 6}
                chainId={config?.chainId}
                walletAddress={address || ''}
                networkName={networkName}
                isLoadingBalance={isLoadingBalance}
                hasInsufficientBalance={hasInsufficientBalance}
                isSameAddress={isSameAddress}
                isPaymentInProgress={isPaymentInProgress}
                loadingMessage={loadingMessage}
                onPay={handlePayFromConnectedWallet}
                onPayFromExternalWallet={() => setPaymentMethod('qr')}
                // Come back on the "I have paid" panel — the funds will have
                // landed but still need sweeping in, and that button is here.
                addFundsReturnPath={`/contract-pay?contractId=${contractId}&method=qr`}
                // Reuses the QR route's resolver, so Coinbase is sent to the
                // address contractservice considers authoritative and no second
                // escrow is ever deployed.
                resolveEscrowAddress={async () => qr.qrContractAddress ?? (await qr.createContract()) ?? null}
              />
            </>
          )}

          {/* ============================================================ */}
          {/* STAGE 3b: QR Code Payment */}
          {/* ============================================================ */}
          {effectiveMethod === 'qr' && (
            <>
              <QrPaymentPanel
                qr={qr}
                networkName={networkName}
                tokenSymbol={selectedTokenSymbol}
                amountInTokens={amountInTokens}
                isMobileDevice={isMobileDevice}
                copiedAddress={copiedAddress}
                onCopyAddress={handleCopyAddress}
                createButtonLabel="Pay"
                createDisabled={isSameAddress}
                createNote={isSameAddress ? 'Cannot pay yourself - buyer and seller must be different accounts.' : undefined}
                onCancel={() => router.push('/dashboard')}
                successMessage="Your payment has been verified and the contract is now active. Redirecting to dashboard..."
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
