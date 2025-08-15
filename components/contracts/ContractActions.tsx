import { useState } from 'react';
import { Contract, PendingContract, RaiseDisputeRequest } from '@/types';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { Web3Service, ESCROW_CONTRACT_ABI } from '@/lib/web3';
import { getContractCTA, toMicroUSDC, formatCurrency, formatDateTimeWithTZ } from '@/utils/validation';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DisputeModal from './DisputeModal';
import DisputeManagementModal from './DisputeManagementModal';

interface ContractActionsProps {
  contract: Contract | PendingContract;
  isBuyer: boolean;
  isSeller: boolean;
  onAction: () => void;
  onAccept?: (contractId: string) => void;
  isClaimingInProgress?: boolean;
  onClaimStart?: () => void;
  onClaimComplete?: () => void;
}

export default function ContractActions({ contract, isBuyer, isSeller, onAction, onAccept, isClaimingInProgress, onClaimStart, onClaimComplete }: ContractActionsProps) {
  const { config } = useConfig();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showDisputeManagementModal, setShowDisputeManagementModal] = useState(false);

  const handleOpenDisputeModal = () => {
    if (!config || !isBuyer || isPending || (contract as Contract).status !== 'ACTIVE' || !user || isLoading) return;
    setShowDisputeModal(true);
  };

  const handleRaiseDispute = async (reason: string, refundPercent: number) => {
    if (!config || !isBuyer || isPending || (contract as Contract).status !== 'ACTIVE' || !user || isLoading) return;

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
      
      // Get the actual user wallet address from Web3Auth
      const userAddress = await web3Service.getUserAddress();

      // Sign dispute transaction
      setLoadingMessage('Signing dispute transaction...');
      const signedTx = await web3Service.signContractTransaction({
        contractAddress: (contract as Contract).contractAddress,
        abi: ESCROW_CONTRACT_ABI,
        functionName: 'raiseDispute',
        functionArgs: [],
        debugLabel: 'DISPUTE'
      });

      // Submit signed transaction to chain service
      setLoadingMessage('Raising dispute...');
      const regularContract = contract as Contract;
      const disputeRequest: RaiseDisputeRequest = {
        databaseId: regularContract.id,
        contractAddress: regularContract.contractAddress,
        userWalletAddress: userAddress,
        signedTransaction: signedTx,
        buyerEmail: regularContract.buyerEmail || user?.email,
        sellerEmail: regularContract.sellerEmail,
        payoutDateTime: new Date(regularContract.expiryTimestamp * 1000).toISOString(),
        amount: toMicroUSDC(formatCurrency(regularContract.amount, 'microUSDC').numericAmount).toString(),
        currency: "microUSDC",
        contractDescription: regularContract.description,
        productName: process.env.PRODUCT_NAME || regularContract.description,
        serviceLink: config.serviceLink,
        reason: reason,
        refundPercent: refundPercent
      };

      const response = await fetch('/api/chain/raise-dispute', {
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
      setIsLoading(false);
      setLoadingMessage('');
      setShowDisputeModal(false);
    } catch (error: any) {
      console.error('Dispute failed:', error);
      setHasError(true);
      alert(error.message || 'Failed to raise dispute');
      // Only re-enable button on error
      setIsLoading(false);
      setLoadingMessage('');
      setShowDisputeModal(false);
    }
  };

  const handleClaimFunds = async () => {
    if (!config || !isSeller || isPending || (contract as Contract).status !== 'EXPIRED' || !user || isLoading || isClaimingInProgress) return;

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
      
      // Get the actual user wallet address from Web3Auth
      const userAddress = await web3Service.getUserAddress();

      // Sign claim transaction
      setLoadingMessage('Signing claim transaction...');
      const signedTx = await web3Service.signContractTransaction({
        contractAddress: (contract as Contract).contractAddress,
        abi: ESCROW_CONTRACT_ABI,
        functionName: 'claimFunds',
        functionArgs: [],
        debugLabel: 'CLAIM FUNDS'
      });

      // Submit signed transaction to chain service
      setLoadingMessage('Claiming funds...');
      const response = await fetch('/api/chain/claim-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress: (contract as Contract).contractAddress,
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

  // Detect if this is a pending contract (has id field but no contractAddress field)
  const isPending = 'id' in contract && !('contractAddress' in contract);
  
  // Get contract status and additional info for the utility function
  const contractStatus = isPending ? undefined : (contract as Contract).status;
  const isExpired = isPending ? Date.now() / 1000 > contract.expiryTimestamp : false;
  const contractState = isPending ? (contract as PendingContract).state : undefined;
  
  const ctaInfo = getContractCTA(contractStatus, isBuyer, isSeller, isPending, isExpired, contractState);

  switch (ctaInfo.type) {
    case 'RAISE_DISPUTE':
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenDisputeModal}
            disabled={isLoading}
            className={`w-full border-red-300 text-red-700 hover:bg-red-50 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                {loadingMessage}
              </>
            ) : (
              ctaInfo.label
            )}
          </Button>
          <DisputeModal
            isOpen={showDisputeModal}
            onClose={() => setShowDisputeModal(false)}
            onSubmit={handleRaiseDispute}
            isSubmitting={isLoading}
          />
        </>
      );

    case 'CLAIM_FUNDS':
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
            ctaInfo.label
          )}
        </Button>
      );

    case 'ACCEPT_CONTRACT':
      if (!onAccept || !isPending) {
        return null; // Can't accept without callback or if not pending
      }
      return (
        <Button
          size="sm"
          onClick={() => onAccept((contract as PendingContract).id)}
          className="w-full bg-primary-500 hover:bg-primary-600"
        >
          {ctaInfo.label}
        </Button>
      );

    case 'AWAITING_FUNDING':
    case 'PENDING_ACCEPTANCE':
      return (
        <div className="text-center py-2">
          <span className="text-sm text-gray-600">{ctaInfo.label}</span>
        </div>
      );

    case 'MANAGE_DISPUTE':
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDisputeManagementModal(true)}
            disabled={isLoading}
            className={`w-full border-orange-300 text-orange-700 hover:bg-orange-50 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {ctaInfo.label}
          </Button>
          {!isPending && (
            <DisputeManagementModal
              isOpen={showDisputeManagementModal}
              onClose={() => setShowDisputeManagementModal(false)}
              contract={contract as Contract}
              onRefresh={onAction}
            />
          )}
        </>
      );

    case 'RESOLVED':
    case 'CLAIMED':
      return (
        <div className="text-center py-2">
          <span className="text-sm text-green-600 font-medium">
            {ctaInfo.label}
          </span>
        </div>
      );

    case 'NONE':
    default:
      return null;
  }
}