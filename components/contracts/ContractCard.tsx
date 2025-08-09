import { Contract, PendingContract } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { displayCurrency, formatTimestamp } from '@/utils/validation';
import ContractActions from './ContractActions';
import ExpandableHash from '@/components/ui/ExpandableHash';

interface ContractCardProps {
  contract: Contract | PendingContract;
  onAction: () => void;
  onAccept?: (contractId: string) => void;
  isClaimingInProgress?: boolean;
  onClaimStart?: () => void;
  onClaimComplete?: () => void;
}

export default function ContractCard({ contract, onAction, onAccept, isClaimingInProgress, onClaimStart, onClaimComplete }: ContractCardProps) {
  const { user } = useAuth();
  const { config } = useConfig();
  const { walletAddress } = useWalletAddress();
  
  // Detect if this is a pending contract (has id field but no contractAddress field)
  const isPending = 'id' in contract && !('contractAddress' in contract);
  
  // Handle buyer/seller identification for both contract types
  const isBuyer = isPending 
    ? (contract as PendingContract).buyerEmail === user?.email
    : walletAddress?.toLowerCase() === (contract as Contract).buyerAddress?.toLowerCase();
    
  const isSeller = isPending
    ? (contract as PendingContract).sellerEmail === user?.email  
    : walletAddress?.toLowerCase() === (contract as Contract).sellerAddress?.toLowerCase();
  
  // Get status for display - handle both contract types
  const getDisplayStatus = () => {
    if (isPending) {
      const pendingContract = contract as PendingContract;
      if (pendingContract.chainAddress) {
        return 'Holding funds';
      }
      const isExpired = Date.now() / 1000 > pendingContract.expiryTimestamp;
      return isExpired ? 'EXPIRED' : 'PENDING';
    } else {
      const regularContract = contract as Contract;
      switch (regularContract.status) {
        case 'CREATED':
          return 'Awaiting money';
        case 'ACTIVE':
          return 'Holding funds';
        default:
          return regularContract.status || 'Unknown';
      }
    }
  };
  
  const getStatusColor = () => {
    if (isPending) {
      const pendingContract = contract as PendingContract;
      if (pendingContract.chainAddress) {
        return 'bg-green-100 text-green-800'; // Same as ACTIVE
      }
      const isExpired = Date.now() / 1000 > pendingContract.expiryTimestamp;
      return isExpired ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800';
    } else {
      const status = (contract as Contract).status;
      switch (status) {
        case 'PENDING':
          return 'bg-gray-100 text-gray-800';
        case 'CREATED':
          return 'bg-gray-100 text-gray-800';
        case 'ACTIVE':
          return 'bg-green-100 text-green-800';
        case 'EXPIRED':
          return 'bg-yellow-100 text-yellow-800';
        case 'DISPUTED':
          return 'bg-red-100 text-red-800';
        case 'RESOLVED':
          return 'bg-purple-100 text-purple-800';
        case 'CLAIMED':
          return 'bg-gray-100 text-gray-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    }
  };

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
            {config?.snowtraceBaseUrl && contractAddress ? (
              <a 
                href={`${config.snowtraceBaseUrl}/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-800 transition-colors"
                title="View contract on Snowtrace"
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
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
              {getDisplayStatus()?.toUpperCase() || 'UNKNOWN'}
            </span>
            {!isPending && (contract as Contract).blockchainQueryError && (
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800" title={(contract as Contract).blockchainQueryError}>
                Blockchain Error
              </span>
            )}
            {!isPending && (contract as Contract).hasDiscrepancy && (
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800" title={(contract as Contract).discrepancyDetails?.join(', ')}>
                Data Mismatch
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
          <span className="text-gray-600">Payer:</span>
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
          <span className="text-gray-600">Receiver:</span>
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