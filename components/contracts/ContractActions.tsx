import { useState } from 'react';
import { useRouter } from 'next/router';
import { Contract } from '@/types';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { Web3Service } from '@/lib/web3';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ContractActionsProps {
  contract: Contract;
  isBuyer: boolean;
  isSeller: boolean;
  onAction: () => void;
}

export default function ContractActions({ contract, isBuyer, isSeller, onAction }: ContractActionsProps) {
  const { config } = useConfig();
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const handleRaiseDispute = async () => {
    if (!config || !isBuyer || contract.status !== 'ACTIVE') return;

    setIsLoading(true);
    setLoadingMessage('Raising dispute...');
    
    try {
      const response = await fetch(`${router.basePath}/api/chain/raise-dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress: contract.contractAddress
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to raise dispute');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Dispute failed');
      }

      onAction(); // Refresh contracts
    } catch (error: any) {
      console.error('Dispute failed:', error);
      alert(error.message || 'Failed to raise dispute');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleClaimFunds = async () => {
    if (!config || !isSeller || contract.status !== 'EXPIRED' || !user) return;

    setIsLoading(true);
    setLoadingMessage('Initializing...');
    
    try {
      // Get Web3Auth provider
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);
      const userAddress = await web3Service.getUserAddress();

      // Sign claim transaction
      setLoadingMessage('Signing claim transaction...');
      const signedTx = await web3Service.signClaimTransaction(contract.contractAddress);

      // Submit signed transaction to chain service
      setLoadingMessage('Claiming funds...');
      const response = await fetch(`${router.basePath}/api/chain/claim-funds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress: contract.contractAddress,
          userWalletAddress: userAddress,
          signedTransaction: signedTx
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to claim funds');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Claim failed');
      }

      onAction(); // Refresh contracts
    } catch (error: any) {
      console.error('Claim failed:', error);
      alert(error.message || 'Failed to claim funds');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  if (contract.status === 'ACTIVE' && isBuyer) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleRaiseDispute}
        disabled={isLoading}
        className="w-full border-red-300 text-red-700 hover:bg-red-50"
      >
        {isLoading ? (
          <>
            <LoadingSpinner className="w-4 h-4 mr-2" />
            {loadingMessage}
          </>
        ) : (
          'Raise Dispute'
        )}
      </Button>
    );
  }

  if (contract.status === 'EXPIRED' && isSeller) {
    return (
      <Button
        size="sm"
        onClick={handleClaimFunds}
        disabled={isLoading}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {isLoading ? (
          <>
            <LoadingSpinner className="w-4 h-4 mr-2" />
            {loadingMessage}
          </>
        ) : (
          'Claim Funds'
        )}
      </Button>
    );
  }

  if (contract.status === 'DISPUTED') {
    return (
      <div className="text-center py-2">
        <span className="text-sm text-gray-600">Pending Resolution</span>
      </div>
    );
  }

  if (contract.status === 'RESOLVED' || contract.status === 'CLAIMED') {
    return (
      <div className="text-center py-2">
        <span className="text-sm text-green-600 font-medium">
          {contract.status === 'RESOLVED' ? 'Resolved' : 'Claimed'}
        </span>
      </div>
    );
  }

  return null;
}