import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import PaymentProgress from '@/components/contracts/PaymentProgress';
import QrPaymentPanel from '@/components/contracts/QrPaymentPanel';
import { usePaymentSteps } from '@/hooks/usePaymentSteps';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConnectPaymentStage from '@/components/contracts/ConnectPaymentStage';
import WalletInfo from '@/components/ui/WalletInfo';
import TokenGuide from '@/components/ui/TokenGuide';
import CurrencyAmountInput from '@/components/ui/CurrencyAmountInput';
import { isValidWalletAddress, toMicroUSDC, toUSDCForWeb3, formatDateTimeWithTZ, displayCurrency } from '@/utils/validation';
import { useContractCreateValidation } from '@/hooks/useContractValidation';
import { getNetworkName } from '@/utils/networkUtils';
import { detectDevice } from '@/utils/deviceDetection';

console.log('🔧 ContractCreate: FILE LOADED - imports successful');


interface ContractCreateForm {
  seller: string;
  amount: string;
  description: string;
}

// FormErrors type now imported from validation hook

interface PostMessageEvent {
  type: 'contract_created' | 'payment_completed' | 'payment_cancelled' | 'payment_error' | 'close_modal';
  data?: any;
  error?: string;
}


type PaymentMethod = 'wallet' | 'qr' | null;

