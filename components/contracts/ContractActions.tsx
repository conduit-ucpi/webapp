import { useState } from 'react';
import { useRouter } from 'next/router';
import { Contract, RaiseDisputeRequest } from '@/types';
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
  isClaimingInProgress?: boolean;
  onClaimStart?: () => void;
  onClaimComplete?: () => void;
}

export default function ContractActions({ contract, isBuyer, isSeller, onAction, isClaimingInProgress, onClaimStart, onClaimComplete }: ContractActionsProps) {
  const { config } = useConfig();
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleRaiseDispute = async () => {
    if (!config || !isBuyer || contract.status !== 'ACTIVE' || !user || isLoading) return;

    setIsLoading(true);
    setLoadingMessage('Initializing...');
    setHasError(false);
    
    try {
      // Get Web3Auth provider
      const web3authProvider = (window as any).web3authProvider;
      if (!web3authProvider) {
        throw new Error('Wallet not connected');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(web3authProvider);
      const userAddress = await web3Service.getUserAddress();

      // Sign dispute transaction
      setLoadingMessage('Signing dispute transaction...');
      const signedTx = await web3Service.signDisputeTransaction(contract.contractAddress);

      // Submit signed transaction to chain service
      setLoadingMessage('Raising dispute...');
      const disputeRequest: RaiseDisputeRequest = {
        contractAddress: contract.contractAddress,
        userWalletAddress: userAddress,
        signedTransaction: signedTx,
        buyerEmail: contract.buyerEmail || user?.email,
        sellerEmail: contract.sellerEmail,
        payoutDateTime: new Date(contract.expiryTimestamp * 1000).toISOString(),
        amount: (contract.amount / 1000000).toString(), // Convert microUSDC to USDC for display
        currency: "USDC",
        contractDescription: contract.description,
        productName: process.env.PRODUCT_NAME || contract.description
      };

      const response = await fetch(`${router.basePath}/api/chain/raise-dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(disputeRequest)
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
      // Keep button disabled after success to prevent double-clicks
      // The page will refresh with the new contract state
    } catch (error: any) {
      console.error('Dispute failed:', error);
      setHasError(true);
      alert(error.message || 'Failed to raise dispute');
      // Only re-enable button on error
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleClaimFunds = async () => {
    if (!config || !isSeller || contract.status !== 'EXPIRED' || !user || isLoading || isClaimingInProgress) return;

    setIsLoading(true);
    setLoadingMessage('Initializing...');
    setHasError(false);
    onClaimStart?.(); // Disable all claim buttons
    
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
      onClaimComplete?.(); // Re-enable all claim buttons after success
      // Keep local loading state to prevent double-clicks until page refreshes
    } catch (error: any) {
      console.error('Claim failed:', error);
      setHasError(true);
      alert(error.message || 'Failed to claim funds');
      // Re-enable buttons on error
      setIsLoading(false);
      setLoadingMessage('');
      onClaimComplete?.(); // Re-enable all claim buttons after error
    }
  };

  if (contract.status === 'ACTIVE' && isBuyer) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleRaiseDispute}
        disabled={isLoading}
        className={`w-full border-red-300 text-red-700 hover:bg-red-50 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
    const isDisabled = isLoading || isClaimingInProgress;
    return (
      <Button
        size="sm"
        onClick={handleClaimFunds}
        disabled={isDisabled}
        className={`w-full bg-green-600 hover:bg-green-700 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <>
            <LoadingSpinner className="w-4 h-4 mr-2" />
            {loadingMessage}
          </>
        ) : isClaimingInProgress ? (
          'Another claim in progress...'
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