import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { QRCodeSVG } from 'qrcode.react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { useTokenSelection } from '@/hooks/useTokenSelection';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import WalletInfo from '@/components/ui/WalletInfo';
import TokenGuide from '@/components/ui/TokenGuide';
import { toMicroUSDC, toUSDCForWeb3, formatDateTimeWithTZ, displayCurrency } from '@/utils/validation';
import { executeContractTransactionSequence, executeDirectPaymentSequence } from '@/utils/contractTransactionSequence';
import { createContractProgressHandler } from '@/utils/contractProgressHandler';
import { getNetworkName } from '@/utils/networkUtils';
import { detectDevice } from '@/utils/deviceDetection';
import { PendingContract } from '@/types';

type PaymentStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
};

type PaymentMethod = 'wallet' | 'qr' | null;

export default function ContractPay() {
  console.log('ContractPay: Component mounted/rendered');

  const router = useRouter();
  const { contractId } = router.query;
  const { config } = useConfig();
  const { user, authenticatedFetch, isLoading: authLoading, isConnected, address, refreshUserData } = useAuth();
  const {
    approveUSDC, depositToContract, depositFundsAsProxy,
    getWeb3Service, transferToContract, getTokenBalance
  } = useSimpleEthers();

  // State
  const [contract, setContract] = useState<PendingContract | null>(null);
  const [isLoadingContract, setIsLoadingContract] = useState(true);
  const [contractError, setContractError] = useState<string | null>(null);
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [hasAttemptedUserFetch, setHasAttemptedUserFetch] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);

  // QR flow state
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [qrContractAddress, setQrContractAddress] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(240); // 4 minutes
  const [qrPaymentDetected, setQrPaymentDetected] = useState(false);
  const [qrActivationStatus, setQrActivationStatus] = useState<'idle' | 'checking' | 'success' | 'waiting'>('idle');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const qrPollingRef = useRef<NodeJS.Timeout | null>(null);
  const qrCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Wallet flow payment steps
  const [paymentSteps, setPaymentSteps] = useState<PaymentStep[]>([
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

  // Fetch user data when wallet connects
  useEffect(() => {
    const fetchUserData = async () => {
      if (hasAttemptedUserFetch) return;
      if (!isConnected && !address) return;
      if (user) return;

      console.log('ContractPay: Fetching user data (lazy auth will trigger if needed)');
      setHasAttemptedUserFetch(true);

      try {
        await refreshUserData?.();
        console.log('ContractPay: User data loaded successfully');
      } catch (error) {
        console.log('ContractPay: Could not load user data, proceeding without it');
      }
    };

    fetchUserData();
  }, [isConnected, address, user, hasAttemptedUserFetch, refreshUserData]);

  // Fetch contract details - only after user is authenticated
  useEffect(() => {
    const fetchContract = async () => {
      if (!contractId || typeof contractId !== 'string') {
        setIsLoadingContract(false);
        return;
      }

      // Don't attempt fetch until user is connected and we have authenticatedFetch
      if (!isConnected && !address) {
        setIsLoadingContract(false);
        return;
      }

      if (!authenticatedFetch) {
        setIsLoadingContract(false);
        return;
      }

      setIsLoadingContract(true);
      setContractError(null);

      try {
        console.log('ContractPay: Fetching contract:', contractId);

        const response = await authenticatedFetch(`/api/contracts/${contractId}`, {
          method: 'GET'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch contract');
        }

        const contractData = await response.json();
        console.log('ContractPay: Contract fetched:', contractData);

        // Validate contract state
        if (contractData.contractAddress) {
          setContractError('This payment request has already been paid.');
          setIsLoadingContract(false);
          return;
        }

        if (contractData.expiryTimestamp && contractData.expiryTimestamp !== 0) {
          const now = Math.floor(Date.now() / 1000);
          if (contractData.expiryTimestamp < now) {
            setContractError('This payment request has expired.');
            setIsLoadingContract(false);
            return;
          }
        }

        setContract(contractData);
      } catch (error: any) {
        console.error('ContractPay: Failed to fetch contract:', error);
        setContractError(error.message || 'Failed to load payment request');
      } finally {
        setIsLoadingContract(false);
      }
    };

    fetchContract();
  }, [contractId, authenticatedFetch, isConnected, address]);

  // Fetch token balance when contract is loaded
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (address && selectedTokenAddress && config?.rpcUrl && contract) {
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
          console.log(`ContractPay: ${selectedTokenSymbol} balance:`, formattedBalance);
        } catch (error) {
          console.error(`Failed to fetch ${selectedTokenSymbol} balance:`, error);
          setTokenBalance('0');
        } finally {
          setIsLoadingBalance(false);
        }
      }
    };

    fetchTokenBalance();
  }, [address, selectedTokenAddress, selectedTokenSymbol, config?.rpcUrl, contract]);

  // Update payment step status
  const updatePaymentStep = (stepId: string, status: 'active' | 'completed' | 'error') => {
    setPaymentSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        return { ...step, status };
      }
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

  // Cleanup QR polling and countdown on unmount
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
          // Timer reached zero - auto-fire check-and-activate
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
        const requiredAmount = contract ? contract.amount / 1000000 : 0;

        if (balanceNum >= requiredAmount && requiredAmount > 0) {
          console.log('ContractPay: QR payment detected! Balance:', balance);
          setQrPaymentDetected(true);
        }
      } catch (error) {
        console.error('ContractPay: Failed to poll contract balance:', error);
      }
    };

    // Poll every 10 seconds
    qrPollingRef.current = setInterval(pollBalance, 10000);
    // Also poll immediately
    pollBalance();

    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
    };
  }, [qrContractAddress, selectedTokenAddress, contract, qrActivationStatus, getTokenBalance]);

  // Check and activate contract (QR path)
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
        // Stop polling
        if (qrPollingRef.current) clearInterval(qrPollingRef.current);
        if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
        // Redirect after a brief delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        console.log('ContractPay: check-and-activate returned not successful:', data);
        setQrActivationStatus('waiting');
      }
    } catch (error) {
      console.error('ContractPay: check-and-activate failed:', error);
      setQrActivationStatus('waiting');
    }
  }, [qrContractAddress, authenticatedFetch, router]);

  // Create on-chain contract for QR path
  const createContractForQR = useCallback(async () => {
    if (!contract || !config || !address || !authenticatedFetch) return;

    setIsCreatingContract(true);

    try {
      const createResponse = await authenticatedFetch('/api/chain/create-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractserviceId: contract.id,
          tokenAddress: selectedTokenAddress,
          buyer: address,
          seller: contract.sellerAddress,
          amount: contract.amount,
          expiryTimestamp: contract.expiryTimestamp,
          description: contract.description
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Contract creation failed');
      }

      const createData = await createResponse.json();
      console.log('ContractPay: QR contract created:', createData);

      // Wait for confirmation if we have a tx hash
      if (createData.transactionHash) {
        const web3Service = await getWeb3Service();
        await web3Service.waitForTransaction(createData.transactionHash, 120000, contract.id);
      }

      setQrContractAddress(createData.contractAddress);
      setQrCountdown(240); // Reset countdown
    } catch (error: any) {
      console.error('ContractPay: Failed to create contract for QR:', error);
      alert(error.message || 'Failed to create contract');
    } finally {
      setIsCreatingContract(false);
    }
  }, [contract, config, address, authenticatedFetch, selectedTokenAddress, getWeb3Service]);

  // Handle wallet-connected payment (direct transfer)
  const handleWalletPayment = async () => {
    if (!contract || !config || !address) {
      console.error('ContractPay: Missing required data for payment');
      return;
    }

    console.log('ContractPay: Starting wallet payment process');
    setIsPaymentInProgress(true);

    // Reset payment steps
    setPaymentSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));

    try {
      // Check balance
      const requestedAmountInTokens = contract.amount / 1000000;
      const availableBalance = parseFloat(tokenBalance);

      if (availableBalance < requestedAmountInTokens) {
        const shortfall = requestedAmountInTokens - availableBalance;
        throw new Error(
          `Insufficient ${selectedTokenSymbol} balance. You need ${requestedAmountInTokens.toFixed(4)} ${selectedTokenSymbol} but only have ${availableBalance.toFixed(4)} ${selectedTokenSymbol}. You are short ${shortfall.toFixed(4)} ${selectedTokenSymbol}.`
        );
      }

      // Step 1: Verify wallet connection
      updatePaymentStep('verify', 'active');
      setLoadingMessage('Verifying wallet connection...');
      await new Promise(resolve => setTimeout(resolve, 500));
      updatePaymentStep('verify', 'completed');

      // Execute the direct payment sequence (transfer instead of approve+deposit)
      updatePaymentStep('transfer', 'active');
      setLoadingMessage('Creating contract and transferring funds...');

      const result = await executeDirectPaymentSequence(
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
          authenticatedFetch,
          transferToContract,
          getWeb3Service,
          onProgress: (step, message, contractAddr) => {
            console.log(`ContractPay Progress: ${step} - ${message}`);
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

      console.log('ContractPay: Wallet payment completed successfully:', result);

      setLoadingMessage('Payment completed! Redirecting...');

      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('ContractPay: Wallet payment failed:', error);

      const activeStep = paymentSteps.find(s => s.status === 'active');
      if (activeStep) {
        updatePaymentStep(activeStep.id, 'error');
      }

      alert(error.message || 'Payment failed');
      setIsPaymentInProgress(false);
      setLoadingMessage('');
    }
  };

  // Legacy payment handler (approve + deposit flow for backward compatibility)
  const handleLegacyPayment = async () => {
    if (!contract || !config || !address) {
      console.error('ContractPay: Missing required data for payment');
      return;
    }

    console.log('ContractPay: Starting legacy payment process');
    setIsPaymentInProgress(true);

    // Reset payment steps to legacy steps
    setPaymentSteps([
      { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
      { id: 'approve', label: `Approving ${selectedTokenSymbol} payment`, status: 'pending' },
      { id: 'escrow', label: 'Securing funds in escrow', status: 'pending' },
      { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
      { id: 'complete', label: 'Payment complete', status: 'pending' }
    ]);

    try {
      const requestedAmountInTokens = contract.amount / 1000000;
      const availableBalance = parseFloat(tokenBalance);

      if (availableBalance < requestedAmountInTokens) {
        const shortfall = requestedAmountInTokens - availableBalance;
        throw new Error(
          `Insufficient ${selectedTokenSymbol} balance. You need ${requestedAmountInTokens.toFixed(4)} ${selectedTokenSymbol} but only have ${availableBalance.toFixed(4)} ${selectedTokenSymbol}. You are short ${shortfall.toFixed(4)} ${selectedTokenSymbol}.`
        );
      }

      updatePaymentStep('verify', 'active');
      setLoadingMessage('Verifying wallet connection...');
      await new Promise(resolve => setTimeout(resolve, 500));
      updatePaymentStep('verify', 'completed');

      updatePaymentStep('approve', 'active');

      const result = await executeContractTransactionSequence(
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

      console.log('ContractPay: Legacy payment completed successfully:', result);
      setLoadingMessage('Payment completed! Redirecting...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('ContractPay: Legacy payment failed:', error);
      const activeStep = paymentSteps.find(s => s.status === 'active');
      if (activeStep) {
        updatePaymentStep(activeStep.id, 'error');
      }
      alert(error.message || 'Payment failed');
      setIsPaymentInProgress(false);
      setLoadingMessage('');
    }
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

  // Format countdown time
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

  // Build EIP-681 QR value for direct token transfer
  const buildEIP681Uri = (): string => {
    if (!qrContractAddress || !selectedTokenAddress || !contract || !config) return '';
    const chainId = config.chainId;
    // EIP-681 format: ethereum:<tokenAddress>@<chainId>/transfer?address=<recipient>&uint256=<amount>
    return `ethereum:${selectedTokenAddress}@${chainId}/transfer?address=${qrContractAddress}&uint256=${contract.amount}`;
  };

  // ================================================================
  // RENDER SECTION
  // ================================================================

  const pageTitle = 'Pay Contract - Conduit UCPI';

  // Loading screen for initialization
  if (!config || (authLoading && !isConnected && !address)) {
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
  // STAGE 1: Payment Method Choice (before auth or when not connected)
  // Contract data is NOT loaded yet — we show a generic prompt.
  // ================================================================
  if (!isConnected && !address) {
    // If payment method not chosen yet, show choice
    if (paymentMethod === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
          <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
          <div className="p-6 max-w-md mx-auto">
            {/* Buyer protection callout */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                You have received a secure payment request
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
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-secondary-900 transition-colors">
        <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
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
              console.log('ContractPay: Auth success callback triggered');
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
  const cannotPay = hasInsufficientBalance || isSameAddress;
  const networkName = config ? getNetworkName(config.chainId) : 'Unknown Network';

  // If user connected without choosing a method (e.g., already connected), default to wallet
  const effectiveMethod = paymentMethod || 'wallet';

  return (
    <div className="min-h-screen bg-white dark:bg-secondary-900 transition-colors">
      <Head><title>{pageTitle}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>

      <div className="container mx-auto p-6 max-w-md mx-auto">
        {/* Wallet Info Section */}
        <WalletInfo
          className="mb-4"
          tokenSymbol={selectedTokenSymbol}
          tokenAddress={selectedTokenAddress}
        />

        <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">Payment Request</h2>

          {/* Contract Details */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Amount:</span>
              <span className="font-medium text-lg">
                {displayCurrency(contract.amount, contract.currency || 'microUSDC')}
              </span>
            </div>
            {effectiveMethod === 'wallet' && (
              <div className="flex justify-between">
                <span className="text-secondary-600 dark:text-secondary-300">Your Balance:</span>
                <span className={`font-medium ${hasInsufficientBalance ? 'text-red-600' : 'text-green-600'}`}>
                  {isLoadingBalance ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    `${balanceFloat.toFixed(4)} ${selectedTokenSymbol}`
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Seller:</span>
              <span className="text-sm font-mono">{contract.sellerAddress.slice(0, 6)}...{contract.sellerAddress.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Payout Date:</span>
              <span className="font-medium">
                {isInstantPayment ? 'Instant (no delay)' : formatDateTimeWithTZ(contract.expiryTimestamp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600 dark:text-secondary-300">Description:</span>
              <span className="text-right max-w-xs text-sm">{contract.description}</span>
            </div>
          </div>

          {/* Payment method selector (can switch if not in progress) */}
          {!isPaymentInProgress && !qrContractAddress && (
            <div className="flex mb-6 bg-secondary-100 dark:bg-secondary-800 rounded-lg p-1">
              <button
                onClick={() => setPaymentMethod('wallet')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  effectiveMethod === 'wallet'
                    ? 'bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm'
                    : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
                }`}
              >
                Wallet Transfer
              </button>
              <button
                onClick={() => setPaymentMethod('qr')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  effectiveMethod === 'qr'
                    ? 'bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm'
                    : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
                }`}
              >
                QR Code
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
                <div className="mb-6 p-4 bg-secondary-50 dark:bg-secondary-800 rounded-lg">
                  <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-3">Payment Progress</h3>
                  <div className="space-y-2">
                    {paymentSteps.map((step) => (
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
                            <div className="w-5 h-5 bg-secondary-300 dark:bg-secondary-600 rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${
                            step.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                            step.status === 'active' ? 'text-blue-700 dark:text-blue-400 font-medium' :
                            step.status === 'error' ? 'text-red-700 dark:text-red-400' :
                            'text-secondary-500 dark:text-secondary-400'
                          }`}>
                            {step.label}
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

              {/* Warnings */}
              {isSameAddress ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">Cannot Pay Yourself</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    You cannot pay this contract because your wallet address matches the seller's address. The buyer and seller must be different accounts.
                  </p>
                </div>
              ) : hasInsufficientBalance ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-6">
                  <div className="p-4">
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium">Insufficient Balance</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      You need {amountInTokens.toFixed(4)} {selectedTokenSymbol} but only have {balanceFloat.toFixed(4)} {selectedTokenSymbol}.
                      Please add {(amountInTokens - balanceFloat).toFixed(4)} {selectedTokenSymbol} to your wallet before proceeding.
                    </p>
                  </div>
                  <details className="border-t border-red-200 dark:border-red-800">
                    <summary className="cursor-pointer p-3 text-sm font-medium text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30">
                      How to add {selectedTokenSymbol} to your wallet
                    </summary>
                    <div className="p-3 pt-0">
                      <TokenGuide />
                    </div>
                  </details>
                </div>
              ) : !isPaymentInProgress && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    {isInstantPayment
                      ? `Your ${displayCurrency(contract.amount, contract.currency || 'microUSDC')} will be released to the seller immediately after payment confirmation.`
                      : `Your ${displayCurrency(contract.amount, contract.currency || 'microUSDC')} will be held securely in escrow and released to the seller on the payout date unless you raise a dispute.`
                    }
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="outline"
                  className="flex-1"
                  disabled={isPaymentInProgress}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleWalletPayment}
                  disabled={isPaymentInProgress || isLoadingBalance || cannotPay}
                  className="flex-1"
                  title={
                    isSameAddress
                      ? 'Cannot pay yourself - buyer and seller must be different accounts'
                      : hasInsufficientBalance
                      ? `Insufficient balance: need ${amountInTokens.toFixed(4)} ${selectedTokenSymbol}, have ${balanceFloat.toFixed(4)} ${selectedTokenSymbol}`
                      : ''
                  }
                >
                  {isPaymentInProgress ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      {loadingMessage?.match(/Step \d+/)?.[0] || 'Processing...'}
                    </>
                  ) : (
                    `Pay ${displayCurrency(contract.amount, contract.currency || 'microUSDC')}`
                  )}
                </Button>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* STAGE 3b: QR Code Payment */}
          {/* ============================================================ */}
          {effectiveMethod === 'qr' && (
            <>
              {/* Step 1: Create the contract first */}
              {!qrContractAddress && (
                <div className="text-center">
                  <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
                    First, we need to create a secure escrow contract on the blockchain. Then you will get a payment link to send your payment.
                  </p>
                  <Button
                    onClick={createContractForQR}
                    disabled={isCreatingContract || isSameAddress}
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
                  {isSameAddress && (
                    <p className="text-sm text-red-600 mt-2">Cannot pay yourself - buyer and seller must be different accounts.</p>
                  )}
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
                      <li>Amount: <span className="font-medium">{amountInTokens.toFixed(4)} {selectedTokenSymbol}</span></li>
                    </ul>
                  </div>

                  {/* Warning */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium">
                      Send exactly {amountInTokens.toFixed(4)} {selectedTokenSymbol} -- do not send more or less.
                    </p>
                  </div>

                  {/* Countdown and activation controls */}
                  <div className="space-y-3">
                    {/* Countdown */}
                    <div className="text-center">
                      <p className="text-sm text-secondary-500 dark:text-secondary-400">
                        Auto-checking in <span className="font-mono font-medium text-secondary-900 dark:text-white">{formatCountdown(qrCountdown)}</span>
                      </p>
                    </div>

                    {/* Activation status messages */}
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

                    {/* I have paid button */}
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
                      onClick={() => router.push('/dashboard')}
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
                  <p className="text-sm text-secondary-600 dark:text-secondary-300">Your payment has been verified and the contract is now active. Redirecting to dashboard...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
