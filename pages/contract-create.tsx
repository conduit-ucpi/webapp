import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import WalletInfo from '@/components/ui/WalletInfo';
import { isValidWalletAddress, toMicroUSDC, toUSDCForWeb3, formatDateTimeWithTZ } from '@/utils/validation';
import { useContractCreateValidation } from '@/hooks/useContractValidation';
import { executeContractTransactionSequence } from '@/utils/contractTransactionSequence';
import { createContractProgressHandler } from '@/utils/contractProgressHandler';

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

type PaymentStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
};

export default function ContractCreate() {
  console.log('🔧 ContractCreate: Component mounted/rendered');

  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch, disconnect, isLoading: authLoading } = useAuth();
  const { approveUSDC, depositToContract, getWeb3Service } = useSimpleEthers();
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

  // Determine which token to use based on URL parameter or default
  const selectedTokenSymbol = (queryTokenSymbol as string) || config?.defaultTokenSymbol || 'USDC';
  const selectedToken = selectedTokenSymbol === 'USDT'
    ? config?.usdtDetails
    : config?.usdcDetails;
  const selectedTokenAddress = selectedToken?.address || config?.usdcContractAddress || '';

  // Debug logging for token selection
  console.log('🔧 ContractCreate: Token selection details', {
    queryTokenSymbol,
    configDefaultTokenSymbol: config?.defaultTokenSymbol,
    selectedTokenSymbol,
    configUsdcDetails: config?.usdcDetails,
    configUsdtDetails: config?.usdtDetails,
    selectedToken,
    selectedTokenAddress,
    fallbackAddress: config?.usdcContractAddress
  });
  
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
  const [step, setStep] = useState<'create' | 'payment'>('create');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [paymentSteps, setPaymentSteps] = useState<PaymentStep[]>([
    { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
    { id: 'approve', label: `Approving ${selectedTokenSymbol} payment`, status: 'pending' },
    { id: 'escrow', label: 'Securing funds in escrow', status: 'pending' },
    { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
    { id: 'complete', label: 'Payment complete', status: 'pending' }
  ]);

  console.log('🔧 ContractCreate: Hooks initialized', {
    hasConfig: !!config,
    authLoading,
    hasUser: !!user,
    userEmail: user?.email,
    hasAuthenticatedFetch: !!authenticatedFetch,
    userWallet: user?.walletAddress,
    queryParams: { seller, amount, description, returnUrl, order_id, epoch_expiry },
    selectedTokenSymbol,
    selectedTokenAddress,
    queryTokenSymbol
  });

  console.log('🔧 ContractCreate: Auth state decision', {
    willShowLoading: !config || authLoading,
    willShowAuth: !authLoading && !user,
    willShowForm: !authLoading && !!user
  });

  // Clear auth cache on mount to force fresh authentication
  useEffect(() => {
    const clearAuthCache = async () => {
      console.log('🔧 ContractCreate: Clearing any cached authentication on mount');
      await disconnect();
    };

    // Only disconnect if there's a user or if auth is not loading
    // This ensures we clear any cached session
    if (!authLoading) {
      clearAuthCache();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally empty deps - we want this to run ONCE on mount only

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

  // Fetch token balance immediately when user connects (not just on payment step)
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (user?.walletAddress && selectedTokenAddress && config?.rpcUrl) {
        setIsLoadingBalance(true);
        try {
          const { ethers } = await import('ethers');
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          const tokenContract = new ethers.Contract(
            selectedTokenAddress,
            ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
            provider
          );

          const [balance, decimals] = await Promise.all([
            tokenContract.balanceOf(user.walletAddress),
            tokenContract.decimals()
          ]);

          const formattedBalance = ethers.formatUnits(balance, decimals);
          setTokenBalance(formattedBalance);
          console.log(`🔧 ContractCreate: ${selectedTokenSymbol} balance:`, formattedBalance);
        } catch (error) {
          console.error(`Failed to fetch ${selectedTokenSymbol} balance:`, error);
          setTokenBalance('0');
        } finally {
          setIsLoadingBalance(false);
        }
      }
    };

    fetchTokenBalance();
  }, [user?.walletAddress, selectedTokenAddress, selectedTokenSymbol, config?.rpcUrl]);

  // Detect iframe and popup environment
  useEffect(() => {
    setIsInIframe(window !== window.parent);
    setIsInPopup(window.opener !== null);
  }, []);

  // Send postMessage to parent window
  const sendPostMessage = (event: PostMessageEvent) => {
    if (isInIframe && window.parent) {
      console.log('🔧 ContractCreate: Sending postMessage:', event);
      window.parent.postMessage(event, '*');
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

  // Update payment step status
  const updatePaymentStep = (stepId: string, status: 'active' | 'completed' | 'error') => {
    setPaymentSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        return { ...step, status };
      }
      // If we're marking a step as active, ensure all previous steps are completed
      if (status === 'active') {
        const currentIndex = prev.findIndex(s => s.id === stepId);
        const stepIndex = prev.findIndex(s => s.id === step.id);
        if (stepIndex < currentIndex) {
          return { ...step, status: 'completed' };
        }
      }
      return step;
    }));
  };

  // validateForm function now provided by useContractCreateValidation hook

  const handleCreateContract = async () => {
    console.log('🔧 ContractCreate: handleCreateContract called');
    
    const formValid = validateForm(form, { wordpress_source, webhook_url, order_id });
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
      
      // Check if user is authenticated and has wallet address
      setLoadingMessage('Initializing...');
      console.log('🔧 ContractCreate: User object:', user);
      
      if (!user?.walletAddress) {
        console.error('🔧 ContractCreate: No wallet address found in user object');
        throw new Error('Please connect your wallet first.');
      }
      
      // Create pending contract via Contract Service
      setLoadingMessage('Creating secure escrow contract...');
      
      // Parse epoch_expiry from query params if provided and valid
      let expiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // Default to 7 days
      
      if (epoch_expiry) {
        const parsedExpiry = parseInt(epoch_expiry as string, 10);
        if (!isNaN(parsedExpiry) && parsedExpiry > Math.floor(Date.now() / 1000)) {
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

  const handlePayment = async () => {
    if (!contractId || !config) {
      console.error('🔧 ContractCreate: Missing required data for payment');
      console.error('🔧 ContractCreate: contractId:', contractId);
      console.error('🔧 ContractCreate: config:', !!config);
      return;
    }

    console.log('🔧 ContractCreate: handlePayment starting with modern fundAndSendTransaction method');
    setIsLoading(true);
    
    // Reset payment steps to initial state
    setPaymentSteps([
      { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
      { id: 'approve', label: `Approving ${selectedTokenSymbol} payment`, status: 'pending' },
      { id: 'escrow', label: 'Securing funds in escrow', status: 'pending' },
      { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
      { id: 'complete', label: 'Payment complete', status: 'pending' }
    ]);

    try {
      console.log('🔧 ContractCreate: Starting payment process');
      console.log('🔧 ContractCreate: Payment using token:', {
        selectedTokenSymbol,
        selectedTokenAddress,
        amount: form.amount,
        balance: tokenBalance
      });

      // Check if user has sufficient balance
      const requestedAmount = parseFloat(form.amount.trim());
      const availableBalance = parseFloat(tokenBalance);

      if (availableBalance < requestedAmount) {
        const shortfall = requestedAmount - availableBalance;
        throw new Error(
          `Insufficient ${selectedTokenSymbol} balance. You need ${requestedAmount.toFixed(4)} ${selectedTokenSymbol} but only have ${availableBalance.toFixed(4)} ${selectedTokenSymbol}. You are short ${shortfall.toFixed(4)} ${selectedTokenSymbol}.`
        );
      }

      // Step 1: Verify wallet connection
      updatePaymentStep('verify', 'active');
      setLoadingMessage('Verifying wallet connection...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UI feedback
      updatePaymentStep('verify', 'completed');
      
      // Parse expiry timestamp same way as in contract creation
      let expiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // Default to 7 days
      if (epoch_expiry) {
        const parsedExpiry = parseInt(epoch_expiry as string, 10);
        if (!isNaN(parsedExpiry) && parsedExpiry > Math.floor(Date.now() / 1000)) {
          expiryTimestamp = parsedExpiry;
        }
      }
      
      // Execute the complete transaction sequence with proper confirmation waiting
      updatePaymentStep('approve', 'active');

      const result = await executeContractTransactionSequence(
        {
          contractserviceId: contractId,
          tokenAddress: selectedTokenAddress,
          buyer: user?.walletAddress || '',
          seller: form.seller,
          amount: toMicroUSDC(parseFloat(form.amount.trim())),
          expiryTimestamp: expiryTimestamp,
          description: form.description
        },
        {
          authenticatedFetch,
          approveUSDC,
          depositToContract,
          getWeb3Service,
          onProgress: createContractProgressHandler({
            setLoadingMessage,
            updatePaymentStep
          }, 'Step')
        }
      );

      // result now contains: { contractAddress, contractCreationTxHash?, approvalTxHash, depositTxHash }

      console.log('🔧 ContractCreate: Payment completed successfully:', result);

      // Add debugging for transaction verification
      if (result.depositTxHash) {
        console.log('🔧 ContractCreate: Deposit transaction hash received:', result.depositTxHash);
        console.log(`🔧 ContractCreate: Contract address should receive ${selectedTokenSymbol}:`, result.contractAddress);

        // If webhook_url is provided (WordPress integration), verify payment and send webhook
        if (webhook_url && wordpress_source === 'true' && authenticatedFetch) {
          console.log('🔧 ContractCreate: WordPress integration detected, sending verification webhook');
          try {
            const verifyResponse = await authenticatedFetch('/api/payment/verify-and-webhook', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                transaction_hash: result.depositTxHash,
                contract_address: result.contractAddress,
                contract_hash: result.contractAddress, // Include as both contract_address and contract_hash for compatibility
                contract_id: contractId,
                webhook_url: webhook_url,
                order_id: parseInt(order_id as string || '0'),
                expected_amount: parseFloat(form.amount),
                expected_recipient: result.contractAddress,
                merchant_wallet: form.seller
              })
            });

            if (!verifyResponse.ok) {
              console.error('🔧 ContractCreate: Payment verification failed:', await verifyResponse.text());
              // Don't fail the payment flow - payment was successful, just webhook failed
            } else {
              const verifyResult = await verifyResponse.json();
              console.log('🔧 ContractCreate: Payment verification and webhook sent successfully:', verifyResult);
            }
          } catch (verifyError) {
            console.error('🔧 ContractCreate: Payment verification error:', verifyError);
            // Don't fail the payment flow - payment was successful, just webhook failed
          }
        }
      } else {
        console.warn('🔧 ContractCreate: No deposit transaction hash received!');
      }

      // Create order in Shopify if this is from a shop
      if (shop) {
        console.log('🔧 ContractCreate: Creating Shopify order for shop:', shop);
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
              transactionHash: result?.depositTxHash
            })
          });

          const orderData = await orderResponse.json();
          console.log('🔧 ContractCreate: Shopify order creation result:', orderData);

          if (orderData.shopifyOrderCreated) {
            console.log('🔧 ContractCreate: Shopify order created successfully!', orderData.shopifyOrderNumber);
          }
        } catch (orderError) {
          console.error('🔧 ContractCreate: Failed to create Shopify order:', orderError);
          // Don't fail the payment flow - payment was successful
        }
      }

      // Send payment completed event
      sendPostMessage({
        type: 'payment_completed',
        data: {
          contractId,
          amount: form.amount,
          description: form.description,
          seller: form.seller,
          orderId: order_id,
          transactionHash: result?.depositTxHash
        }
      });

      setLoadingMessage('Payment completed! Redirecting...');
      
      // Handle redirect
      if (isInIframe) {
        // In iframe - send close modal event
        setTimeout(() => {
          sendPostMessage({ type: 'close_modal' });
        }, 2000);
      } else if (isInPopup) {
        // In popup - close popup and redirect opener to return URL
        setTimeout(() => {
          if (returnUrl && typeof returnUrl === 'string' && window.opener) {
            // Build WordPress status URL for completed payment
            const completedUrl = buildWordPressStatusUrl('completed', {
              contract_id: contractId || '',
              contract_hash: result?.contractAddress || '',
              tx_hash: result?.depositTxHash || ''
            });
            window.opener.location.href = completedUrl;
          }
          // Close the popup
          window.close();
        }, 2000);
      } else {
        // Not in iframe or popup - redirect to return URL or dashboard
        if (returnUrl && typeof returnUrl === 'string') {
          // Build WordPress status URL for completed payment
          const completedUrl = buildWordPressStatusUrl('completed', {
            contract_id: contractId || '',
            contract_hash: result?.contractAddress || '',
            tx_hash: result?.depositTxHash || ''
          });
          window.location.href = completedUrl;
        } else {
          router.push('/dashboard');
        }
      }

    } catch (error: any) {
      console.error('🔧 ContractCreate: Payment failed:', error);
      console.error('🔧 ContractCreate: Error type:', error.name);
      console.error('🔧 ContractCreate: Error message:', error.message);
      console.error('🔧 ContractCreate: Error stack:', error.stack);

      // Mark the current active step as error
      const activeStep = paymentSteps.find(s => s.status === 'active');
      if (activeStep) {
        updatePaymentStep(activeStep.id, 'error');
      }

      sendPostMessage({
        type: 'payment_error',
        error: error.message || 'Payment failed'
      });

      // For WordPress integration, redirect to error status page
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
        alert(error.message || 'Payment failed');
      }

      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleCancel = () => {
    sendPostMessage({ type: 'payment_cancelled' });

    if (isInIframe) {
      sendPostMessage({ type: 'close_modal' });
    } else if (isInPopup) {
      // In popup - close popup and return to opener
      if (window.opener) {
        // For WordPress integration, redirect to cancelled status page
        if (returnUrl && typeof returnUrl === 'string') {
          const cancelUrl = buildWordPressStatusUrl('cancelled');
          window.opener.location.href = cancelUrl;
        }
      }
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

  // Loading screen for initialization - show if config is missing or auth is loading
  if (!config || authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isInIframe || isInPopup ? 'bg-gray-50' : 'bg-white'}`}>
        <Head children={
          <>
            <title>Create Contract - Conduit UCPI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </>
        } />
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Initializing secure payment system...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isInIframe || isInPopup ? 'bg-gray-50' : 'bg-white'}`}>
        <Head children={
          <>
            <title>Create Contract - Conduit UCPI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </>
        } />
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connect Your Account</h2>
          <p className="text-gray-600 mb-6">Choose how you'd like to connect to create a secure escrow contract.</p>
          <ConnectWalletEmbedded
            compact={true}
            useSmartRouting={false}
            showTwoOptionLayout={true}
            autoConnect={!!shop}
            onSuccess={() => {
              // Force a re-render by triggering auth context refresh
              // The user state should update automatically but this ensures it
              console.log('🔧 ContractCreate: Auth success callback triggered');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`${isInIframe || isInPopup ? 'min-h-screen bg-gray-50' : 'min-h-screen bg-white'}`}>
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
                className="text-gray-600 hover:text-gray-800"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {isInIframe || isInPopup ? 'Stablecoin payment protected by escrow, no gas fees' : 'Create Escrow Contract'}
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
                <Input
                  label={`Amount (${selectedTokenSymbol})`}
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="100.00"
                  error={errors.amount}
                  disabled={isLoading || !!amount} // Disable if provided via query param
                />
                <p className="text-xs text-gray-500 mt-1">
                  {isInIframe || isInPopup ? 'Secure escrow payment' : 'Amount includes $1 fee, minimum $1.001'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description ({form.description.length}/160)
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  rows={3}
                  maxLength={160}
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the purchase..."
                  disabled={isLoading || !!description} // Disable if provided via query param
                />
                {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-sm text-gray-700">
                  <strong>Payout Date:</strong>
                </p>
                <p className="text-sm text-gray-900">
                  {(() => {
                    // Calculate expiry timestamp (same logic as in handleCreateContract)
                    let expiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // Default to 7 days
                    if (epoch_expiry) {
                      const parsedExpiry = parseInt(epoch_expiry as string, 10);
                      if (!isNaN(parsedExpiry) && parsedExpiry > Math.floor(Date.now() / 1000)) {
                        expiryTimestamp = parsedExpiry;
                      }
                    }
                    return formatDateTimeWithTZ(expiryTimestamp);
                  })()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Funds will be released to the seller after this date if not disputed
                </p>
              </div>

              {order_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Order ID:</strong> {order_id}
                  </p>
                </div>
              )}

              {/* Balance warning on create step */}
              {form.amount && parseFloat(form.amount) > 0 && !isLoadingBalance && parseFloat(tokenBalance) < parseFloat(form.amount) && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Insufficient {selectedTokenSymbol} Balance
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    You need {parseFloat(form.amount).toFixed(4)} {selectedTokenSymbol} but only have {parseFloat(tokenBalance).toFixed(4)} {selectedTokenSymbol}.
                    Please add {(parseFloat(form.amount) - parseFloat(tokenBalance)).toFixed(4)} {selectedTokenSymbol} to your wallet.
                  </p>
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
                  disabled={
                    isLoading ||
                    isLoadingBalance ||
                    Boolean(form.amount && parseFloat(form.amount) > 0 && parseFloat(tokenBalance) < parseFloat(form.amount))
                  }
                  className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    parseFloat(tokenBalance) < parseFloat(form.amount || '0')
                      ? `Insufficient balance: need ${form.amount} ${selectedTokenSymbol}, have ${parseFloat(tokenBalance).toFixed(4)} ${selectedTokenSymbol}`
                      : ''
                  }
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      {loadingMessage || 'Creating...'}
                    </>
                  ) : (
                    isInIframe || isInPopup ? 'Create Payment' : 'Create Contract'
                  )}
                </Button>
              </div>
            </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Complete Payment</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">${form.amount} {selectedTokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Your Balance:</span>
                <span className={`font-medium ${parseFloat(tokenBalance) < parseFloat(form.amount) ? 'text-red-600' : 'text-green-600'}`}>
                  {isLoadingBalance ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    `${parseFloat(tokenBalance).toFixed(4)} ${selectedTokenSymbol}`
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Seller:</span>
                <span className="text-sm font-mono">{form.seller.slice(0, 6)}...{form.seller.slice(-4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payout Date:</span>
                <span className="font-medium">
                  {(() => {
                    // Calculate expiry timestamp (same logic as in handleCreateContract)
                    let expiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // Default to 7 days
                    if (epoch_expiry) {
                      const parsedExpiry = parseInt(epoch_expiry as string, 10);
                      if (!isNaN(parsedExpiry) && parsedExpiry > Math.floor(Date.now() / 1000)) {
                        expiryTimestamp = parsedExpiry;
                      }
                    }
                    return formatDateTimeWithTZ(expiryTimestamp);
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Description:</span>
                <span className="text-right max-w-xs text-sm">{form.description}</span>
              </div>
              {order_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Order ID:</span>
                  <span className="text-sm">{order_id}</span>
                </div>
              )}
            </div>

            {/* Payment Progress Steps */}
            {isLoading && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Progress</h3>
                <div className="space-y-2">
                  {paymentSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div className="flex-shrink-0 mr-3">
                        {step.status === 'completed' ? (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : step.status === 'active' ? (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <LoadingSpinner className="w-3 h-3 text-white" />
                          </div>
                        ) : step.status === 'error' ? (
                          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${
                          step.status === 'completed' ? 'text-green-700' :
                          step.status === 'active' ? 'text-blue-700 font-medium' :
                          step.status === 'error' ? 'text-red-700' :
                          'text-gray-500'
                        }`}>
                          {step.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {loadingMessage && (
                  <p className="mt-3 text-sm text-gray-600 italic whitespace-pre-line">{loadingMessage}</p>
                )}
              </div>
            )}

            {parseFloat(tokenBalance) < parseFloat(form.amount) ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ Insufficient Balance
                </p>
                <p className="text-sm text-red-700 mt-1">
                  You need {parseFloat(form.amount).toFixed(4)} {selectedTokenSymbol} but only have {parseFloat(tokenBalance).toFixed(4)} {selectedTokenSymbol}.
                  Please add {(parseFloat(form.amount) - parseFloat(tokenBalance)).toFixed(4)} {selectedTokenSymbol} to your wallet before proceeding.
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  Your ${form.amount} {selectedTokenSymbol} will be held securely in escrow and released to the seller on the payout date unless you raise a dispute (see email for instructions).
                </p>
              </div>
            )}

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
                onClick={handlePayment}
                disabled={isLoading || isLoadingBalance || parseFloat(tokenBalance) < parseFloat(form.amount)}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  parseFloat(tokenBalance) < parseFloat(form.amount)
                    ? `Insufficient balance: need ${form.amount} ${selectedTokenSymbol}, have ${parseFloat(tokenBalance).toFixed(4)} ${selectedTokenSymbol}`
                    : ''
                }
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    {loadingMessage || 'Processing...'}
                  </>
                ) : (
                  `Pay $${form.amount} ${selectedTokenSymbol}`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}