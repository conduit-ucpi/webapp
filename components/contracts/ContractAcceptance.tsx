import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { PendingContract, CreateContractRequest } from '@/types';
import { Web3Service } from '@/lib/web3';
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

  const handleAccept = async () => {
    if (!config) {
      alert('Configuration not loaded');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Initializing...');

    try {
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
      if (parseFloat(balance) < contract.amount) {
        throw new Error(`Insufficient USDC balance. You have ${balance} USDC, need ${contract.amount} USDC`);
      }

      // Create on-chain contract (same as old flow)
      setLoadingMessage('Creating secure escrow...');
      const contractRequest: CreateContractRequest = {
        buyer: userAddress,
        seller: contract.sellerAddress,
        amount: contract.amount.toString(),
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
      const approvalTx = await web3Service.signUSDCApproval(contract.amount.toString(), contractAddress);

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
          signedTransaction: depositTx
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

      // Update contract service with chain details
      setLoadingMessage('Updating contract status...');
      const updateRequest = {
        chainAddress: contractAddress,
        chainId: config.chainId.toString(),
        buyerAddress: userAddress
      };

      const updateResponse = await fetch(`${router.basePath}/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest)
      });

      if (!updateResponse.ok) {
        console.warn('Failed to update contract service, but on-chain contract created successfully');
      }

      // Redirect to dashboard
      onAcceptComplete();
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Contract acceptance failed:', error);
      alert(error.message || 'Failed to accept contract');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">{loadingMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Accept Contract</h3>
      
      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount:</span>
          <span className="font-medium">{contract.amount} {contract.currency}</span>
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
          By accepting this contract, you agree to deposit {contract.amount} USDC into escrow. 
          The funds will be held securely until the contract terms are met.
        </p>
      </div>

      <Button 
        onClick={handleAccept}
        className="w-full bg-primary-500 hover:bg-primary-600"
      >
        Accept Contract & Deposit {contract.amount} USDC
      </Button>
    </div>
  );
}