import { Contract, PendingContract } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConfig } from '@/components/auth/ConfigProvider';
import { displayCurrency, formatTimestamp } from '@/utils/validation';
import ContractActions from './ContractActions';
import ExpandableHash from '@/components/ui/ExpandableHash';
import StatusBadge from '@/components/ui/StatusBadge';

interface ContractCardProps {
  contract: Contract | PendingContract;
  onAction: () => void;
  onAccept?: (contractId: string) => void;
  isClaimingInProgress?: boolean;
  onClaimStart?: () => void;
  onClaimComplete?: () => void;
}

export default function ContractCard({ contract, onAction, onAccept, isClaimingInProgress, onClaimStart, onClaimComplete }: ContractCardProps) {
  const { user, walletAddress } = useAuth();
  const { config } = useConfig();
  
  // Detect if this is a pending contract (has id field but no contractAddress field)
  const isPending = 'id' in contract && !('contractAddress' in contract);
  
  // Handle buyer/seller identification for both contract types
  const isBuyer = isPending 
    ? (contract as PendingContract).buyerEmail === user?.email
    : walletAddress?.toLowerCase() === (contract as Contract).buyerAddress?.toLowerCase();
    
  const isSeller = isPending
    ? (contract as PendingContract).sellerEmail === user?.email  
    : walletAddress?.toLowerCase() === (contract as Contract).sellerAddress?.toLowerCase();
  

  // Get contract address for display
  const contractAddress = isPending 
    ? (contract as PendingContract).chainAddress 
    : (contract as Contract).contractAddress;
    
  // Get contract identifier
  const contractId = isPending ? (contract as PendingContract).id : (contractAddress || 'unknown');

  return (
    <div 
      className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
      data-testid="contract-card"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {config?.explorerBaseUrl && contractAddress ? (
              <a 
                href={`${config.explorerBaseUrl}/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-800 transition-colors"
                title="View contract on Explorer"
              >
                <ExpandableHash hash={contractAddress} />
              </a>
            ) : contractAddress ? (
              <ExpandableHash hash={contractAddress} />
            ) : (
              `Payment #${contractId.slice(-6)}`
            )}
          </h3>
          <div className="flex items-center space-x-2">
            <StatusBadge 
              status={isPending 
                ? ((contract as PendingContract).chainAddress ? 'ACTIVE' : 'PENDING')
                : (contract as Contract).status || 'UNKNOWN'
              }
              label={contract.ctaLabel}
              color={contract.ctaVariant?.toLowerCase() === 'action' ? 'bg-primary-50 text-primary-600 border-primary-200' : undefined}
              size="sm"
            />
            {!isPending && (contract as Contract).blockchainQueryError && (
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-error-50 text-error-600 border border-error-200" title={(contract as Contract).blockchainQueryError}>
                Blockchain Error
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {displayCurrency(contract.amount, 'currency' in contract ? contract.currency : 'microUSDC')}
          </div>
          <div className="text-sm text-gray-600">USDC</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Buyer:</span>
          <div className={`${isBuyer ? 'font-semibold text-primary-600' : ''}`}>
            {isPending ? (
              <span>{(contract as PendingContract).buyerEmail || '-'}</span>
            ) : (contract as Contract).buyerEmail ? (
              <span>{(contract as Contract).buyerEmail}</span>
            ) : (
              <ExpandableHash hash={(contract as Contract).buyerAddress} showCopyButton={false} />
            )}
            {isBuyer && <span className="ml-1">(You)</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Seller:</span>
          <div className={`${isSeller ? 'font-semibold text-primary-600' : ''}`}>
            {isPending ? (
              <span>{(contract as PendingContract).sellerEmail}</span>
            ) : (contract as Contract).sellerEmail ? (
              <span>{(contract as Contract).sellerEmail}</span>
            ) : (
              <ExpandableHash hash={(contract as Contract).sellerAddress} showCopyButton={false} />
            )}
            {isSeller && <span className="ml-1">(You)</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Payout at:</span>
          <span className="font-semibold">
            {formatTimestamp(contract.expiryTimestamp).date} {formatTimestamp(contract.expiryTimestamp).time}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3">
          {contract.description}
        </p>
      </div>

      <ContractActions 
        contract={contract} 
        isBuyer={isBuyer} 
        isSeller={isSeller} 
        onAction={onAction}
        onAccept={onAccept}
        isClaimingInProgress={isClaimingInProgress}
        onClaimStart={onClaimStart}
        onClaimComplete={onClaimComplete}
      />
    </div>
  );
}