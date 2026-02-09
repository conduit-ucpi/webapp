import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
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
import { executeContractTransactionSequence } from '@/utils/contractTransactionSequence';
import { createContractProgressHandler } from '@/utils/contractProgressHandler';
import { PendingContract } from '@/types';

type PaymentStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
};

export default function ContractPay() {
  console.log('🔧 ContractPay: Component mounted/rendered');

  const router = useRouter();
  const { contractId } = router.query;
  const { config } = useConfig();
  const { user, authenticatedFetch, isLoading: authLoading, isConnected, address, refreshUserData } = useAuth();
  const { approveUSDC, depositToContract, depositFundsAsProxy, getWeb3Service } = useSimpleEthers();

  // State
  const [contract, setContract] = useState<PendingContract | null>(null);
  const [isLoadingContract, setIsLoadingContract] = useState(true);
  const [contractError, setContractError] = useState<string | null>(null);
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [hasAttemptedUserFetch, setHasAttemptedUserFetch] = useState(false);
  const [paymentSteps, setPaymentSteps] = useState<PaymentStep[]>([
    { id: 'verify', label: 'Verifying wallet connection', status: 'pending' },
    { id: 'approve', label: 'Approving token payment', status: 'pending' },
    { id: 'escrow', label: 'Securing funds in escrow', status: 'pending' },
    { id: 'confirm', label: 'Confirming transaction on blockchain', status: 'pending' },
    { id: 'complete', label: 'Payment complete', status: 'pending' }
  ]);

  console.log('🔧 ContractPay: Query params', { contractId });

  // Extract token symbol from contract's currency field
  const contractTokenSymbol = useMemo(() => {
    if (!contract?.currency) return undefined;
    // Extract token symbol from currency field (e.g., "microUSDC" -> "USDC")
    return contract.currency.replace('micro', '').toUpperCase();
  }, [contract]);

  // Use centralized token selection logic
  const {
    selectedToken,
    selectedTokenSymbol,
    selectedTokenAddress,
    availableTokens
  } = useTokenSelection(config, contractTokenSymbol);

  // Fetch user data when wallet connects (lazy auth will trigger automatically if needed)
  useEffect(() => {
    const fetchUserData = async () => {
      if (hasAttemptedUserFetch) return;
      if (!isConnected && !address) return;
      if (user) return;

      console.log('🔧 ContractPay: Fetching user data (lazy auth will trigger if needed)');
      setHasAttemptedUserFetch(true);

      try {
        await refreshUserData?.();
        console.log('🔧 ContractPay: User data loaded successfully');
      } catch (error) {
        console.log('🔧 ContractPay: Could not load user data, proceeding without it');
      }
    };

    fetchUserData();
  }, [isConnected, address, user, hasAttemptedUserFetch, refreshUserData]);

  // Fetch contract details
  useEffect(() => {
    const fetchContract = async () => {
      if (!contractId || typeof contractId !== 'string') {
        setIsLoadingContract(false);
        return;
      }

      setIsLoadingContract(true);
      setContractError(null);

      try {
        console.log('🔧 ContractPay: Fetching contract:', contractId);

        if (!authenticatedFetch) {
          // If not authenticated yet, wait for auth to be ready
          setIsLoadingContract(false);
          return;
        }

        const response = await authenticatedFetch(`/api/contracts/${contractId}`, {
          method: 'GET'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch contract');
        }

        const contractData = await response.json();
        console.log('🔧 ContractPay: Contract fetched:', contractData);

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

        // Update payment step labels with actual token
        const tokenSymbol = contractData.currencySymbol || 'USDC';
        setPaymentSteps(prev => prev.map(step =>
          step.id === 'approve'
            ? { ...step, label: `Approving ${tokenSymbol} payment` }
            : step
        ));

        setContract(contractData);
      } catch (error: any) {
        console.error('🔧 ContractPay: Failed to fetch contract:', error);
        setContractError(error.message || 'Failed to load payment request');
      } finally {
        setIsLoadingContract(false);
      }
    };

    fetchContract();
  }, [contractId, authenticatedFetch]);

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
          console.log(`🔧 ContractPay: ${selectedTokenSymbol} balance:`, formattedBalance);
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

  const handlePayment = async () => {
    if (!contract || !config || !address) {
      console.error('🔧 ContractPay: Missing required data for payment');
      return;
    }

    console.log('🔧 ContractPay: Starting payment process');
    setIsPaymentInProgress(true);

    // Reset payment steps
    setPaymentSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));

    try {
      // Check balance
      const requestedAmountInTokens = contract.amount / 1000000; // Convert microUSDC to USDC
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

      // Execute the complete transaction sequence
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

      console.log('🔧 ContractPay: Payment completed successfully:', result);

      setLoadingMessage('Payment completed! Redirecting...');

      // Redirect to dashboard after success
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('🔧 ContractPay: Payment failed:', error);

      const activeStep = paymentSteps.find(s => s.status === 'active');
      if (activeStep) {
        updatePaymentStep(activeStep.id, 'error');
      }

      alert(error.message || 'Payment failed');
      setIsPaymentInProgress(false);
      setLoadingMessage('');
    }
  };

  // Loading screen for initialization
  if (!config || (authLoading && !isConnected && !address)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Head>
          <title>Pay Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading payment request...</p>
        </div>
      </div>
    );
  }

  // Wallet not connected - show connection UI
  if (!isConnected && !address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Head>
          <title>Pay Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="text-center p-6 max-w-md mx-auto">
          {/* Buyer protection callout */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              🛡️ You've received a secure payment request
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Your payment is protected by escrow</li>
              <li>✓ Can dispute if there's a problem</li>
              <li>✓ No gas fees - we cover blockchain costs</li>
            </ul>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connect to Complete Payment</h2>
          <p className="text-gray-600 mb-6">Choose how you'd like to pay. No crypto wallet needed - you can use your email.</p>
          <ConnectWalletEmbedded
            compact={true}
            useSmartRouting={false}
            showTwoOptionLayout={true}
            onSuccess={() => {
              console.log('🔧 ContractPay: Auth success callback triggered');
            }}
          />
        </div>
      </div>
    );
  }

  // No contract ID provided
  if (!contractId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Head>
          <title>Pay Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Invalid Payment Link</h2>
          <p className="text-gray-600 mb-6">No payment request ID was provided.</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Loading contract
  if (isLoadingContract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Head>
          <title>Pay Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading payment request...</p>
        </div>
      </div>
    );
  }

  // Contract error (expired, already paid, etc.)
  if (contractError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Head>
          <title>Pay Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Unable to Process Payment</h2>
          <p className="text-gray-600 mb-6">{contractError}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Contract not found
  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Head>
          <title>Pay Contract - Conduit UCPI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Payment Request Not Found</h2>
          <p className="text-gray-600 mb-6">The payment request could not be found.</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Main payment screen
  const amountInTokens = contract.amount / 1000000;
  const balanceFloat = parseFloat(tokenBalance);
  const hasInsufficientBalance = balanceFloat < amountInTokens;
  const isInstantPayment = contract.expiryTimestamp === 0;
  const isSameAddress = address?.toLowerCase() === contract.sellerAddress?.toLowerCase();
  const cannotPay = hasInsufficientBalance || isSameAddress;

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>Pay Contract - Conduit UCPI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="container mx-auto p-6 max-w-md mx-auto">
        {/* Wallet Info Section */}
        <WalletInfo
          className="mb-4"
          tokenSymbol={selectedTokenSymbol}
          tokenAddress={selectedTokenAddress}
        />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Request</h2>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium text-lg">
                {displayCurrency(contract.amount, contract.currency || 'microUSDC')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Your Balance:</span>
              <span className={`font-medium ${hasInsufficientBalance ? 'text-red-600' : 'text-green-600'}`}>
                {isLoadingBalance ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  `${balanceFloat.toFixed(4)} ${selectedTokenSymbol}`
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Seller:</span>
              <span className="text-sm font-mono">{contract.sellerAddress.slice(0, 6)}...{contract.sellerAddress.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payout Date:</span>
              <span className="font-medium">
                {isInstantPayment ? 'Instant (no delay)' : formatDateTimeWithTZ(contract.expiryTimestamp)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Description:</span>
              <span className="text-right max-w-xs text-sm">{contract.description}</span>
            </div>
          </div>

          {/* Payment Progress Steps */}
          {isPaymentInProgress && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Progress</h3>
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

          {/* Same address warning */}
          {isSameAddress ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-sm text-red-800 font-medium">
                ⚠️ Cannot Pay Yourself
              </p>
              <p className="text-sm text-red-700 mt-1">
                You cannot pay this contract because your wallet address matches the seller's address. The buyer and seller must be different accounts.
              </p>
            </div>
          ) : hasInsufficientBalance ? (
            <div className="bg-red-50 border border-red-200 rounded-md mb-6">
              <div className="p-4">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ Insufficient Balance
                </p>
                <p className="text-sm text-red-700 mt-1">
                  You need {amountInTokens.toFixed(4)} {selectedTokenSymbol} but only have {balanceFloat.toFixed(4)} {selectedTokenSymbol}.
                  Please add {(amountInTokens - balanceFloat).toFixed(4)} {selectedTokenSymbol} to your wallet before proceeding.
                </p>
              </div>

              {/* Expandable guide section */}
              <details className="border-t border-red-200">
                <summary className="cursor-pointer p-3 text-sm font-medium text-red-800 hover:bg-red-100">
                  💡 How to add {selectedTokenSymbol} to your wallet
                </summary>
                <div className="p-3 pt-0">
                  <TokenGuide />
                </div>
              </details>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <p className="text-sm text-yellow-800">
                {isInstantPayment
                  ? `Your ${displayCurrency(contract.amount, contract.currency || 'microUSDC')} will be released to the seller immediately after payment confirmation.`
                  : `Your ${displayCurrency(contract.amount, contract.currency || 'microUSDC')} will be held securely in escrow and released to the seller on the payout date unless you raise a dispute.`
                }
              </p>
            </div>
          )}

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
              onClick={handlePayment}
              disabled={isPaymentInProgress || isLoadingBalance || cannotPay}
              className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  {loadingMessage || 'Processing...'}
                </>
              ) : (
                `Pay ${displayCurrency(contract.amount, contract.currency || 'microUSDC')}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
