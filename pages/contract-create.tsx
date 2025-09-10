import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useWeb3SDK } from '@/hooks/useWeb3SDK';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { isValidEmail, isValidDescription, isValidAmount, isValidWalletAddress } from '@/utils/validation';

console.log('🔧 ContractCreate: FILE LOADED - imports successful');

// Helper function to generate seller email from wallet address
const generateSellerEmail = (walletAddress: string): string => {
  if (!walletAddress) return 'noseller@seller.com';
  // Take first 20 characters of wallet address and append @seller.com
  const prefix = walletAddress.substring(0, 20);
  return `${prefix}@seller.com`;
};

interface ContractCreateForm {
  seller: string;
  amount: string;
  description: string;
}

interface FormErrors {
  seller?: string;
  amount?: string;
  description?: string;
}

interface PostMessageEvent {
  type: 'contract_created' | 'payment_completed' | 'payment_cancelled' | 'payment_error' | 'close_modal';
  data?: any;
  error?: string;
}

export default function ContractCreate() {
  console.log('🔧 ContractCreate: Component mounted/rendered');
  
  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch, fundContract } = useAuth();
  const { utils, isReady, error: sdkError } = useWeb3SDK();
  
  // Query parameters
  const { seller, amount, description, email: queryEmail, return: returnUrl, order_id } = router.query;
  
  // Check if we're in an iframe
  const [isInIframe, setIsInIframe] = useState(false);
  
  // Form state
  const [form, setForm] = useState<ContractCreateForm>({
    seller: '',
    amount: '',
    description: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [contractId, setContractId] = useState<string | null>(null);
  const [step, setStep] = useState<'create' | 'payment'>('create');

  console.log('🔧 ContractCreate: Hooks initialized', {
    hasConfig: !!config,
    hasUser: !!user,
    hasAuthenticatedFetch: !!authenticatedFetch,
    userWallet: user?.walletAddress,
    isReady,
    sdkError,
    queryParams: { seller, amount, description, returnUrl, order_id }
  });

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

  // Detect iframe environment
  useEffect(() => {
    setIsInIframe(window !== window.parent);
  }, []);

  // Send postMessage to parent window
  const sendPostMessage = (event: PostMessageEvent) => {
    if (isInIframe && window.parent) {
      console.log('🔧 ContractCreate: Sending postMessage:', event);
      window.parent.postMessage(event, '*');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Use SDK utils if available, otherwise fall back to local validation
    const amountValidator = utils?.isValidAmount || isValidAmount;
    const descriptionValidator = utils?.isValidDescription || isValidDescription;

    // Validate seller (must be wallet address)
    if (!isValidWalletAddress(form.seller)) {
      newErrors.seller = 'Invalid seller wallet address';
    }

    if (!amountValidator(form.amount)) {
      newErrors.amount = 'Invalid amount';
    }

    if (!descriptionValidator(form.description)) {
      newErrors.description = 'Description must be 1-160 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateContract = async () => {
    console.log('🔧 ContractCreate: handleCreateContract called');
    
    const formValid = validateForm();
    console.log('🔧 ContractCreate: form validation result:', formValid);
    
    if (!formValid || !config) {
      console.log('🔧 ContractCreate: Early return due to validation or config issues');
      return;
    }

    console.log('🔧 ContractCreate: Starting contract creation process');
    setIsLoading(true);
    
    try {
      // Validate config before proceeding
      if (!config.usdcContractAddress) {
        throw new Error('USDC contract address not configured. Please check server configuration.');
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
      
      // Set default expiry to 7 days from now
      const defaultExpiryTimestamp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
      
      const pendingContractRequest = {
        buyerEmail: (queryEmail as string) || user?.email || 'noemail@notsupplied.com', // Current user is the buyer
        sellerEmail: generateSellerEmail(form.seller), // Generate email from wallet address
        sellerAddress: form.seller,
        amount: utils?.toMicroUSDC ? utils.toMicroUSDC(parseFloat(form.amount.trim())) : Math.round(parseFloat(form.amount.trim()) * 1000000), // Convert to microUSDC format
        currency: 'microUSDC',
        description: form.description,
        expiryTimestamp: defaultExpiryTimestamp,
        serviceLink: config.serviceLink,
        productName: order_id ? `Order #${order_id}` : undefined
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
      
      setContractId(result.id);
      setStep('payment');
      
      // Send contract created event
      sendPostMessage({
        type: 'contract_created',
        data: {
          contractId: result.id,
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
    if (!contractId || !fundContract || !config) {
      console.error('🔧 ContractCreate: Missing required data for payment');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Processing payment...');

    try {
      console.log('🔧 ContractCreate: Starting payment process');
      
      // Fund the contract using the provider-specific implementation
      const result = await fundContract({
        contract: {
          id: contractId,
          amount: utils?.toMicroUSDC ? utils.toMicroUSDC(parseFloat(form.amount.trim())) : Math.round(parseFloat(form.amount.trim()) * 1000000),
          currency: 'microUSDC',
          sellerAddress: form.seller,
          expiryTimestamp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
          description: form.description,
          buyerEmail: (queryEmail as string) || user?.email || 'noemail@notsupplied.com',
          sellerEmail: generateSellerEmail(form.seller)
        },
        userAddress: user?.walletAddress!,
        config: {
          usdcContractAddress: config.usdcContractAddress,
          serviceLink: config.serviceLink,
          rpcUrl: config.rpcUrl
        },
        utils: {
          toMicroUSDC: utils?.toMicroUSDC,
          toUSDCForWeb3: utils?.toUSDCForWeb3,
          formatDateTimeWithTZ: utils?.formatDateTimeWithTZ
        }
      });

      console.log('🔧 ContractCreate: Payment completed successfully:', result);
      
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
      } else {
        // Not in iframe - redirect to return URL or dashboard
        if (returnUrl && typeof returnUrl === 'string') {
          window.location.href = returnUrl;
        } else {
          router.push('/dashboard');
        }
      }

    } catch (error: any) {
      console.error('Payment failed:', error);
      sendPostMessage({
        type: 'payment_error',
        error: error.message || 'Payment failed'
      });
      alert(error.message || 'Payment failed');
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleCancel = () => {
    sendPostMessage({ type: 'payment_cancelled' });
    
    if (isInIframe) {
      sendPostMessage({ type: 'close_modal' });
    } else {
      if (returnUrl && typeof returnUrl === 'string') {
        window.location.href = returnUrl;
      } else {
        router.push('/dashboard');
      }
    }
  };

  // Loading screen for SDK initialization
  if (!isReady || !config) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isInIframe ? 'bg-gray-50' : 'bg-white'}`}>
        <Head>
          <title>Create Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
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
      <div className={`min-h-screen flex items-center justify-center ${isInIframe ? 'bg-gray-50' : 'bg-white'}`}>
        <Head>
          <title>Create Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connect Wallet</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to create a secure escrow contract.</p>
          <ConnectWalletEmbedded />
        </div>
      </div>
    );
  }

  return (
    <div className={`${isInIframe ? 'min-h-screen bg-gray-50' : 'min-h-screen bg-white'}`}>
      <Head>
        <title>Create Contract - Conduit UCPI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={`${isInIframe ? 'p-4' : 'container mx-auto p-6'} max-w-md mx-auto`}>
        {step === 'create' ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {isInIframe ? 'Secure Payment' : 'Create Escrow Contract'}
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
                  label="Amount (USDC)"
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
                  {isInIframe ? 'Secure escrow payment' : 'Amount includes $1 fee, minimum $1.001'}
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

              {order_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Order ID:</strong> {order_id}
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
                  disabled={isLoading}
                  className="flex-1 bg-primary-500 hover:bg-primary-600"
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      {loadingMessage || 'Creating...'}
                    </>
                  ) : (
                    isInIframe ? 'Create Payment' : 'Create Contract'
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Complete Payment</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">${form.amount} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Seller:</span>
                <span className="text-sm font-mono">{form.seller.slice(0, 6)}...{form.seller.slice(-4)}</span>
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

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <p className="text-sm text-yellow-800">
                Your ${form.amount} USDC will be held securely in escrow until the seller delivers the goods/services. 
                Funds are protected by time-locked smart contracts.
              </p>
            </div>

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
                disabled={isLoading}
                className="flex-1 bg-primary-500 hover:bg-primary-600"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    {loadingMessage || 'Processing...'}
                  </>
                ) : (
                  `Pay $${form.amount} USDC`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}