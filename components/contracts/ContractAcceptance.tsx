import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useWeb3SDK } from '@/hooks/useWeb3SDK';
import { PendingContract, CreateContractRequest } from '@/types';
import { ERC20_ABI, ESCROW_CONTRACT_ABI } from '@conduit-ucpi/sdk';
import { ethers } from 'ethers';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ContractAcceptanceProps {
  contract: PendingContract;
  onAcceptComplete: () => void;
}

export default function ContractAcceptance({ contract, onAcceptComplete }: ContractAcceptanceProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch, signMessage } = useAuth();
  const { getUserAddress, getUSDCBalance, signContractTransaction, utils, isReady, error: sdkError } = useWeb3SDK();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleAccept = async () => {
    if (!config) {
      alert('Configuration not loaded');
      return;
    }

    // Prevent double-clicks
    if (isLoading || isSuccess) return;

    setIsLoading(true);
    setLoadingMessage('Checking contract status...');
    setHasError(false);

    try {
      // First, get fresh contract data to check status
      const contractResponse = await authenticatedFetch(`/api/contracts/${contract.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!contractResponse.ok) {
        const errorData = await contractResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch contract status');
      }

      const freshContract = await contractResponse.json();

      // Check if contract is already being processed
      if (freshContract.state === 'IN-PROCESS') {
        throw new Error('This contract is already being processed. Please wait and refresh the page.');
      }

      // Only proceed if state is OK
      if (freshContract.state && freshContract.state !== 'OK') {
        throw new Error(`Contract cannot be accepted. State: ${freshContract.state}`);
      }

      setLoadingMessage('Initializing...');
      
      // Check if user is authenticated and has wallet address
      if (!user?.walletAddress) {
        throw new Error('Please connect your wallet first.');
      }
      
      // Use the wallet address from the authenticated user directly
      const userAddress = user.walletAddress;
      
      console.log('User from auth context:', user);
      console.log('Using actual user wallet address:', userAddress);
      
      // Verify that the current user's email matches the contract's buyer email (if specified)
      if (contract.buyerEmail && user?.email !== contract.buyerEmail) {
        throw new Error(`This contract is for ${contract.buyerEmail}, but you are logged in as ${user?.email}. Please log in with the correct account.`);
      }

      // Skip USDC balance check for now when SDK is not ready
      setLoadingMessage('Preparing contract...');
      console.log('Checking balance for address:', userAddress);
      console.log('USDC Contract Address:', config.usdcContractAddress);
      
      // Use currency utility to handle any amount/currency format
      const requiredUSDC: number = utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').numericAmount : (typeof contract.amount === 'number' ? contract.amount : parseFloat(String(contract.amount)));
      console.log('Required USDC amount:', requiredUSDC);
      console.log('Contract amount:', contract.amount);
      console.log('Contract currency:', contract.currency);
      
      // Note: USDC balance check skipped when SDK not available

      // Create on-chain contract (same as old flow)
      setLoadingMessage('Creating secure escrow...');

      // Convert to microUSDC format for blockchain operations
      const amountInMicroUSDC = utils?.toMicroUSDC ? utils.toMicroUSDC(utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').numericAmount : contract.amount) : (contract.amount * 1000000);
      const amountInSmallestUnit = amountInMicroUSDC.toString();

      const contractRequest: CreateContractRequest = {
        buyer: userAddress,
        seller: contract.sellerAddress,
        amount: amountInSmallestUnit,
        expiryTimestamp: contract.expiryTimestamp,
        description: contract.description,
        serviceLink: config.serviceLink
      };

      const response = await authenticatedFetch('/api/chain/create-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Contract creation failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Contract creation failed');
      }

      const contractAddress = result.contractAddress;
      if (!contractAddress) {
        throw new Error('Contract address not returned from chain service');
      }

      // USDC approval - sign transaction first, then send to API
      setLoadingMessage('Approving USDC spending for escrow...');
      
      // Convert to USDC format for approval (preserve precision for Web3)
      const usdcAmount = utils?.toUSDCForWeb3 ? utils.toUSDCForWeb3(contract.amount, contract.currency || 'microUSDC') : contract.amount.toString();
      const decimals = 6; // USDC has 6 decimals
      const amountWei = ethers.parseUnits(usdcAmount, decimals);
      
      const approvalTx = await signContractTransaction({
        contractAddress: config.usdcContractAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        functionArgs: [contractAddress, amountWei],
        debugLabel: 'USDC APPROVAL'
      });

      const approvalResponse = await authenticatedFetch('/api/chain/approve-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: userAddress,
          signedTransaction: approvalTx
        })
      });

      if (!approvalResponse.ok) {
        const errorData = await approvalResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'USDC approval failed');
      }

      const approvalResult = await approvalResponse.json();
      if (!approvalResult.success) {
        throw new Error(approvalResult.error || 'USDC approval failed');
      }

      // Fund the contract - sign transaction first, then send to API
      setLoadingMessage('Depositing funds to escrow...');
      
      const depositTx = await signContractTransaction({
        contractAddress,
        abi: ESCROW_CONTRACT_ABI,
        functionName: 'depositFunds',
        functionArgs: [],
        debugLabel: 'DEPOSIT'
      });

      const depositResponse = await authenticatedFetch('/api/chain/deposit-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          userWalletAddress: userAddress,
          signedTransaction: depositTx,
          contractId: contract.id,
          buyerEmail: contract.buyerEmail,
          sellerEmail: contract.sellerEmail,
          contractDescription: contract.description,
          amount: amountInMicroUSDC.toString(),
          currency: "USDC",
          payoutDateTime: utils?.formatDateTimeWithTZ ? utils.formatDateTimeWithTZ(contract.expiryTimestamp) : new Date(contract.expiryTimestamp * 1000).toISOString(),
          contractLink: config.serviceLink
        })
      });

      if (!depositResponse.ok) {
        const errorData = await depositResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fund deposit failed');
      }

      const depositResult = await depositResponse.json();
      if (!depositResult.success) {
        throw new Error(depositResult.error || 'Fund deposit failed');
      }

      // Contract service update is now handled by chain service

      // Mark as success to prevent double-clicks during redirect
      setIsSuccess(true);
      setLoadingMessage('Success! Redirecting...');

      // Notify parent component
      onAcceptComplete();

      // Redirect to dashboard with error handling
      try {
        await router.push('/dashboard');
      } catch (error) {
        console.error('Redirect failed:', error);
        // Fallback: reload the page to trigger navigation
        window.location.href = '/dashboard';
      }

      // Fallback timeout in case redirect doesn't work
      setTimeout(() => {
        if (window.location.pathname !== '/dashboard') {
          window.location.href = '/dashboard';
        }
      }, 3000);
    } catch (error: any) {
      console.error('Contract acceptance failed:', error);
      setHasError(true);
      alert(error.message || 'Failed to accept contract');
      // Only re-enable on error
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  if (isLoading || isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">{loadingMessage}</p>
        {isSuccess && (
          <p className="mt-2 text-green-600 font-medium">Contract accepted successfully!</p>
        )}
      </div>
    );
  }

  // Show processing state if contract is already being processed
  if (contract.state === 'IN-PROCESS') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Being Processed</h3>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="font-medium">${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Seller:</span>
            <span>{contract.sellerEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Description:</span>
            <span className="text-right max-w-xs">{contract.description}</span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-center">
            <LoadingSpinner className="w-4 h-4 mr-2" />
            <p className="text-sm text-blue-800">
              This contract is currently being processed. Please wait and refresh the page to see updates.
            </p>
          </div>
        </div>

        <Button
          disabled={true}
          className="w-full bg-gray-400 cursor-not-allowed opacity-50"
        >
          Processing...
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Make time-lock payment</h3>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount:</span>
          <span className="font-medium">${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Seller:</span>
          <span>{contract.sellerEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Description:</span>
          <span className="text-right max-w-xs">{contract.description}</span>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
        <p className="text-sm text-yellow-800">
          When you make this payment, the ${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC will be held securely in escrow until {utils?.formatDateTimeWithTZ ? utils.formatDateTimeWithTZ(contract.expiryTimestamp) : new Date(contract.expiryTimestamp * 1000).toISOString()}.
        </p>
      </div>

      <Button
        onClick={handleAccept}
        disabled={isLoading || isSuccess}
        className={`w-full bg-primary-500 hover:bg-primary-600 ${(isLoading || isSuccess) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Make Payment of ${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC
      </Button>
    </div>
  );
}