export default function ContractCreate() {

  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch, disconnect, isLoading: authLoading, isLoadingUserData, isConnected, address, refreshUserData } = useAuth();
  const { approveUSDC, depositToContract, depositFundsAsProxy, getWeb3Service, transferToContract, getTokenBalance } = useSimpleEthers();
  const { runDirectPayment, runLegacyPayment } = useContractPayment();
  const { errors, validateForm, clearErrors } = useContractCreateValidation();

  // Query parameters
  const {
    seller,
    amount,
    description,
    email: queryEmail,
    return: returnUrl,
    order_id,
    epoch_expiry,
    shop,
    product_id,
    variant_id,
    title,
    quantity,
    webhook_url,
    wordpress_source,
    tokenSymbol: queryTokenSymbol
  } = router.query;

  // Use centralized token selection logic
  const {
    selectedToken,
    selectedTokenSymbol,
    selectedTokenAddress,
    availableTokens
  } = useTokenSelection(config, queryTokenSymbol as string | undefined);

  // Debug logging for token selection (only on token changes)
  useEffect(() => {
    console.log('🔧 ContractCreate: Token selection details', {
      queryTokenSymbol,
      selectedTokenSymbol,
      selectedToken,
      selectedTokenAddress,
      availableTokens: availableTokens.map(t => t.symbol)
    });
  }, [selectedTokenSymbol, selectedToken, selectedTokenAddress, queryTokenSymbol, availableTokens]);

  const networkName = config ? getNetworkName(config.chainId) : 'Unknown Network';

  // Check if we're in an iframe or popup
  const [isInIframe, setIsInIframe] = useState(false);
  const [isInPopup, setIsInPopup] = useState(false);
  
  // Form state
  const [form, setForm] = useState<ContractCreateForm>({
    seller: '',
    amount: '',
    description: ''
  });
  // errors now provided by useContractCreateValidation hook
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [contractId, setContractId] = useState<string | null>(null);
  const [pendingExpiryTimestamp, setPendingExpiryTimestamp] = useState<number | null>(null);
  const [step, setStep] = useState<'create' | 'payment'>('create');
  // Payment step state + update algorithm live in usePaymentSteps; the initial
  // (wallet-flow) labels are page-specific.
  const {
    steps: paymentSteps,
    updateStep: updatePaymentStep,
    setSteps: setPaymentSteps,
    getActiveStep,
  } = usePaymentSteps([
    { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
    { id: 'transfer', label: `Transferring ${selectedTokenSymbol} to escrow`, status: 'pending' },
    { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
    { id: 'activate', label: 'Activating contract', status: 'pending' },
    { id: 'complete', label: 'Payment complete', status: 'pending' }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  // QR flow state. The QR-payment subsystem (countdown, balance polling,
  // activation) lives in useQrPayment; the page keeps only the bits outside
  // that subsystem (mobile-vs-deeplink rendering, clipboard copy).
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  console.log('🔧 ContractCreate: Hooks initialized', {
    hasConfig: !!config,
    authLoading,
    isConnected,
    address,
    hasUser: !!user,
    userEmail: user?.email,
    hasAuthenticatedFetch: !!authenticatedFetch,
    userWallet: user?.walletAddress,
    queryParams: { seller, amount, description, returnUrl, order_id, epoch_expiry },
    selectedTokenSymbol,
    selectedTokenAddress,
    queryTokenSymbol
  });

  console.log('🔧 ContractCreate: Auth state decision (with lazy auth support)', {
    willShowLoading: !config || (authLoading && !isConnected && !address),
    willShowAuth: !isConnected && !address,
    willShowForm: isConnected || !!address
  });

  // Don't clear auth on mount - let existing session persist
  // This prevents unnecessary signature requests when user already authenticated
  // The auth system will handle expired sessions automatically via refreshUserData

  // Initialize form from query parameters
  useEffect(() => {
    if (seller && amount && description) {
      setForm({
        seller: seller as string,
        amount: amount as string,
        description: description as string
      });
    }
  }, [seller, amount, description]);

  // Token balance (read-only), fetched as soon as a wallet is connected and the
  // RPC is configured. The hook internally also requires address + tokenAddress.
  const { tokenBalance, isLoadingBalance } = useTokenBalance({
    enabled: !!config?.rpcUrl,
    address,
    tokenAddress: selectedTokenAddress,
    getTokenBalance,
  });

  // Detect iframe and popup environment
  useEffect(() => {
    setIsInIframe(window !== window.parent);
    setIsInPopup(window.opener !== null);
  }, []);

  // Lazy-auth one-shot user-data fetch (triggers SIWX if no session exists).
  useLazyUserData({ isConnected, address, user, refreshUserData });

  // Send postMessage to parent window (iframe) or opener (popup)
  const sendPostMessage = (event: PostMessageEvent) => {
    // Send to iframe parent
    if (isInIframe && window.parent) {
      console.log('🔧 ContractCreate: Sending postMessage to iframe parent:', event);
      window.parent.postMessage(event, '*');
    }

    // Send to popup opener
    if (isInPopup && window.opener) {
      console.log('🔧 ContractCreate: Sending postMessage to popup opener:', event);
      window.opener.postMessage(event, '*');
    }
  };

  // Extract WordPress order key from return URL
  const getWordPressOrderKey = (): string | null => {
    if (!returnUrl || typeof returnUrl !== 'string') return null;
    try {
      const url = new URL(returnUrl);
      return url.searchParams.get('key');
    } catch {
      return null;
    }
  };

  // Helper function to build WordPress payment status URLs
  const buildWordPressStatusUrl = (status: 'completed' | 'cancelled' | 'error', additionalParams: Record<string, string> = {}): string => {
    if (!returnUrl || typeof returnUrl !== 'string' || !order_id || wordpress_source !== 'true') {
      return (typeof returnUrl === 'string') ? returnUrl : '/dashboard'; // Return original URL if not WordPress integration
    }

    try {
      const url = new URL(returnUrl);
      const orderId = order_id;

      // Extract order key from original return URL if it exists
      const orderKey = url.searchParams.get('key') || '';

      // Build new URL with /usdc-payment-status/ path
      const baseUrl = `${url.origin}/usdc-payment-status/${orderId}/`;
      const statusUrl = new URL(baseUrl);

      // Add required parameters
      if (orderKey) {
        statusUrl.searchParams.set('key', orderKey);
      }
      statusUrl.searchParams.set('payment_status', status);

      // Add additional parameters (contract_id, contract_hash, tx_hash, error, etc.)
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (value) {
          statusUrl.searchParams.set(key, value);
        }
      });

      console.log('🔧 ContractCreate: Built WordPress status URL:', statusUrl.toString());
      return statusUrl.toString();
    } catch (error) {
      console.error('🔧 ContractCreate: Failed to build WordPress status URL:', error);
      return (typeof returnUrl === 'string') ? returnUrl : '/dashboard'; // Fallback to original URL
    }
  };

  // validateForm function now provided by useContractCreateValidation hook

  // QR-payment subsystem (countdown, balance polling, activation). The page
  // injects how the on-chain contract is created (POST /api/chain/create-contract
  // using the DB-stored expiry) and what happens on activation (postMessage +
  // WordPress/iframe/popup/dashboard redirect). Timing lives in the hook;
  // behavior is unchanged from the previous inline implementation.
  const qr = useQrPayment({
    authenticatedFetch,
    getTokenBalance,
    selectedTokenAddress,
    chainId: config?.chainId,
    requiredAmount: parseFloat(form.amount) || 0,
    requiredAmountMicro: form.amount ? toMicroUSDC(parseFloat(form.amount.trim())) : 0,
    createContract: useCallback(async () => {
      if (!contractId || !config || !address || !authenticatedFetch) return undefined;
      if (pendingExpiryTimestamp === null) {
        console.error('🔧 ContractCreate: pendingExpiryTimestamp not set; cannot deploy without the DB-stored value');
        return undefined;
      }
      try {
        // Reuse the expiryTimestamp stored in the pending contract to avoid drift
        // between the DB value and the on-chain value (prevents ERROR status from
        // expiryTimestampMismatch in contractservice).
        const expiryTimestamp = pendingExpiryTimestamp;
        const createResponse = await authenticatedFetch('/api/chain/create-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractserviceId: contractId,
            tokenAddress: selectedTokenAddress,
            buyer: address,
            seller: form.seller,
            amount: toMicroUSDC(parseFloat(form.amount.trim())),
            expiryTimestamp,
            description: form.description
          })
        });
        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Contract creation failed');
        }
        const createData = await createResponse.json();
        console.log('ContractCreate: QR contract created:', createData);
        if (createData.transactionHash) {
          const web3Service = await getWeb3Service();
          await web3Service.waitForTransaction(createData.transactionHash, 120000, contractId);
        }
        return createData.contractAddress;
      } catch (error: any) {
        console.error('ContractCreate: Failed to create contract for QR:', error);
        alert(error.message || 'Failed to create contract');
        return undefined;
      }
    }, [contractId, config, address, authenticatedFetch, selectedTokenAddress, form, pendingExpiryTimestamp, getWeb3Service]),
    onActivated: useCallback((contractAddress: string) => {
      // Send payment completed event, then redirect using the same logic as the
      // wallet path (iframe → close_modal, popup → window.close, WordPress →
      // status URL, otherwise → dashboard).
      sendPostMessage({
        type: 'payment_completed',
        data: {
          contractId,
          amount: form.amount,
          description: form.description,
          seller: form.seller,
          orderId: order_id,
          contractAddress
        }
      });
      setTimeout(() => {
        if (isInIframe) {
          sendPostMessage({ type: 'close_modal' });
        } else if (isInPopup) {
          window.close();
        } else if (returnUrl && typeof returnUrl === 'string') {
          const completedUrl = buildWordPressStatusUrl('completed', {
            contract_id: contractId || '',
            contract_hash: contractAddress || ''
          });
          window.location.href = completedUrl;
        } else {
          router.push('/dashboard');
        }
      }, 2000);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contractId, form, order_id, isInIframe, isInPopup, returnUrl, router]),
  });

  // Create's success tail: webhook verification, Shopify order, postMessage, and
  // the iframe/popup/WordPress/dashboard redirect. Injected into the shared
  // payment hook as onSuccess so the orchestration stays shared while these
  // embed-specific side-effects remain here.
  const handlePaymentSuccess = async (result: any) => {
    console.log('ContractCreate: Payment completed:', result);

    // The transaction hash field differs by path: the direct/wallet sequence
    // returns transferTxHash; the legacy approve+deposit sequence returns
    // depositTxHash. They are mutually exclusive, so pick whichever is present.
    const txHash = result?.depositTxHash ?? result?.transferTxHash;

    // Webhook verification (if webhook_url provided)
    if (txHash && webhook_url && authenticatedFetch) {
      console.log('ContractCreate: Sending verification webhook');
      try {
        const verifyResponse = await authenticatedFetch('/api/payment/verify-and-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_hash: txHash,
            contract_address: result.contractAddress,
            contract_hash: result.contractAddress,
            contract_id: contractId,
            webhook_url: webhook_url,
            order_id: parseInt(order_id as string || '0'),
            expected_amount: parseFloat(form.amount),
            expected_recipient: result.contractAddress,
            merchant_wallet: form.seller
          })
        });

        if (!verifyResponse.ok) {
          console.error('ContractCreate: Payment verification failed:', await verifyResponse.text());
        } else {
          const verifyResult = await verifyResponse.json();
          console.log('ContractCreate: Payment verification sent:', verifyResult);
        }
      } catch (verifyError) {
        console.error('ContractCreate: Payment verification error:', verifyError);
      }
    }

    // Shopify order creation
    if (shop) {
      console.log('ContractCreate: Creating Shopify order for shop:', shop);
      try {
        const orderResponse = await fetch('/api/shopify/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: shop as string,
            orderId: order_id as string,
            contractId,
            productId: product_id as string,
            variantId: variant_id as string,
            title: title as string || form.description,
            price: form.amount,
            quantity: parseInt((quantity as string) || '1'),
            buyerEmail: user?.email || queryEmail as string,
            transactionHash: txHash
          })
        });

        const orderData = await orderResponse.json();
        console.log('ContractCreate: Shopify order result:', orderData);
      } catch (orderError) {
        console.error('ContractCreate: Failed to create Shopify order:', orderError);
      }
    }

    // Send payment completed postMessage
    sendPostMessage({
      type: 'payment_completed',
      data: {
        contractId,
        amount: form.amount,
        description: form.description,
        seller: form.seller,
        orderId: order_id,
        transactionHash: txHash
      }
    });

    setLoadingMessage('Payment completed! Redirecting...');

    // Handle redirect (same logic as existing handlePayment)
    if (isInIframe) {
      setTimeout(() => {
        sendPostMessage({ type: 'close_modal' });
      }, 2000);
    } else if (isInPopup) {
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      if (returnUrl && typeof returnUrl === 'string') {
        const completedUrl = buildWordPressStatusUrl('completed', {
          contract_id: contractId || '',
          contract_hash: result?.contractAddress || '',
          tx_hash: txHash || ''
        });
        window.location.href = completedUrl;
      } else {
        router.push('/dashboard');
      }
    }
  };

  // Create's error tail: postMessage error + WordPress error redirect / alert.
  const handlePaymentError = (error: Error) => {
    console.error('ContractCreate: Payment failed:', error);

    sendPostMessage({
      type: 'payment_error',
      error: error.message || 'Payment failed'
    });

    // WordPress error redirect
    if (wordpress_source === 'true' && returnUrl && typeof returnUrl === 'string') {
      const errorUrl = buildWordPressStatusUrl('error', {
        error: encodeURIComponent(error.message || 'Payment failed')
      });

      if (isInPopup && window.opener) {
        window.opener.location.href = errorUrl;
        window.close();
      } else if (!isInIframe) {
        window.location.href = errorUrl;
      }
    } else {
      if (isInPopup) {
        setTimeout(() => window.close(), 2000);
      } else if (!isInIframe) {
        alert(error.message || 'Payment failed');
      }
    }
  };

  const handleWalletPayment = async () => {
    if (!contractId || !config) {
      console.error('ContractCreate: Missing required data for wallet payment');
      return;
    }
    if (pendingExpiryTimestamp === null) {
      console.error('ContractCreate: pendingExpiryTimestamp not set; cannot deploy without the DB-stored value');
      return;
    }

    console.log('ContractCreate: Starting wallet payment (direct transfer)');

    // Reset payment steps (labels are page-specific; the hook drives statuses).
    setPaymentSteps([
      { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
      { id: 'transfer', label: `Transferring ${selectedTokenSymbol} to escrow`, status: 'pending' },
      { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
      { id: 'activate', label: 'Activating contract', status: 'pending' },
      { id: 'complete', label: 'Payment complete', status: 'pending' }
    ]);

    await runDirectPayment(
      {
        contractserviceId: contractId,
        tokenAddress: selectedTokenAddress,
        buyer: address || '',
        seller: form.seller,
        // Reuse the DB-stored expiry to avoid drift between DB and chain.
        amount: toMicroUSDC(parseFloat(form.amount.trim())),
        expiryTimestamp: pendingExpiryTimestamp,
        description: form.description
      },
      {
        selectedTokenSymbol,
        tokenBalance,
        requiredAmount: parseFloat(form.amount.trim()),
        authenticatedFetch,
        transferToContract,
        approveUSDC,
        depositToContract,
        depositFundsAsProxy,
        getWeb3Service,
        updatePaymentStep,
        setLoadingMessage,
        setBusy: setIsLoading,
        getActiveStep,
        onSuccess: handlePaymentSuccess,
        onError: handlePaymentError,
      }
    );
  };

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

  const handleCreateContract = async () => {
    console.log('🔧 ContractCreate: handleCreateContract called');

    const formValid = validateForm(
      form,
      { wordpress_source, webhook_url, order_id },
      { walletAddress: address } // Pass buyer wallet address for validation
    );
    console.log('🔧 ContractCreate: form validation result:', formValid);

    if (!formValid || !config) {
      console.log('🔧 ContractCreate: Early return due to validation or config issues');
      return;
    }

    console.log('🔧 ContractCreate: Starting contract creation process');
    console.log('🔧 ContractCreate: Using token:', {
      selectedTokenSymbol,
      selectedTokenAddress,
      selectedToken
    });
    setIsLoading(true);

    try {
      // Validate config before proceeding
      if (!selectedTokenAddress) {
        throw new Error(`${selectedTokenSymbol} contract address not configured. Please check server configuration.`);
      }
      
      // Check if wallet is connected and has address
      setLoadingMessage('Initializing...');
      console.log('🔧 ContractCreate: Wallet address:', address);

      if (!address) {
        console.error('🔧 ContractCreate: No wallet address found');
        throw new Error('Please connect your wallet first.');
      }
      
      // Create pending contract via Contract Service
      setLoadingMessage('Creating secure escrow contract...');
      
      // Parse epoch_expiry from query params if provided and valid
      let expiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // Default to 7 days

      if (epoch_expiry !== undefined) {
        const parsedExpiry = parseInt(epoch_expiry as string, 10);
        // Allow 0 for instant payments, or any future timestamp
        if (!isNaN(parsedExpiry) && (parsedExpiry === 0 || parsedExpiry > Math.floor(Date.now() / 1000))) {
          expiryTimestamp = parsedExpiry;
        } else {
          console.warn('Invalid or past epoch_expiry provided:', epoch_expiry);
        }
      }
      
      const pendingContractRequest = {
        buyerEmail: user?.email || (queryEmail as string) || 'noemail@notsupplied.com', // Prefer authenticated user's email
        sellerAddress: form.seller, // Backend will handle email lookup from wallet address
        amount: toMicroUSDC(parseFloat(form.amount.trim())), // Convert to microUSDC format
        currency: `micro${selectedTokenSymbol}`,
        currencySymbol: selectedTokenSymbol,
        description: form.description,
        expiryTimestamp: expiryTimestamp,
        chainId: config.chainId?.toString() || "8453",
        serviceLink: config.serviceLink,
        productName: order_id ? `Order #${order_id}` : undefined,
        state: "OK",
        suppressSending: true
      };

      console.log('🔧 ContractCreate: About to call authenticatedFetch');
      
      if (!authenticatedFetch) {
        throw new Error('authenticatedFetch is not available');
      }
      
      const response = await authenticatedFetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingContractRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create contract');
      }

      const result = await response.json();
      console.log('🔧 ContractCreate: Contract created successfully:', result);
      console.log('🔧 ContractCreate: Contract result.id:', result.id);
      console.log('🔧 ContractCreate: Contract result.contractId:', result.contractId);
      console.log('🔧 ContractCreate: All result fields:', Object.keys(result));
      
      // Use result.contractId or result.id depending on what the backend returns
      const contractId = result.contractId || result.id;
      console.log('🔧 ContractCreate: Using contractId:', contractId);
      
      setContractId(contractId);
      setPendingExpiryTimestamp(expiryTimestamp);
      setStep('payment');
      
      // Send contract created event
      sendPostMessage({
        type: 'contract_created',
        data: {
          contract_id: contractId, // Use contract_id to match the expected field name
          amount: form.amount,
          description: form.description,
          seller: form.seller,
          orderId: order_id
        }
      });
      
    } catch (error: any) {
      console.error('Contract creation failed:', error);
      sendPostMessage({
        type: 'payment_error',
        error: error.message || 'Failed to create contract'
      });
      alert(error.message || 'Failed to create contract');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleLegacyPayment = async () => {
    if (!contractId || !config) {
      console.error('🔧 ContractCreate: Missing required data for payment');
      return;
    }
    if (pendingExpiryTimestamp === null) {
      console.error('🔧 ContractCreate: pendingExpiryTimestamp not set; cannot deploy without the DB-stored value');
      return;
    }

    console.log('🔧 ContractCreate: Starting legacy payment (approve + deposit)');

    // Reset payment steps (labels are page-specific; the hook drives statuses).
    setPaymentSteps([
      { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
      { id: 'approve', label: `Approving ${selectedTokenSymbol} payment`, status: 'pending' },
      { id: 'escrow', label: 'Securing funds in escrow', status: 'pending' },
      { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
      { id: 'complete', label: 'Payment complete', status: 'pending' }
    ]);

    await runLegacyPayment(
      {
        contractserviceId: contractId,
        tokenAddress: selectedTokenAddress,
        buyer: address || '',
        seller: form.seller,
        // Reuse the DB-stored expiry to avoid drift between DB and chain.
        amount: toMicroUSDC(parseFloat(form.amount.trim())),
        expiryTimestamp: pendingExpiryTimestamp,
        description: form.description
      },
      {
        selectedTokenSymbol,
        tokenBalance,
        requiredAmount: parseFloat(form.amount.trim()),
        authenticatedFetch,
        transferToContract,
        approveUSDC,
        depositToContract,
        depositFundsAsProxy,
        getWeb3Service,
        updatePaymentStep,
        setLoadingMessage,
        setBusy: setIsLoading,
        getActiveStep,
        onSuccess: handlePaymentSuccess,
        onError: handlePaymentError,
      }
    );
  };

  const handleCancel = () => {
    sendPostMessage({ type: 'payment_cancelled' });

    if (isInIframe) {
      sendPostMessage({ type: 'close_modal' });
    } else if (isInPopup) {
      // In popup - close popup (SDK will handle displaying cancellation message)
      if (window.opener && wordpress_source === 'true' && returnUrl && typeof returnUrl === 'string') {
        // For WordPress integration, redirect to cancelled status page
        const cancelUrl = buildWordPressStatusUrl('cancelled');
        window.opener.location.href = cancelUrl;
      }
      // Close popup (SDK will show cancellation message in parent window)
      window.close();
    } else {
      if (returnUrl && typeof returnUrl === 'string') {
        // Build WordPress status URL for cancelled payment
        const cancelUrl = buildWordPressStatusUrl('cancelled');
        window.location.href = cancelUrl;
      } else {
        router.push('/dashboard');
      }
    }
  };

  // Loading screen for initialization - show if config is missing OR (auth is still initializing AND wallet not connected)
  // With lazy auth, we only show loading if wallet hasn't connected yet
  if (!config || (authLoading && !isConnected && !address)) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors ${isInIframe || isInPopup ? 'bg-secondary-50 dark:bg-secondary-800' : 'bg-white dark:bg-secondary-900'}`}>
        <Head children={
          <>
            <title>Create Contract - Conduit UCPI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </>
        } />
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-secondary-600 dark:text-secondary-300">Initializing secure payment system...</p>
        </div>
      </div>
    );
  }

  // ================================================================
  // STAGE 1: Payment Method Choice (before auth or when not connected)
  // Same pattern as contract-pay.tsx — choice comes FIRST
  // ================================================================
  if (!isConnected && !address) {
    // If payment method not chosen yet, show choice
    if (paymentMethod === null) {
      return (
        <div className={`min-h-screen flex items-center justify-center transition-colors ${isInIframe || isInPopup ? 'bg-secondary-50 dark:bg-secondary-800' : 'bg-white dark:bg-secondary-900'}`}>
          <Head children={
            <>
              <title>Create Contract - Conduit UCPI</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
            </>
          } />
          <div className="p-6 max-w-md mx-auto">
            {/* Buyer protection callout */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Secure escrow payment
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>Your payment is protected by escrow</li>
                <li>Can dispute if there is a problem</li>
                <li>No gas fees - we cover blockchain costs</li>
              </ul>
            </div>

            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4 text-center">How would you like to pay?</h2>

            <div className="space-y-3">
              {/* Wallet option */}
              <button
                onClick={() => setPaymentMethod('wallet')}
                className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 dark:text-white">Connect my wallet</p>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">Pay directly from your crypto wallet (MetaMask, Coinbase, etc.)</p>
                  </div>
                </div>
              </button>

              {/* QR option */}
              <button
                onClick={() => setPaymentMethod('qr')}
                className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 dark:text-white">Pay by link / QR code</p>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">Send from any wallet -- no wallet connection needed</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ================================================================
    // STAGE 2: Authentication (after payment method chosen)
    // ================================================================
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors ${isInIframe || isInPopup ? 'bg-secondary-50 dark:bg-secondary-800' : 'bg-white dark:bg-secondary-900'}`}>
        <Head children={
          <>
            <title>Create Contract - Conduit UCPI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </>
        } />
        <ConnectPaymentStage
          paymentMethod={paymentMethod}
          onBack={() => setPaymentMethod(null)}
          onConnectSuccess={() => {
            console.log('🔧 ContractCreate: Auth success callback triggered');
          }}
        />
      </div>
    );
  }

  return (
    <div className={`transition-colors ${isInIframe || isInPopup ? 'min-h-screen bg-secondary-50 dark:bg-secondary-800' : 'min-h-screen bg-white dark:bg-secondary-900'}`}>
      <Head children={
        <>
          <title>Create Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </>
      } />

      <div className={`${isInIframe || isInPopup ? 'p-4' : 'container mx-auto p-6'} max-w-md mx-auto`}>
        {step === 'create' ? (
          <>
            {/* Wallet Info Section */}
            <WalletInfo
              className="mb-4"
              tokenSymbol={selectedTokenSymbol}
              tokenAddress={selectedTokenAddress}
            />

            {/* Logout Button */}
            <div className="flex justify-end mb-4">
              <Button
                onClick={async () => {
                  await disconnect();
                  // The page will re-render and show the auth screen
                }}
                variant="outline"
                size="sm"
                className="text-secondary-600 dark:text-secondary-300 hover:text-secondary-800 dark:hover:text-secondary-100"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </Button>
            </div>

            <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6">
              <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">
                {isInIframe || isInPopup ? 'Stablecoin payment protected by escrow, no gas fees' : 'Payment Agreement'}
              </h2>
              
              <div className="space-y-4">
              <div>
                <Input
                  label="Seller Wallet Address"
                  type="text"
                  value={form.seller}
                  onChange={(e) => setForm(prev => ({ ...prev, seller: e.target.value }))}
                  placeholder="0x..."
                  error={errors.seller}
                  disabled={isLoading || !!seller} // Disable if provided via query param
                />
              </div>

              <div>
                <CurrencyAmountInput
                  label={`Amount (${selectedTokenSymbol})`}
                  value={form.amount}
                  onChange={(value) => setForm(prev => ({ ...prev, amount: value }))}
                  tokenSymbol={selectedTokenSymbol}
                  error={errors.amount}
                  disabled={isLoading || !!amount} // Disable if provided via query param
                  helpText={isInIframe || isInPopup ? 'Secure escrow payment' : 'Amount includes $1 fee, minimum $1.001'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
                  Description ({form.description.length}/160)
                </label>
                <textarea
                  className="w-full border border-secondary-300 dark:border-secondary-600 dark:bg-secondary-800 dark:text-white rounded-md px-3 py-2 text-sm"
                  rows={3}
                  maxLength={160}
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the purchase..."
                  disabled={isLoading || !!description} // Disable if provided via query param
                />
                {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
              </div>

              <div className="bg-secondary-50 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-md p-3">
                <p className="text-sm text-secondary-700 dark:text-secondary-200">
                  <strong>Payout Date:</strong>
                </p>
                <p className="text-sm text-secondary-900 dark:text-white">
                  {(() => {
                    // Calculate expiry timestamp (same logic as in handleCreateContract)
                    let expiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // Default to 7 days
                    if (epoch_expiry !== undefined) {
                      const parsedExpiry = parseInt(epoch_expiry as string, 10);
                      // Allow 0 for instant payments, or any future timestamp
                      if (!isNaN(parsedExpiry) && (parsedExpiry === 0 || parsedExpiry > Math.floor(Date.now() / 1000))) {
                        expiryTimestamp = parsedExpiry;
                      }
                    }
                    return expiryTimestamp === 0 ? 'Instant' : formatDateTimeWithTZ(expiryTimestamp);
                  })()}
                </p>
                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                  {epoch_expiry === '0' || parseInt(epoch_expiry as string || '') === 0
                    ? 'Funds will be released immediately after payment'
                    : 'Funds will be released to the seller after this date if not disputed'
                  }
                </p>
              </div>

              {order_id && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Order ID:</strong> {order_id}
                  </p>
                </div>
              )}

              {/* Balance warning on create step */}
              {form.amount && parseFloat(form.amount) > 0 && !isLoadingBalance && parseFloat(tokenBalance) < parseFloat(form.amount) && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4">
                  <div className="p-3">
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                      ⚠️ Insufficient {selectedTokenSymbol} Balance
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      You need {parseFloat(form.amount).toFixed(4)} {selectedTokenSymbol} but only have {parseFloat(tokenBalance).toFixed(4)} {selectedTokenSymbol}.
                      Please add {(parseFloat(form.amount) - parseFloat(tokenBalance)).toFixed(4)} {selectedTokenSymbol} to your wallet.
                    </p>
                  </div>

                  {/* Expandable guide section */}
                  <div className="border-t border-red-200 dark:border-red-800 p-3">
                    <Button
                      onClick={() => setShowTokenGuide(!showTokenGuide)}
                      variant="outline"
                      className="w-full"
                    >
                      {showTokenGuide ? `Hide guide` : `Show me how to add ${selectedTokenSymbol} to my wallet`}
                    </Button>
                    {showTokenGuide && (
                      <div className="mt-3">
                        <TokenGuide currency={selectedTokenSymbol} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateContract}
                  disabled={isLoading || !address}
                  className="flex-1"
                  title={
                    !address ? 'Please connect your wallet first' :
                    ''
                  }
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      {loadingMessage?.match(/Step \d+/)?.[0] || 'Processing...'}
                    </>
                  ) : (
                    isInIframe || isInPopup ? 'Create Payment' : 'Pay'
                  )}
                </Button>
              </div>
            </div>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6">
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Complete Payment</h2>

            {/* Contract summary - always shown */}
            <div className="space-y-3 mb-6">
              {/* Amount */}
              <div className="flex justify-between">
                <span className="text-secondary-600 dark:text-secondary-300">Amount:</span>
                <span className="font-medium text-secondary-900 dark:text-white">${form.amount} {selectedTokenSymbol}</span>
              </div>
              {/* Balance - only shown for wallet method */}
              {(paymentMethod === null || paymentMethod === 'wallet') && (
                <div className="flex justify-between">
                  <span className="text-secondary-600 dark:text-secondary-300">Your Balance:</span>
                  <span className={`font-medium ${parseFloat(tokenBalance) < parseFloat(form.amount) ? 'text-red-600' : 'text-green-600'}`}>
                    {isLoadingBalance ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      `${parseFloat(tokenBalance).toFixed(4)} ${selectedTokenSymbol}`
                    )}
                  </span>
                </div>
              )}
              {/* Seller */}
              <div className="flex justify-between">
                <span className="text-secondary-600 dark:text-secondary-300">Seller:</span>
                <span className="text-sm font-mono text-secondary-900 dark:text-white">{form.seller.slice(0, 6)}...{form.seller.slice(-4)}</span>
              </div>
              {/* Payout Date */}
              <div className="flex justify-between">
                <span className="text-secondary-600 dark:text-secondary-300">Payout Date:</span>
                <span className="font-medium text-secondary-900 dark:text-white">
                  {(() => {
                    let expiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
                    if (epoch_expiry !== undefined) {
                      const parsedExpiry = parseInt(epoch_expiry as string, 10);
                      if (!isNaN(parsedExpiry) && (parsedExpiry === 0 || parsedExpiry > Math.floor(Date.now() / 1000))) {
                        expiryTimestamp = parsedExpiry;
                      }
                    }
                    return expiryTimestamp === 0 ? 'Instant' : formatDateTimeWithTZ(expiryTimestamp);
                  })()}
                </span>
              </div>
              {/* Description */}
              <div className="flex justify-between">
                <span className="text-secondary-600 dark:text-secondary-300">Description:</span>
                <span className="text-right max-w-xs text-sm text-secondary-900 dark:text-white">{form.description}</span>
              </div>
              {order_id && (
                <div className="flex justify-between">
                  <span className="text-secondary-600 dark:text-secondary-300">Order ID:</span>
                  <span className="text-sm text-secondary-900 dark:text-white">{order_id}</span>
                </div>
              )}
            </div>

            {/* PAYMENT METHOD CHOICE (when paymentMethod === null) */}
            {paymentMethod === null && (
              <>
                <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4 text-center">How would you like to pay?</h3>
                <div className="space-y-3">
                  {/* Wallet option */}
                  <button
                    onClick={() => setPaymentMethod('wallet')}
                    className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-secondary-900 dark:text-white">Pay with connected wallet</p>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">Transfer directly from your connected wallet</p>
                      </div>
                    </div>
                  </button>

                  {/* QR option */}
                  <button
                    onClick={() => setPaymentMethod('qr')}
                    className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-secondary-900 dark:text-white">Pay by link / QR code</p>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">Send from any wallet -- no wallet connection needed</p>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* WALLET PAYMENT UI (when paymentMethod === 'wallet') */}
            {paymentMethod === 'wallet' && (
              <>
                {/* Payment method switcher (when not in progress and no QR contract created) */}
                {!isLoading && !qr.qrContractAddress && (
                  <div className="flex mb-6 bg-secondary-100 dark:bg-secondary-800 rounded-lg p-1">
                    <button
                      onClick={() => setPaymentMethod('wallet')}
                      className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm"
                    >
                      Wallet Transfer
                    </button>
                    <button
                      onClick={() => setPaymentMethod('qr')}
                      className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200"
                    >
                      QR Code
                    </button>
                  </div>
                )}

                {/* Payment Progress Steps */}
                {isLoading && (
                  <PaymentProgress steps={paymentSteps} loadingMessage={loadingMessage} />
                )}

                {/* Balance warning / escrow info */}
                {parseFloat(tokenBalance) < parseFloat(form.amount) ? (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-6">
                    <div className="p-4">
                      <p className="text-sm text-red-800 dark:text-red-300 font-medium">Insufficient Balance</p>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        You need {parseFloat(form.amount).toFixed(4)} {selectedTokenSymbol} but only have {parseFloat(tokenBalance).toFixed(4)} {selectedTokenSymbol}.
                        Please add {(parseFloat(form.amount) - parseFloat(tokenBalance)).toFixed(4)} {selectedTokenSymbol} to your wallet before proceeding.
                      </p>
                    </div>
                    <div className="border-t border-red-200 dark:border-red-800 p-3">
                      <Button
                        onClick={() => setShowTokenGuide(!showTokenGuide)}
                        variant="outline"
                        className="w-full"
                      >
                        {showTokenGuide ? `Hide guide` : `Show me how to add ${selectedTokenSymbol} to my wallet`}
                      </Button>
                      {showTokenGuide && (
                        <div className="mt-3">
                          <TokenGuide currency={selectedTokenSymbol} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : !isLoading && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      {(() => {
                        const parsedExpiry = epoch_expiry !== undefined ? parseInt(epoch_expiry as string, 10) : -1;
                        const isInstant = parsedExpiry === 0;
                        if (isInstant) {
                          return `Your $${form.amount} ${selectedTokenSymbol} will be released to the seller immediately after payment confirmation.`;
                        } else {
                          return `Your $${form.amount} ${selectedTokenSymbol} will be held securely in escrow and released to the seller on the payout date unless you raise a dispute.`;
                        }
                      })()}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleWalletPayment}
                    disabled={isLoading || isLoadingBalance || parseFloat(tokenBalance) < parseFloat(form.amount)}
                    className="flex-1"
                    title={
                      parseFloat(tokenBalance) < parseFloat(form.amount)
                        ? `Insufficient balance: need ${form.amount} ${selectedTokenSymbol}, have ${parseFloat(tokenBalance).toFixed(4)} ${selectedTokenSymbol}`
                        : ''
                    }
                  >
                    {isLoading ? (
                      <>
                        <LoadingSpinner className="w-4 h-4 mr-2" />
                        {loadingMessage?.match(/Step \d+/)?.[0] || 'Processing...'}
                      </>
                    ) : (
                      `Pay $${form.amount} ${selectedTokenSymbol}`
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* QR PAYMENT UI (when paymentMethod === 'qr') */}
            {paymentMethod === 'qr' && (
              <>
                {/* Payment method switcher (when not creating and no QR contract yet) */}
                {!qr.isCreatingContract && !qr.qrContractAddress && (
                  <div className="flex mb-6 bg-secondary-100 dark:bg-secondary-800 rounded-lg p-1">
                    <button
                      onClick={() => setPaymentMethod('wallet')}
                      className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200"
                    >
                      Wallet Transfer
                    </button>
                    <button
                      onClick={() => setPaymentMethod('qr')}
                      className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm"
                    >
                      QR Code
                    </button>
                  </div>
                )}

                {/* Step 1: Create the contract first */}
                <QrPaymentPanel
                  qr={qr}
                  networkName={networkName}
                  tokenSymbol={selectedTokenSymbol}
                  amountInTokens={parseFloat(form.amount)}
                  isMobileDevice={isMobileDevice}
                  copiedAddress={copiedAddress}
                  onCopyAddress={handleCopyAddress}
                  createButtonLabel="Generate Payment Link"
                  createDisabled={false}
                  onCancel={handleCancel}
                  successMessage="Your payment has been verified and the contract is now active. Redirecting..."
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}