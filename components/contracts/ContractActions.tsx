import { useState } from 'react';
import { Contract } from '@/types';
import { useConfig } from '@/components/auth/ConfigProvider';
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const handleRaiseDispute = async () => {
    if (!config || !isBuyer || contract.status !== 'active') return;

    setIsLoading(true);
    setLoadingMessage('Raising dispute...');
    
    try {
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);

      const signedTx = await web3Service.raiseDisputeTransaction(contract.contractAddress);

      const response = await fetch('/api/chain/raise-dispute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress: contract.contractAddress,
          signedTransaction: signedTx
        })
      });

      if (!response.ok) {
        throw new Error('Failed to raise dispute');
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
    if (!config || !isSeller || contract.status !== 'expired') return;

    setIsLoading(true);
    setLoadingMessage('Claiming funds...');
    
    try {
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);

      const signedTx = await web3Service.claimFundsTransaction(contract.contractAddress);

      const response = await fetch('/api/chain/claim-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress: contract.contractAddress,
          signedTransaction: signedTx
        })
      });

      if (!response.ok) {
        throw new Error('Failed to claim funds');
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

  if (contract.status === 'active' && isBuyer) {
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

  if (contract.status === 'expired' && isSeller) {
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

  if (contract.status === 'disputed') {
    return (
      <div className="text-center py-2">
        <span className="text-sm text-gray-600">Pending Resolution</span>
      </div>
    );
  }

  if (contract.status === 'resolved' || contract.status === 'completed') {
    return (
      <div className="text-center py-2">
        <span className="text-sm text-green-600 font-medium">
          {contract.status === 'resolved' ? 'Resolved' : 'Completed'}
        </span>
      </div>
    );
  }

  return null;
}