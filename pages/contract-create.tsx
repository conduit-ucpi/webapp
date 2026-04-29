import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { useTokenSelection } from '@/hooks/useTokenSelection';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import WalletInfo from '@/components/ui/WalletInfo';
import TokenGuide from '@/components/ui/TokenGuide';
import CurrencyAmountInput from '@/components/ui/CurrencyAmountInput';
import { QRCodeSVG } from 'qrcode.react';
import { isValidWalletAddress, toMicroUSDC, toUSDCForWeb3, formatDateTimeWithTZ, displayCurrency } from '@/utils/validation';
import { useContractCreateValidation } from '@/hooks/useContractValidation';
import { executeContractTransactionSequence, executeDirectPaymentSequence } from '@/utils/contractTransactionSequence';
import { createContractProgressHandler } from '@/utils/contractProgressHandler';
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

type PaymentStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
};

type PaymentMethod = 'wallet' | 'qr' | null;

export default function ContractCreate() {
  console.log('🔧 ContractCreate: Component mounted/rendered');

  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch, disconnect, isLoading: authLoading, isLoadingUserData, isConnected, address, refreshUserData } = useAuth();
  const { approveUSDC, depositToContract, depositFundsAsProxy, getWeb3Service, transferToContract, getTokenBalance } = useSimpleEthers();
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
  const [hasAttemptedUserFetch, setHasAttemptedUserFetch] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [pendingExpiryTimestamp, setPendingExpiryTimestamp] = useState<number | null>(null);
  const [step, setStep] = useState<'create' | 'payment'>('create');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [paymentSteps, setPaymentSteps] = useState<PaymentStep[]>([
    { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
    { id: 'transfer', label: `Transferring ${selectedTokenSymbol} to escrow`, status: 'pending' },
    { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
    { id: 'activate', label: 'Activating contract', status: 'pending' },
    { id: 'complete', label: 'Payment complete', status: 'pending' }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  // QR flow state
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [qrContractAddress, setQrContractAddress] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(240);
  const [qrPaymentDetected, setQrPaymentDetected] = useState(false);
  const [qrActivationStatus, setQrActivationStatus] = useState<'idle' | 'checking' | 'success' | 'waiting'>('idle');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const qrPollingRef = useRef<NodeJS.Timeout | null>(null);
  const qrCountdownRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch token balance immediately when wallet connects (not just on payment step)
  // With lazy auth, we use address instead of user?.walletAddress
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (address && selectedTokenAddress && config?.rpcUrl) {
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
            tokenContract.balanceOf(address),
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
  }, [address, selectedTokenAddress, selectedTokenSymbol, config?.rpcUrl]);

  // Detect iframe and popup environment
  useEffect(() => {
    setIsInIframe(window !== window.parent);
    setIsInPopup(window.opener !== null);
  }, []);

  // Fetch user data when wallet connects (lazy auth will trigger automatically if needed)
  useEffect(() => {
    const fetchUserData = async () => {
      // Only fetch once per session
      if (hasAttemptedUserFetch) {
        return;
      }

      // Only fetch if wallet is connected
      if (!isConnected && !address) {
        return;
      }

      // If we already have user data, no need to fetch
      if (user) {
        return;
      }

      console.log('🔧 ContractCreate: Fetching user data (lazy auth will trigger if needed)');
      setHasAttemptedUserFetch(true);

      try {
        // This will trigger lazy auth automatically if no session exists
        await refreshUserData?.();
        console.log('🔧 ContractCreate: User data loaded successfully');
      } catch (error) {
        // If it fails, that's OK - we'll proceed without user data
        console.log('🔧 ContractCreate: Could not load user data, proceeding without it');
      }
    };

    fetchUserData();
  }, [isConnected, address, user, hasAttemptedUserFetch, refreshUserData]);

  // Cleanup QR polling/countdown on unmount
  useEffect(() => {
    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    };
  }, []);

  // QR countdown timer
  useEffect(() => {
    if (!qrContractAddress || qrActivationStatus === 'success') return;

    qrCountdownRef.current = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
          checkAndActivate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    };
  }, [qrContractAddress, qrActivationStatus]);

  // QR balance polling
  useEffect(() => {
    if (!qrContractAddress || !selectedTokenAddress || qrActivationStatus === 'success') return;

    const pollBalance = async () => {
      try {
        const balance = await getTokenBalance(qrContractAddress, selectedTokenAddress);
        const balanceNum = parseFloat(balance);
        const requiredAmount = parseFloat(form.amount);

        if (balanceNum >= requiredAmount && requiredAmount > 0) {
          console.log('ContractCreate: QR payment detected! Balance:', balance);
          setQrPaymentDetected(true);
        }
      } catch (error) {
        console.error('ContractCreate: Failed to poll contract balance:', error);
      }
    };

    qrPollingRef.current = setInterval(pollBalance, 10000);
    pollBalance();

    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
    };
  }, [qrContractAddress, selectedTokenAddress, form.amount, qrActivationStatus, getTokenBalance]);

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

  const checkAndActivate = useCallback(async () => {
    if (!qrContractAddress || !authenticatedFetch) return;

    setQrActivationStatus('checking');

    try {
      const response = await authenticatedFetch('/api/chain/check-and-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: qrContractAddress })
      });

      const data = await response.json();

      if (data.success) {
        setQrActivationStatus('success');
        if (qrPollingRef.current) clearInterval(qrPollingRef.current);
        if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);

        // Send payment completed event
        sendPostMessage({
          type: 'payment_completed',
          data: {
            contractId,
            amount: form.amount,
            description: form.description,
            seller: form.seller,
            orderId: order_id,
            contractAddress: qrContractAddress
          }
        });

        // Redirect after brief delay - use same logic as wallet path
        setTimeout(() => {
          if (isInIframe) {
            sendPostMessage({ type: 'close_modal' });
          } else if (isInPopup) {
            window.close();
          } else if (returnUrl && typeof returnUrl === 'string') {
            const completedUrl = buildWordPressStatusUrl('completed', {
              contract_id: contractId || '',
              contract_hash: qrContractAddress || ''
            });
            window.location.href = completedUrl;
          } else {
            router.push('/dashboard');
          }
        }, 2000);
      } else {
        console.log('ContractCreate: check-and-activate returned not successful:', data);
        setQrActivationStatus('waiting');
      }
    } catch (error) {
      console.error('ContractCreate: check-and-activate failed:', error);
      setQrActivationStatus('waiting');
    }
  }, [qrContractAddress, authenticatedFetch, contractId, form, order_id, isInIframe, isInPopup, returnUrl, router]);

  const createContractForQR = useCallback(async () => {
    if (!contractId || !config || !address || !authenticatedFetch) return;
    if (pendingExpiryTimestamp === null) {
      console.error('🔧 ContractCreate: pendingExpiryTimestamp not set; cannot deploy without the DB-stored value');
      return;
    }

    setIsCreatingContract(true);

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

      setQrContractAddress(createData.contractAddress);
      setQrCountdown(240);
    } catch (error: any) {
      console.error('ContractCreate: Failed to create contract for QR:', error);
      alert(error.message || 'Failed to create contract');
    } finally {
      setIsCreatingContract(false);
    }
  }, [contractId, config, address, authenticatedFetch, selectedTokenAddress, form, pendingExpiryTimestamp, getWeb3Service]);

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
    setIsLoading(true);

    // Reset payment steps
    setPaymentSteps([
      { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
      { id: 'transfer', label: `Transferring ${selectedTokenSymbol} to escrow`, status: 'pending' },
      { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
      { id: 'activate', label: 'Activating contract', status: 'pending' },
      { id: 'complete', label: 'Payment complete', status: 'pending' }
    ]);

    try {
      const requestedAmount = parseFloat(form.amount.trim());
      const availableBalance = parseFloat(tokenBalance);

      if (availableBalance < requestedAmount) {
        const shortfall = requestedAmount - availableBalance;
        throw new Error(
          `Insufficient ${selectedTokenSymbol} balance. You need ${requestedAmount.toFixed(4)} ${selectedTokenSymbol} but only have ${availableBalance.toFixed(4)} ${selectedTokenSymbol}. You are short ${shortfall.toFixed(4)} ${selectedTokenSymbol}.`
        );
      }

      // Step 1: Verify
      updatePaymentStep('verify', 'active');
      setLoadingMessage('Verifying wallet connection...');
      await new Promise(resolve => setTimeout(resolve, 500));
      updatePaymentStep('verify', 'completed');

      // Reuse the expiryTimestamp stored in the pending contract to avoid drift
      // between the DB value and the on-chain value.
      const expiryTimestamp = pendingExpiryTimestamp;

      // Execute direct payment
      updatePaymentStep('transfer', 'active');
      setLoadingMessage('Creating contract and transferring funds...');

      const result = await executeDirectPaymentSequence(
        {
          contractserviceId: contractId,
          tokenAddress: selectedTokenAddress,
          buyer: address || '',
          seller: form.seller,
          amount: toMicroUSDC(parseFloat(form.amount.trim())),
          expiryTimestamp,
          description: form.description
        },
        {
          authenticatedFetch,
          transferToContract,
          getWeb3Service,
          onProgress: (step, message, contractAddr) => {
            console.log(`ContractCreate Progress: ${step} - ${message}`);
            switch (step) {
              case 'contract_creation':
                setLoadingMessage('Step 1: Creating secure escrow...');
                break;
              case 'contract_confirmation':
                setLoadingMessage('Step 1.5: Waiting for contract creation...');
                break;
              case 'contract_created':
                setLoadingMessage('Step 1 complete: Contract created');
                break;
              case 'transfer':
                updatePaymentStep('transfer', 'active');
                setLoadingMessage('Step 2: Transferring funds to escrow...');
                break;
              case 'transfer_confirmation':
                updatePaymentStep('transfer', 'completed');
                updatePaymentStep('confirm', 'active');
                setLoadingMessage('Step 2.5: Confirming transfer...');
                break;
              case 'activation':
                updatePaymentStep('confirm', 'completed');
                updatePaymentStep('activate', 'active');
                setLoadingMessage('Step 3: Activating contract...');
                break;
              case 'complete':
                updatePaymentStep('activate', 'completed');
                updatePaymentStep('complete', 'completed');
                setLoadingMessage('Payment completed successfully!');
                break;
            }
          }
        }
      );

      console.log('ContractCreate: Wallet payment completed:', result);

      // Webhook verification (if webhook_url provided)
      if (result.transferTxHash && webhook_url && authenticatedFetch) {
        console.log('ContractCreate: Sending verification webhook');
        try {
          const verifyResponse = await authenticatedFetch('/api/payment/verify-and-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transaction_hash: result.transferTxHash,
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
              transactionHash: result?.transferTxHash
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
          transactionHash: result?.transferTxHash
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
            tx_hash: result?.transferTxHash || ''
          });
          window.location.href = completedUrl;
        } else {
          router.push('/dashboard');
        }
      }

    } catch (error: any) {
      console.error('ContractCreate: Wallet payment failed:', error);

      const activeStep = paymentSteps.find(s => s.status === 'active');
      if (activeStep) {
        updatePaymentStep(activeStep.id, 'error');
      }

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

      setIsLoading(false);
      setLoadingMessage('');
    }
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

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Detect mobile device for QR code vs deep link rendering
  useEffect(() => {
    const device = detectDevice();
    setIsMobileDevice(device.isMobile || device.isTablet);
  }, []);

  const buildEIP681Uri = (): string => {
    if (!qrContractAddress || !selectedTokenAddress || !config) return '';
    const chainId = config.chainId;
    const microAmount = toMicroUSDC(parseFloat(form.amount.trim()));
    return `ethereum:${selectedTokenAddress}@${chainId}/transfer?address=${qrContractAddress}&uint256=${microAmount}`;
  };

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
      console.error('🔧 ContractCreate: contractId:', contractId);
      console.error('🔧 ContractCreate: config:', !!config);
      return;
    }
    if (pendingExpiryTimestamp === null) {
      console.error('🔧 ContractCreate: pendingExpiryTimestamp not set; cannot deploy without the DB-stored value');
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
      
      // Reuse the expiryTimestamp stored in the pending contract to avoid drift
      // between the DB value and the on-chain value.
      const expiryTimestamp = pendingExpiryTimestamp;

      // Execute the complete transaction sequence with proper confirmation waiting
      updatePaymentStep('approve', 'active');

      const result = await executeContractTransactionSequence(
        {
          contractserviceId: contractId,
          tokenAddress: selectedTokenAddress,
          buyer: address || '',
          seller: form.seller,
          amount: toMicroUSDC(parseFloat(form.amount.trim())),
          expiryTimestamp: expiryTimestamp,
          description: form.description
        },
        {
          authenticatedFetch,
          approveUSDC,
          depositToContract,
          depositFundsAsProxy,
          getWeb3Service,
          onProgress: createContractProgressHandler({
            setLoadingMessage,
            updatePaymentStep
          }, 'Step'),
          useProxyDeposit: true
        }
      );

      // result now contains: { contractAddress, contractCreationTxHash?, approvalTxHash, depositTxHash }

      console.log('🔧 ContractCreate: Payment completed successfully:', result);

      // Add debugging for transaction verification
      if (result.depositTxHash) {
        console.log('🔧 ContractCreate: Deposit transaction hash received:', result.depositTxHash);
        console.log(`🔧 ContractCreate: Contract address should receive ${selectedTokenSymbol}:`, result.contractAddress);

        // If webhook_url is provided, verify payment and send webhook
        if (webhook_url && authenticatedFetch) {
          console.log('🔧 ContractCreate: Webhook URL provided, sending verification webhook');
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
        // In popup - just close popup (DON'T redirect opener)
        // The SDK will handle showing verification success/failure in the parent window
        setTimeout(() => {
          // NOTE: We do NOT redirect the opener window here anymore
          // The SDK receives the postMessage and handles verification/display
          // Redirecting would clear the SDK's verification UI

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
        // For SDK usage: Don't redirect - let SDK handle error display
        // Just close the popup if we're in one
        if (isInPopup) {
          setTimeout(() => window.close(), 2000);
        } else if (!isInIframe) {
          // Only show alert if not in popup/iframe (direct page access)
          alert(error.message || 'Payment failed');
        }
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
        <div className="text-center p-6 max-w-md mx-auto">
          {paymentMethod === 'qr' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Sign in to protect your payment -- if there is ever a problem, you will be able to raise a dispute.
              </p>
            </div>
          )}

          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">
            {paymentMethod === 'wallet' ? 'Connect Your Wallet' : 'Sign In to Continue'}
          </h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">
            {paymentMethod === 'wallet'
              ? 'Connect your wallet to complete the payment.'
              : 'Sign in with your email or wallet to proceed.'}
          </p>
          <ConnectWalletEmbedded
            compact={true}
            useSmartRouting={false}
            showTwoOptionLayout={true}
            connectionMode={paymentMethod === 'qr' ? 'social-only' : 'default'}
            autoConnect={true}
            onSuccess={() => {
              console.log('🔧 ContractCreate: Auth success callback triggered');
            }}
          />
          <button
            onClick={() => setPaymentMethod(null)}
            className="mt-4 text-sm text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200 underline"
          >
            Back to payment options
          </button>
        </div>
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
                {!isLoading && !qrContractAddress && (
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
                  <div className="mb-6 p-4 bg-secondary-50 dark:bg-secondary-800 rounded-lg">
                    <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-3">Payment Progress</h3>
                    <div className="space-y-2">
                      {paymentSteps.map((pStep) => (
                        <div key={pStep.id} className="flex items-center">
                          <div className="flex-shrink-0 mr-3">
                            {pStep.status === 'completed' ? (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            ) : pStep.status === 'active' ? (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <LoadingSpinner className="w-3 h-3 text-white" />
                              </div>
                            ) : pStep.status === 'error' ? (
                              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-5 h-5 bg-secondary-300 dark:bg-secondary-600 rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm ${
                              pStep.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                              pStep.status === 'active' ? 'text-blue-700 dark:text-blue-400 font-medium' :
                              pStep.status === 'error' ? 'text-red-700 dark:text-red-400' :
                              'text-secondary-500 dark:text-secondary-400'
                            }`}>
                              {pStep.label}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {loadingMessage && (
                      <p className="mt-3 text-sm text-secondary-600 dark:text-secondary-300 italic whitespace-pre-line">{loadingMessage}</p>
                    )}
                  </div>
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
                {!isCreatingContract && !qrContractAddress && (
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
                {!qrContractAddress && (
                  <div className="text-center">
                    <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
                      First, we need to create a secure escrow contract on the blockchain. Then you will get a payment link to send your payment.
                    </p>
                    <Button
                      onClick={createContractForQR}
                      disabled={isCreatingContract}
                      className="w-full"
                    >
                      {isCreatingContract ? (
                        <>
                          <LoadingSpinner className="w-4 h-4 mr-2" />
                          Creating contract...
                        </>
                      ) : (
                        'Generate Payment Link'
                      )}
                    </Button>
                  </div>
                )}

                {/* Step 2: Show QR code and payment instructions */}
                {qrContractAddress && qrActivationStatus !== 'success' && (
                  <div>
                    {/* Payment detected banner */}
                    {qrPaymentDetected && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 mb-4">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                          Payment detected! Verifying...
                        </p>
                      </div>
                    )}

                    {/* QR Code (desktop) or Deep Link button (mobile) */}
                    {isMobileDevice ? (
                      <div className="mb-4 space-y-3">
                        <Button
                          onClick={() => { window.location.href = buildEIP681Uri(); }}
                          className="w-full"
                        >
                          Open in Wallet App
                        </Button>
                        <p className="text-xs text-center text-secondary-500 dark:text-secondary-400">
                          Tap to open your wallet app with the payment pre-filled
                        </p>
                      </div>
                    ) : (
                      <div className="flex justify-center mb-4">
                        <div className="bg-white p-4 rounded-lg border-2 border-secondary-200 shadow-sm">
                          <QRCodeSVG
                            value={buildEIP681Uri()}
                            size={200}
                            level="M"
                            includeMargin={true}
                          />
                        </div>
                      </div>
                    )}

                    {/* Contract address with copy */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-secondary-500 dark:text-secondary-400 mb-1">
                        Pay-to Address
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={qrContractAddress}
                          className="flex-1 border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-xs bg-secondary-50 dark:bg-secondary-800 font-mono text-secondary-900 dark:text-secondary-100"
                          onClick={(e) => e.currentTarget.select()}
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleCopyAddress(qrContractAddress)}
                          className="whitespace-nowrap flex-shrink-0 text-xs"
                        >
                          {copiedAddress ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    </div>

                    {/* Payment instructions */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-4">
                      <h4 className="font-medium text-blue-900 dark:text-blue-200 text-sm mb-2">Payment Instructions</h4>
                      <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
                        <li>Network: <span className="font-medium">{networkName}</span></li>
                        <li>Token: <span className="font-medium">{selectedTokenSymbol}</span></li>
                        <li>Amount: <span className="font-medium">{parseFloat(form.amount).toFixed(4)} {selectedTokenSymbol}</span></li>
                      </ul>
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                      <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium">
                        Send exactly {parseFloat(form.amount).toFixed(4)} {selectedTokenSymbol} -- do not send more or less.
                      </p>
                    </div>

                    {/* Countdown and activation controls */}
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-sm text-secondary-500 dark:text-secondary-400">
                          Auto-checking in <span className="font-mono font-medium text-secondary-900 dark:text-white">{formatCountdown(qrCountdown)}</span>
                        </p>
                      </div>

                      {qrActivationStatus === 'checking' && (
                        <div className="flex items-center justify-center text-sm text-blue-600 dark:text-blue-400">
                          <LoadingSpinner className="w-4 h-4 mr-2" />
                          Checking payment status...
                        </div>
                      )}
                      {qrActivationStatus === 'waiting' && (
                        <p className="text-center text-sm text-yellow-600 dark:text-yellow-400">
                          Still waiting for payment... The timer and button remain active for retry.
                        </p>
                      )}

                      <Button
                        onClick={checkAndActivate}
                        disabled={qrActivationStatus === 'checking'}
                        className="w-full"
                      >
                        {qrActivationStatus === 'checking' ? (
                          <>
                            <LoadingSpinner className="w-4 h-4 mr-2" />
                            Checking...
                          </>
                        ) : (
                          'I have paid'
                        )}
                      </Button>

                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Success state */}
                {qrActivationStatus === 'success' && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">Payment Confirmed!</h3>
                    <p className="text-sm text-secondary-600 dark:text-secondary-300">Your payment has been verified and the contract is now active. Redirecting...</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}