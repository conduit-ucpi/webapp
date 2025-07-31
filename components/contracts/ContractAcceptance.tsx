import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { PendingContract, CreateContractRequest } from '@/types';
import { Web3Service } from '@/lib/web3';
import { formatUSDC, formatExpiryDate } from '@/utils/validation';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ContractAcceptanceProps {
  contract: PendingContract;
  onAcceptComplete: () => void;
}

export default function ContractAcceptance({ contract, onAcceptComplete }: ContractAcceptanceProps) {
  const router = useRouter();
  const { config } = useConfig();
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
      const contractResponse = await fetch(`${router.basePath}/api/contracts/${contract.id}`, {
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
      // Use existing Web3Auth provider from global state
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);
      const userAddress = await web3Service.getUserAddress();

      // Check USDC balance
      setLoadingMessage('Checking USDC balance...');
      const balance = await web3Service.getUSDCBalance(userAddress);
      const requiredUSDC = contract.amount / 1000000; // Convert from microUSDC to USDC
      if (parseFloat(balance) < requiredUSDC) {
        throw new Error(`Insufficient USDC balance. You have ${balance} USDC, need ${requiredUSDC.toFixed(2)} USDC`);
      }

      // Create on-chain contract (same as old flow)
      setLoadingMessage('Creating secure escrow...');
      
      // Amount is already in microUSDC format (smallest unit)
      const amountInSmallestUnit = contract.amount.toString();
      
      const contractRequest: CreateContractRequest = {
        buyer: userAddress,
        seller: contract.sellerAddress,
        amount: amountInSmallestUnit,
        expiryTimestamp: contract.expiryTimestamp,
        description: contract.description
      };

      const response = await fetch(`${router.basePath}/api/chain/create-contract`, {
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

      // USDC approval
      setLoadingMessage('Approving USDC spending for escrow...');
      const usdcAmount = (contract.amount / 1000000).toString(); // Convert to USDC format for approval
      const approvalTx = await web3Service.signUSDCApproval(usdcAmount, contractAddress);

      const approvalResponse = await fetch(`${router.basePath}/api/chain/approve-usdc`, {
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

      // Fund the contract
      setLoadingMessage('Depositing funds to escrow...');
      const depositTx = await web3Service.signDepositTransaction(contractAddress);

      const depositResponse = await fetch(`${router.basePath}/api/chain/deposit-funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          userWalletAddress: userAddress,
          signedTransaction: depositTx,
          contractId: contract.id
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
      
      // Small delay to show success message before redirect
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
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
            <span className="font-medium">${formatUSDC(contract.amount)} {contract.currency}</span>
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
          <span className="font-medium">${formatUSDC(contract.amount)} {contract.currency}</span>
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
          When you make this payment, the ${formatUSDC(contract.amount)} USDC will be held securely in escrow until {formatExpiryDate(contract.expiryTimestamp)}.
        </p>
      </div>

      <Button 
        onClick={handleAccept}
        disabled={isLoading || isSuccess}
        className={`w-full bg-primary-500 hover:bg-primary-600 ${(isLoading || isSuccess) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Make Payment of ${formatUSDC(contract.amount)} USDC
      </Button>
    </div>
  );
}