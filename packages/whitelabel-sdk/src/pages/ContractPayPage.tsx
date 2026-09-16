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
import { reserveCounterfactualAddress } from '@/utils/contractTransactionSequence';
import { predictEscrowAddress } from '@/lib/counterfactualAddress';
import { resolveEscrowAddressSources } from '@/lib/escrow/escrowAddressSources';
import { getNetworkName } from '@/utils/networkUtils';
import { detectDevice } from '@/utils/deviceDetection';
import { useT } from '../i18n';
import { useOptionalBrand, useBrandSource } from '../theme/BrandProvider';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { useBrandedHref } from '../theme';

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
  const t = useT();
  const brandedHref = useBrandedHref();

  // A selected partner names itself on the pay button; otherwise the hostname
  // does, so the other first-party domains keep their own names.
  const brand = useOptionalBrand();
  const brandSource = useBrandSource();
  const payBrandName =
    brand && brandSource && brandSource !== 'default' ? brand.name : getSiteNameFromDomain();

  const router = useRouter();
  const { contractId } = router.query;
  const { config } = useConfig();
  const { user, authenticatedFetch, isLoading: authLoading, isConnected, address, refreshUserData } = useAuth();
  const {
    approveUSDC, depositToContract, depositFundsAsProxy,
    getWeb3Service, transferToContract, prewarmTransferToContract, getTokenBalance
  } = useSimpleEthers();
  const { runDirectPayment } = useContractPayment();

  // State
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [alreadyFunded, setAlreadyFunded] = useState(false);
  /**
   * True while the escrow is being read on arrival.
   *
   * Someone returning from Coinbase lands here before that read resolves, and
   * without this they are shown the payment-method chooser — which reads as "it
   * didn't work" for the several seconds until the funds are noticed and they
   * are moved on. Starts true whenever a chain address exists, so the chooser is
   * never the first thing a returning payer sees.
   */
  const [isCheckingEscrow, setIsCheckingEscrow] = useState(false);

  /**
   * Someone coming back mid-payment, most obviously from the Coinbase onramp.
   *
   * Anything that leaves the page loses local state, so without a marker in the URL they
   * return to the intro and the connect screen with their progress apparently lost — which
   * reads as "that failed" to someone who has just spent money.
   *
   * It used to say `method=qr`, because returning meant landing on the QR stage. There is no
   * QR stage now, and the marker never really meant "show the QR" — it meant "this person is
   * already paying". `method=qr` is still honoured so that anyone mid-onramp when this
   * deployed comes back to the right place.
   */
  const isResumingPayment =
    router.query.resuming === '1' || router.query.method === 'qr';

  useEffect(() => {
    if (!router.isReady) return;
    // Any non-null value skips the pre-payment screens; 'qr' is the honest one, since money
    // arriving from an onramp did not come from the connected wallet.
    if (isResumingPayment) setPaymentMethod('qr');
  }, [router.isReady, isResumingPayment]);

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
    { id: 'verify', label: t('status.verifying'), status: 'pending' },
    // Worked out before anything is signed, so it is a step the user passes through rather
    // than waits on. Listed because the next one sends real money to it, and "transferring to
    // escrow" reads oddly with nothing before it.
    { id: 'address', label: t('status.derivingAddress'), status: 'pending' },
    { id: 'transfer', label: t('status.transferring'), status: 'pending' },
    { id: 'confirm', label: t('status.confirming'), status: 'pending' },
    { id: 'activate', label: t('status.securingNow'), status: 'pending' },
    { id: 'complete', label: t('status.complete'), status: 'pending' }
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

  /**
   * The contract amount in whole tokens.
   *
   * The denominator is the SELECTED TOKEN's decimals, from SUPPORTED_TOKENS —
   * not a hardcoded 1e6. That happens to be right for USDC and USDT and wrong
   * for anything else: an 18-decimal token divided by a million reads as a
   * balance twelve orders of magnitude too large, so every comparison against
   * it silently passes. Undefined while the token is still resolving, so
   * callers can tell "not yet" from "zero".
   */
  const requiredAmount = useMemo(() => {
    if (!contract || typeof selectedToken?.decimals !== 'number') return undefined;
    return contract.amount / 10 ** selectedToken.decimals;
  }, [contract, selectedToken?.decimals]);

  /**
   * Skip the payment-method chooser only when the money is already there.
   *
   * A deployed escrow does not mean funded: both the QR and Coinbase routes
   * create it first and fund it afterwards, and an abandoned attempt leaves an
   * empty one behind. So ask the chain. If the escrow already holds what the
   * contract needs, the only outstanding action is the sweep and the payer
   * should land on the button that runs it - that is the case where funds sit
   * unclaimable with nothing in the UI to finish them. If it is short, they
   * still have a payment to make, and choosing how is the right first step.
   *
   * Only ever runs for a contract that already has an address, so a first-time
   * payer costs no RPC call.
   */
  useEffect(() => {
    const escrowAddress = contract?.chainAddress;
    if (!escrowAddress || !selectedTokenAddress || requiredAmount === undefined) return;

    let cancelled = false;
    setIsCheckingEscrow(true);
    (async () => {
      try {
        // The escrow's own view first. isFunded() is true once a deposit has been
        // swept in, which is the only reliable way to tell a completed payment
        // from one whose money is sitting in the contract untouched — the stored
        // record cannot distinguish them.
        const web3 = await getWeb3Service();
        const state = await web3?.getContractState(escrowAddress);
        if (cancelled) return;

        if (state?.isFunded) {
          setAlreadyFunded(true);
          return;
        }

        const balance = await getTokenBalance(escrowAddress, selectedTokenAddress);
        if (cancelled) return;

        // Same >= comparison the activation gate uses, so the panel we land on
        // cannot disagree with the reason we landed there.
        if (parseFloat(balance) >= requiredAmount) {
          setPaymentMethod((current) => current ?? 'qr');
        }
      } catch (error) {
        // An unreadable balance is not a reason to guess. Leaving the chooser up
        // costs a click; asserting funds that are not there strands the payer.
        console.error('ContractPay: could not read escrow balance:', error);
      } finally {
        if (!cancelled) setIsCheckingEscrow(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // getTokenBalance comes from useSimpleEthers, which returns a fresh object
    // each render — depending on it here re-fires the effect every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.chainAddress, selectedTokenAddress, requiredAmount]);

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

  /**
   * Estimate the payment while the page is still settling, so the user does not wait for it.
   *
   * Pressing pay used to begin with three things that have nothing to do with the decision:
   * confirming the network, resolving the wallet address, and asking the chain what the
   * transfer will cost. All three can happen now, because the transaction is already fully
   * determined — the escrow address is computed from the deal's terms rather than discovered
   * by deploying something, so where the money goes is known before anyone asks to send it.
   *
   * Entirely speculative. It never throws, the estimate is only used for the exact
   * destination and calldata it was taken against, and if the user never pays it is simply
   * discarded.
   */
  useEffect(() => {
    if (!contract || !config || !address || !selectedTokenAddress) return;

    let cancelled = false;
    (async () => {
      try {
        const sources = resolveEscrowAddressSources({
          factoryAddress: config.contractFactoryAddress,
          implementationAddress: config.contractAddress,
          defaultArbiterAddress: config.defaultArbiterAddress
        });
        const escrowAddress = contract.chainAddress ?? predictEscrowAddress(
          sources.factoryAddress,
          sources.implementationAddress,
          {
            tokenAddress: selectedTokenAddress,
            buyer: address,
            seller: contract.sellerAddress,
            amount: contract.amount,
            expiryTimestamp: contract.expiryTimestamp,
            arbiter: contract.arbiterAddress || sources.defaultArbiterAddress,
            contractserviceId: contract.id
          }
        );
        if (cancelled) return;
        await prewarmTransferToContract(selectedTokenAddress, escrowAddress, String(contract.amount));
      } catch {
        // Nothing to report: this is work brought forward, not work required.
      }
    })();

    return () => { cancelled = true; };
  }, [contract, config, address, selectedTokenAddress, prewarmTransferToContract]);

  // QR-payment subsystem (countdown, balance polling, activation). The
  // page-specific creator (resolveOrCreateOnChainContract) and the on-activated
  // redirect (router.push('/dashboard')) are injected; all timing lives in the
  // hook. Behavior is unchanged from the previous inline implementation.
  const qr = useQrPayment({
    authenticatedFetch,
    getTokenBalance,
    selectedTokenAddress,
    chainId: config?.chainId,
    requiredAmount: requiredAmount ?? 0,
    requiredAmountMicro: contract?.amount ?? 0,
    // Deployed on an earlier visit: no need to create one, and the balance poll
    // should start against it immediately in case the money is already there.
    existingContractAddress: contract?.chainAddress ?? null,
    createContract: useCallback(async () => {
      if (!contract || !config || !address || !authenticatedFetch) return undefined;
      try {
        // Computed, not deployed. The QR used to cost a deployment and a wait purely to
        // obtain an address to draw in it - and paid that cost even for the codes nobody
        // ever scans, which for a "pay whenever you like" flow is most of them.
        const sources = resolveEscrowAddressSources({
          factoryAddress: config.contractFactoryAddress,
          implementationAddress: config.contractAddress,
          defaultArbiterAddress: config.defaultArbiterAddress
        });
        const { contractAddress } = await reserveCounterfactualAddress(
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
          { authenticatedFetch, ...sources }
        );
        return contractAddress;
      } catch (error: any) {
        console.error('ContractPay: Failed to resolve contract for QR:', error);
        alert(error.message || t('err.prepareFailed'));
        return undefined;
      }
    }, [contract, config, address, authenticatedFetch, selectedTokenAddress, t]),
    // Deploy the escrow onto whatever arrived, rather than activating one that was
    // deployed up front. The terms travel with the call because the escrow does not exist
    // yet - there is nothing on-chain to read them from - and the factory travels with it
    // because a predicted address is only reachable from the factory that predicted it.
    activation: useMemo(() => ({
      endpoint: '/api/chain/deploy-and-activate',
      /**
       * These terms ARE the escrow's address, so they must be the ones it was derived from —
       * not whatever this session happens to hold now.
       *
       * The named buyer is not the wallet that pays. checkAndActivate never looks at who sent
       * the tokens, so a QR can be scanned and paid from anywhere; what fixes the address is
       * the wallet recorded as buyer when the contract was claimed. Send the connected wallet
       * instead and a payer who claimed on one device and activates on another computes a
       * different address, deploys an empty escrow there, and leaves the money sitting at the
       * original address with nothing able to reach it.
       *
       * Recorded values win; the session's own are the fallback for a contract this session
       * just claimed, where the local copy has not caught up yet.
       */
      buildBody: () => ({
        tokenAddress: contract?.tokenAddress || selectedTokenAddress,
        buyer: contract?.buyerAddress || address,
        seller: contract?.sellerAddress,
        amount: String(contract?.amount ?? 0),
        expiryTimestamp: contract?.expiryTimestamp,
        description: contract?.description,
        ...(contract?.arbiterAddress ? { arbiter: contract.arbiterAddress } : {}),
        contractserviceId: contract?.id,
        factoryAddress: contract?.factoryAddress || config?.contractFactoryAddress
      }),
    }), [contract, config, address, selectedTokenAddress]),
    onActivated: useCallback(() => {
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }, [router]),
  });

  /**
   * Resolve the escrow address as soon as the page can, so the QR is simply there.
   *
   * There is nothing to generate any more — the address is a function of the deal's terms —
   * so "generate payment link" was asking the user to authorise a wait that no longer exists.
   *
   * ⚠️ RESOLVING CLAIMS THE CONTRACT for this wallet, because a QR whose address nothing has
   *    recorded is one somebody can pay into and lose the money at. So opening a payment link
   *    now claims it for the wallet that opened it, and a buyer who views on their phone and
   *    then pays from a different wallet on a desktop will be refused. That was already true
   *    the moment they pressed "generate" — it is simply true earlier now.
   */
  useEffect(() => {
    if (!contract || !config || !address || !authenticatedFetch) return;
    // Paying yourself is refused anyway, so do not claim the contract to find that out.
    if (address.toLowerCase() === contract.sellerAddress?.toLowerCase()) return;
    if (qr.qrContractAddress) return;
    void qr.createContract();
    // qr.createContract is stable per its own deps; listing the whole qr object would re-run
    // this on every poll tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, config, address, authenticatedFetch, qr.qrContractAddress, qr.createContract]);

  // Handle wallet-connected payment (direct transfer)
  const handleWalletPayment = async () => {
    if (!contract || !config || !address) {
      console.error('ContractPay: Missing required data for payment');
      return;
    }

    console.log('ContractPay: Starting wallet payment process');

    // Reset to the wallet-flow steps (labels are page-specific; the hook drives statuses).
    setPaymentSteps([
      { id: 'verify', label: t('status.verifying'), status: 'pending' },
      // The escrow address is worked out before anything is signed, so it is a step the user
      // passes through rather than one they wait on. It is listed because the next step sends
      // real money to it — "transferring to escrow" reads oddly with nothing before it.
      { id: 'address', label: t('status.derivingAddress'), status: 'pending' },
      { id: 'transfer', label: t('status.transferring'), status: 'pending' },
      { id: 'confirm', label: t('status.confirming'), status: 'pending' },
      { id: 'activate', label: t('status.securingNow'), status: 'pending' },
      { id: 'complete', label: t('status.complete'), status: 'pending' }
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
        requiredAmount: requiredAmount ?? 0,
        authenticatedFetch,
        transferToContract,
        getWeb3Service,
        updatePaymentStep,
        setLoadingMessage,
        setBusy: setIsPaymentInProgress,
        getActiveStep,
        onSuccess: (result) => {
          console.log('ContractPay: Wallet payment completed successfully:', result);
          setLoadingMessage(t('status.completedRedirect'));
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        },
        // The escrow's address is computed from these, so they travel with the payment
        // rather than being looked up inside the hook.
        contractFactoryAddress: config?.contractFactoryAddress,
        implementationAddress: config?.contractAddress,
        defaultArbiterAddress: config?.defaultArbiterAddress,
        onError: (error) => {
          console.error('ContractPay: Wallet payment failed:', error);
          alert(error.message || t('err.paymentFailed'));
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

  const pageTitle = t('pay.docTitle', { brand: payBrandName });

  // Loading screen for initialization. The auth half of this is time-bounded so
  // a stalled rehydration falls through to the signed-out screens rather than
  // spinning forever; config is not, since without it nothing can render.
  //
  // Arriving back from the onramp counts as "auth is coming" even when
  // authLoading has already gone false: the wallet provider reconnects
  // asynchronously after the session is restored, and in that window someone who
  // is signed in was being shown the connect-wallet screen. Deliberately not
  // waiting for everyone — a genuinely signed-out visitor should not stare at a
  // spinner for the full rehydration timeout before being asked to connect.
  const returningFromPayment = isResumingPayment;

  if (!config || ((authLoading || returningFromPayment) && !isConnected && !address && !authWaitElapsed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-secondary-600 dark:text-secondary-300">{t('pay.loading')}</p>
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
          <h2 className="text-xl font-semibold text-red-600 mb-4">{t('pay.invalidLink')}</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">{t('pay.noId')}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">{t('common.goToDashboard')}</Button>
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
  // Reading the escrow: say so rather than offering to take a payment that may
  // already have been made. This is what a payer sees on returning from
  // Coinbase, and the chooser here reads as "that failed".
  if (paymentMethod === null && isCheckingEscrow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6">
          <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-secondary-600 dark:text-secondary-300">{t('pay.checking')}</p>
        </div>
      </div>
    );
  }

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
            {t('pay.title')}
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
            {t('pay.connectBlurb')}
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
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2 text-center">{t('pay.chooseHow')}</h2>
            <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4 text-center">{t('pay.notSure')}</p>

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
                    <p className="font-medium text-secondary-900 dark:text-white">{t('pay.withBrand', { brand: payBrandName })}</p>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">{t('pay.withBrandDetail')}</p>
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
                    <p className="font-medium text-secondary-900 dark:text-white">{t('pay.ownWallet')}</p>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">{t('pay.ownWalletDetail')}</p>
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
          <p className="mt-4 text-secondary-600 dark:text-secondary-300">{t('pay.loading')}</p>
        </div>
      </div>
    );
  }

  // The escrow reports the deposit already swept in: there is nothing to pay.
  if (alreadyFunded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">{t('pay.alreadyComplete')}</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">
            {t('pay.alreadyCompleteDetail')}
          </p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">{t('common.goToDashboard')}</Button>
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
          <h2 className="text-xl font-semibold text-red-600 mb-4">{t('pay.unableToProcess')}</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">{contractError}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">{t('common.goToDashboard')}</Button>
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
          <h2 className="text-xl font-semibold text-red-600 mb-4">{t('pay.notFound')}</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">{t('pay.notFoundDetail')}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">{t('common.goToDashboard')}</Button>
        </div>
      </div>
    );
  }

  // ================================================================
  // STAGE 3: Authenticated - Show payment UI based on method
  // ================================================================

  // Contract data derived values
  const amountInTokens = requiredAmount ?? 0;
  const balanceFloat = parseFloat(tokenBalance);
  const hasInsufficientBalance = balanceFloat < amountInTokens;
  const isInstantPayment = contract.expiryTimestamp === 0;
  const isSameAddress = address?.toLowerCase() === contract.sellerAddress?.toLowerCase();
  const networkName = config ? getNetworkName(config.chainId) : t('common.unknownNetwork');

  /**
   * There is no longer a payment *method* to be on.
   *
   * The page used to render one of two stages, because the QR could not be shown until an
   * escrow had been deployed to point it at. Every option is on one screen now, so the method
   * no longer decides what renders — `paymentMethod` survives only to carry someone back to
   * the right place after leaving for the onramp.
   */


  return (
    <div className="min-h-screen bg-white dark:bg-secondary-900 transition-colors">
      <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>

      <div className="container mx-auto p-6 max-w-md mx-auto">
        {/* Wallet address and balance are no longer repeated here — they live in
            the connected-wallet box inside PaymentActionPanel below. */}
        <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">{t('pay.requestHeading')}</h2>

          {/* Contract Details */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">{t('common.amount')}</span>
              <span className="font-medium text-lg text-secondary-900 dark:text-white">
                {displayCurrency(contract.amount, contract.currency || 'microUSDC')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">{t('common.seller')}</span>
              <span className="text-sm font-mono text-secondary-900 dark:text-white">{contract.sellerAddress.slice(0, 6)}...{contract.sellerAddress.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">{t('common.payoutDate')}</span>
              <span className="font-medium text-secondary-900 dark:text-white">
                {isInstantPayment ? t('pay.instantNoDelay') : formatDateTimeWithTZ(contract.expiryTimestamp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">{t('common.descriptionLabel')}</span>
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
                {t('pay.changeMethod')}
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* STAGE 3a: every way of paying, on one screen */}
          {/* ============================================================ */}
          {/*
              The QR used to live behind its own step, reached by pressing "generate payment
              link", because producing an address meant deploying a contract — slow, and
              costly enough that nobody would do it speculatively. The address is computed
              from the deal's terms now, so there is nothing to generate and nothing to wait
              for, and no reason for the options to be on separate screens.
          */}
          {(
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
                    {t(isInstantPayment ? 'pay.escrowInstant' : 'pay.escrowHeld', {
                      amount: displayCurrency(contract.amount, contract.currency || 'microUSDC'),
                    })}
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
                onPay={handleWalletPayment}
                // The QR is already below; nothing to switch to. Used by the onramp popup
                // handler as its "closed" callback, so it must stay callable.
                onPayFromExternalWallet={() => {
                  document.getElementById('pay-from-elsewhere')?.scrollIntoView({ behavior: 'smooth' });
                }}
                // Come back onto the payment screen rather than the intro: the funds will
                // have landed but still need sweeping in, and that button is here.
                addFundsReturnPath={brandedHref(`/contract-pay?contractId=${contractId}&resuming=1`)}
                // Reuses the QR route's resolver, so Coinbase is sent to the
                // address contractservice considers authoritative and no second
                // escrow is ever deployed.
                resolveEscrowAddress={async () => qr.qrContractAddress ?? (await qr.createContract()) ?? null}
              />

              {/* Paying from somewhere else: the address, a QR for it, and the button that
                  sweeps the funds in once they arrive. Previously a screen of its own.

                  Framed as one block on purpose. Both methods inside it are fire-and-forget
                  from our side — we cannot see an external transfer land — so pressing "I
                  have paid" is what actually secures the money. Left loose beneath the other
                  options, that button reads as unrelated to the code and address above it. */}
              {!isPaymentInProgress && !isSameAddress && (
                <div
                  id="pay-from-elsewhere"
                  className="mt-8 rounded-lg border border-secondary-300 dark:border-secondary-600 bg-secondary-50 dark:bg-secondary-800/50 p-5"
                >
                  <h3 className="text-base font-semibold text-secondary-900 dark:text-white mb-1">
                    {t('pay.elsewhereHeading')}
                  </h3>
                  <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
                    {t('pay.elsewhereLead')}
                  </p>
                  <QrPaymentPanel
                    qr={qr}
                    networkName={networkName}
                    tokenSymbol={selectedTokenSymbol}
                    amountInTokens={amountInTokens}
                    isMobileDevice={isMobileDevice}
                    copiedAddress={copiedAddress}
                    onCopyAddress={handleCopyAddress}
                    createButtonLabel={t('pay.payButton')}
                    createDisabled={isSameAddress}
                    createNote={isSameAddress ? t('err.payYourself') : undefined}
                    successMessage={t('pay.verifiedRedirectDashboard')}
                  />
                </div>
              )}
            </>
          )}

          {/* There is no separate QR screen any more. It existed because the escrow had to be
              deployed before an address could be shown, so paying from elsewhere meant a
              round trip through its own stage. The address is computed now, so the QR is on
              the screen above alongside every other way of paying. */}
        </div>
      </div>
    </div>
  );
}
