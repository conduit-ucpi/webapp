import Link from 'next/link';
import { Contract, PendingContract } from '@/types';
import { formatWalletAddress, displayCurrency, formatDateTimeWithTZ } from '@/utils/validation';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/auth';
import { useMemo } from 'react';

interface EnhancedContractCardProps {
  contract: Contract | PendingContract;
  onAction?: (action: string) => void;
  onClick?: () => void;
  onViewDetails?: () => void;
}

function isPendingContract(contract: Contract | PendingContract): contract is PendingContract {
  return !('contractAddress' in contract) || !contract.contractAddress;
}

export default function EnhancedContractCard({ 
  contract, 
  onAction,
  onClick,
  onViewDetails 
}: EnhancedContractCardProps) {
  const { user } = useAuth();
  
  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    const now = Date.now() / 1000;
    const expiry = contract.expiryTimestamp;
    const remaining = expiry - now;
    
    if (remaining <= 0) return { text: 'Expired', percentage: 100, isExpired: true };
    
    const totalTime = expiry - (isPendingContract(contract) ? now : contract.createdAt);
    const elapsed = now - (isPendingContract(contract) ? now : contract.createdAt);
    const percentage = Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    let text = '';
    if (days > 0) {
      text = `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      text = `${hours}h ${minutes}m remaining`;
    } else {
      text = `${minutes}m remaining`;
    }
    
    return { text, percentage, isExpired: false };
  }, [contract]);

  const isPending = isPendingContract(contract);
  const isBuyer = isPending 
    ? user?.email === contract.buyerEmail 
    : user?.walletAddress?.toLowerCase() === contract.buyerAddress?.toLowerCase();
  const isSeller = user?.walletAddress?.toLowerCase() === 
    contract.sellerAddress?.toLowerCase();
  
  // Use backend-provided CTA information only
  const primaryAction = useMemo(() => {
    // Only use backend-provided CTA fields (case-insensitive check)
    if (!contract.ctaType || !contract.ctaLabel || contract.ctaVariant?.toLowerCase() !== 'action') {
      return null;
    }
    
    // Map CTA types to action strings for onAction callback
    const actionMap = {
      'ACCEPT_CONTRACT': 'accept',
      'MANAGE_DISPUTE': 'manage',
      'RAISE_DISPUTE': 'dispute',
      'CLAIM_FUNDS': 'claim'
    };
    
    // Map CTA types to button variants
    const variantMap: Record<string, 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'error'> = {
      'ACCEPT_CONTRACT': 'primary',
      'MANAGE_DISPUTE': 'error',
      'RAISE_DISPUTE': 'error',
      'CLAIM_FUNDS': 'success'
    };
    
    // Check if this component directly handles the action
    const action = actionMap[contract.ctaType as keyof typeof actionMap];
    
    // If we don't have a specific handler, still show the button
    // but use 'view-details' as the action to open the details modal
    // where ContractActions component can handle it
    return {
      label: contract.ctaLabel,
      action: action || 'view-details',
      variant: variantMap[contract.ctaType] || 'primary'
    };
  }, [contract]);

  // Use backend-provided status display only
  const statusDisplay = useMemo(() => {
    // For regular contracts, use the status field from the backend
    let status = 'status' in contract ? contract.status : 'PENDING';
    
    // For pending contracts without a status field, show PENDING
    if (isPending && !status) {
      status = 'PENDING';
    }
    
    // Map status to appropriate colors
    const getStatusColor = (status: string) => {
      switch (status?.toUpperCase()) {
        case 'ACTIVE':
          return 'bg-success-50 text-success-600 border-success-200';
        case 'DISPUTED':
          return 'bg-error-50 text-error-600 border-error-200';
        case 'EXPIRED':
          return 'bg-warning-50 text-warning-600 border-warning-200';
        case 'CLAIMED':
        case 'RESOLVED':
          return 'bg-secondary-50 text-secondary-600 border-secondary-200';
        case 'PENDING':
          return 'bg-primary-50 text-primary-600 border-primary-200';
        default:
          return 'bg-secondary-50 text-secondary-600 border-secondary-200';
      }
    };
    
    return {
      label: status || 'Unknown',
      color: getStatusColor(status || 'UNKNOWN')
    };
  }, [contract, isPending]);
  
  return (
    <div 
      className="bg-white rounded-lg border border-secondary-200 p-4 sm:p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      {/* Header with status and amount */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4">
        <div className="flex items-start space-x-3 mb-3 sm:mb-0">
          <div className={`inline-flex items-center gap-1.5 rounded-full border font-medium px-3 py-1.5 text-sm ${statusDisplay.color}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            {statusDisplay.label}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-secondary-900 line-clamp-1">
              {contract.description || 'Untitled Contract'}
            </h3>
            <p className="text-sm text-secondary-600 mt-1">
              {isSeller ? `To: ${contract.buyerEmail || 'Unknown'}` : `From: ${contract.sellerEmail || 'Unknown'}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-secondary-900">
            {displayCurrency(contract.amount, isPending ? (contract.currency || 'microUSDC') : 'microUSDC')}
          </p>
          <p className="text-xs text-secondary-500 mt-1">
            {isPending ? 'Pending' : `#${formatWalletAddress(contract.contractAddress)}`}
          </p>
        </div>
      </div>

      {/* Progress bar for active contracts */}
      {!isPending && contract.status === 'ACTIVE' && !timeRemaining.isExpired && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-secondary-700">
              {timeRemaining.text}
            </span>
            <span className="text-xs text-secondary-500">
              Expires {formatDateTimeWithTZ(contract.expiryTimestamp)}
            </span>
          </div>
          <div className="w-full bg-secondary-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                timeRemaining.percentage > 75 ? 'bg-error-500' :
                timeRemaining.percentage > 50 ? 'bg-warning-500' :
                'bg-success-500'
              }`}
              style={{ width: `${timeRemaining.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Contract details - Mobile optimized */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div>
          <p className="text-secondary-500">Your Role</p>
          <p className="font-medium text-secondary-900">
            {isSeller ? 'Seller' : isBuyer ? 'Buyer' : 'Observer'}
          </p>
        </div>
        <div>
          <p className="text-secondary-500">Status</p>
          <p className="font-medium text-secondary-900">
            {statusDisplay.label}
          </p>
        </div>
        {!isPending && contract.funded !== undefined && (
          <div>
            <p className="text-secondary-500">Funded</p>
            <p className="font-medium text-secondary-900">
              {contract.funded ? 'Yes ✓' : 'No ✗'}
            </p>
          </div>
        )}
        <div>
          <p className="text-secondary-500">Created</p>
          <p className="font-medium text-secondary-900">
            {formatDateTimeWithTZ(isPending ? contract.createdAt : contract.createdAt)}
          </p>
        </div>
      </div>

      {/* Actions - Touch-friendly buttons */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {primaryAction && onAction && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onAction(primaryAction.action);
            }}
            variant={primaryAction.variant}
            className="w-full sm:w-auto min-h-[44px]" // Mobile touch target
          >
            {primaryAction.label}
          </Button>
        )}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.();
          }}
          variant="outline"
          className="w-full sm:w-auto min-h-[44px]"
        >
          View Details
        </Button>
      </div>

      {/* Backend will provide all status information via the status field and CTA labels */}
    </div>
  );
}