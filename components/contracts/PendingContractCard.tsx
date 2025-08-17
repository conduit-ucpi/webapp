import { PendingContract } from '@/types';
import { displayCurrency, formatExpiryDate } from '@/utils/validation';
import Button from '@/components/ui/Button';
import ExpandableHash from '@/components/ui/ExpandableHash';

interface PendingContractCardProps {
  contract: PendingContract;
  currentUserEmail: string;
  onAccept?: (contractId: string) => void;
}

export default function PendingContractCard({ 
  contract, 
  currentUserEmail, 
  onAccept 
}: PendingContractCardProps) {
  const isExpired = Date.now() / 1000 > contract.expiryTimestamp;
  const isBuyer = contract.buyerEmail === currentUserEmail;
  const isSeller = contract.sellerEmail === currentUserEmail;
  const canAccept = isBuyer && 
                   !contract.chainAddress && 
                   !isExpired && 
                   contract.state === 'OK';

  const getStatusDisplay = () => {
    if (contract.chainAddress) {
      return 'Holding funds';
    }
    if (isExpired) {
      return 'EXPIRED';
    }
    return 'PENDING';
  };
  
  const getStatusColor = () => {
    if (contract.chainAddress) {
      return 'bg-green-100 text-green-800'; // Same as ACTIVE
    }
    if (isExpired) {
      return 'bg-yellow-100 text-yellow-800'; // Same as EXPIRED
    }
    return 'bg-gray-100 text-gray-800'; // Same as PENDING/CREATED
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {contract.chainAddress ? (
              <ExpandableHash hash={contract.chainAddress} />
            ) : (
              `Payment #${contract.id.slice(-6)}`
            )}
          </h3>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
            {getStatusDisplay().toUpperCase()}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {displayCurrency(contract.amount, contract.currency)}
          </div>
          <div className="text-sm text-gray-600">USDC</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Buyer:</span>
          <div className={`${isBuyer ? 'font-semibold text-primary-600' : ''}`}>
            {contract.buyerEmail ? (
              <span>{contract.buyerEmail}</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
            {isBuyer && <span className="ml-1">(You)</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Seller:</span>
          <div className={`${isSeller ? 'font-semibold text-primary-600' : ''}`}>
            <span>{contract.sellerEmail}</span>
            {isSeller && <span className="ml-1">(You)</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Payout at:</span>
          <span className="font-semibold">
            {formatExpiryDate(contract.expiryTimestamp)}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3">
          {contract.description}
        </p>
      </div>

      {canAccept && onAccept && (
        <div className="pt-4 border-t border-gray-200">
          <Button 
            onClick={() => onAccept(contract.id)}
            className="w-full bg-primary-500 hover:bg-primary-600"
          >
            Make Payment
          </Button>
        </div>
      )}
    </div>
  );
}