import { useState } from 'react';
import { useRouter } from 'next/router';
import { Contract, PendingContract, RaiseDisputeRequest } from '@/types';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { ESCROW_CONTRACT_ABI } from '@conduit-ucpi/sdk';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToastHelpers } from '@/components/ui/Toast';
import DisputeModal from './DisputeModal';
import DisputeManagementModal from './DisputeManagementModal';
import { formatDateTimeWithTZ } from '@/utils/validation';

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
  const router = useRouter();
  const { config } = useConfig();
  const { user, claimFunds, raiseDispute } = useAuth();
  const toast = useToastHelpers();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showDisputeManagementModal, setShowDisputeManagementModal] = useState(false);

  const isPending = !('contractAddress' in contract);

  const handleOpenDisputeModal = () => {
    if (!config || !isBuyer || isPending || (contract as Contract).status !== 'ACTIVE' || !user || isLoading) {
      return;
    }

    setShowDisputeModal(true);
  };

  const handleRaiseDispute = async (reason: string, refundPercent: number) => {
    if (!config || !isBuyer || isPending || (contract as Contract).status !== 'ACTIVE' || !user || isLoading) return;

    setIsLoading(true);
    setLoadingMessage('Raising dispute...');
    setHasError(false);
    
    try {
      // Check if raiseDispute method is available from auth provider
      if (!raiseDispute) {
        throw new Error('Raise dispute not available for this authentication provider');
      }
      
      // Get the actual user wallet address
      const userAddress = user?.walletAddress;
      if (!userAddress) {
        throw new Error('User wallet address not available');
      }

      // Use the abstracted raiseDispute method (works for both Web3Auth and Farcaster)
      const regularContract = contract as Contract;
      
      // Create enhanced contract object with email fallbacks
      const enhancedContract = {
        ...regularContract,
        id: regularContract.id || '', // Ensure id is always a string
        // If buyerEmail is missing and user is the buyer, use user's email as fallback, or empty string if no user email
        buyerEmail: regularContract.buyerEmail || (isBuyer ? (user?.email || '') : regularContract.buyerEmail) || '',
        // Explicitly preserve sellerEmail (could be undefined)
        sellerEmail: regularContract.sellerEmail
      };
      
      const txHash = await raiseDispute({
        contractAddress: regularContract.contractAddress,
        userAddress,
        reason,
        refundPercent,
        // Pass the enhanced contract object with email fallbacks
        contract: enhancedContract,
        config,
        utils: {
          formatDateTimeWithTZ
        }
      });

      onAction(); // Refresh contracts
      setIsLoading(false);
      setLoadingMessage('');
      setShowDisputeModal(false);
      toast.success('Dispute raised', 'The seller and arbiter have been notified. You can follow progress from your dashboard.');
    } catch (error: any) {
      console.error('Dispute failed:', error);
      setHasError(true);
      toast.error('Failed to raise dispute', `${error.message || 'Something went wrong.'} Please try again.`);
      // Only re-enable button on error
      setIsLoading(false);
      setLoadingMessage('');
      setShowDisputeModal(false);
    }
  };

  const handleClaimFunds = async () => {
    if (!config || !isSeller || isPending || (contract as Contract).status !== 'EXPIRED' || !user || isLoading || isClaimingInProgress) {
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Claiming funds...');
    setHasError(false);
    onClaimStart?.(); // Disable all claim buttons
    
    try {
      // Check if claimFunds method is available from auth provider
      if (!claimFunds) {
        throw new Error('Claim funds not available for this authentication provider');
      }
      
      // Get the actual user wallet address
      const userAddress = user?.walletAddress;
      if (!userAddress) {
        throw new Error('User wallet address not available');
      }

      // Use the abstracted claimFunds method (works for both Web3Auth and Farcaster)
      const txHash = await claimFunds(
        (contract as Contract).contractAddress,
        userAddress
      );

      onAction(); // Refresh contracts
      onClaimComplete?.(); // Re-enable all claim buttons after success
      // Keep local loading state to prevent double-clicks until page refreshes
      toast.success('Funds claimed', 'The money is on its way to your wallet.');
    } catch (error: any) {
      console.error('Claim failed:', error);
      setHasError(true);
      toast.error('Failed to claim funds', `${error.message || 'Something went wrong.'} Please try again.`);
      // Re-enable buttons on error
      setIsLoading(false);
      setLoadingMessage('');
      onClaimComplete?.(); // Re-enable all claim buttons after error
    }
  };

  // Detect if this is a pending contract (has id field but no contractAddress field)
  // Use backend-provided CTA fields only
  if (!contract.ctaType) {
    return null;
  }

  switch (contract.ctaType) {
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
              contract.ctaLabel || 'Raise Dispute'
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
            contract.ctaLabel || 'Claim Funds'
          )}
        </Button>
      );

    case 'ACCEPT_CONTRACT':
      if (onAccept && isPending) {
        return (
          <Button
            size="sm"
            onClick={() => onAccept((contract as PendingContract).id)}
            className="w-full"
          >
            {contract.ctaLabel || 'Accept Contract'}
          </Button>
        );
      }
      // Deployed-but-unfunded contracts (blockchain status CREATED) also carry
      // ACCEPT_CONTRACT for the buyer. Route to the pay page, which reuses the
      // recorded escrow address instead of deploying a second contract.
      if (contract.id) {
        return (
          <Button
            size="sm"
            onClick={() => router.push(`/contract-pay?contractId=${contract.id}`)}
            className="w-full"
          >
            {contract.ctaLabel || 'Complete Payment'}
          </Button>
        );
      }
      return null; // No callback and no contractservice id to pay against

    case 'AWAITING_FUNDING':
    case 'PENDING_ACCEPTANCE':
      return (
        <div className="text-center py-2">
          <span className="text-sm text-gray-600">{contract.ctaLabel || 'Status'}</span>
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
            {contract.ctaLabel || 'Manage Dispute'}
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
            {contract.ctaLabel || 'Completed'}
          </span>
        </div>
      );

    case 'NONE':
    default:
      return null;
  }
}