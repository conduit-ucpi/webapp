import { PendingContract } from '@/types';
import { formatExpiryDate } from '@/utils/validation';
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
  const canAccept = isBuyer && !contract.chainAddress && !isExpired;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {contract.amount} {contract.currency}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {contract.description}
          </p>
        </div>
        <div className="text-right">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            contract.chainAddress 
              ? 'bg-green-100 text-green-800' 
              : isExpired 
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {contract.chainAddress ? 'Holding funds' : isExpired ? 'Expired' : 'Awaiting payer'}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Receiver:</span>
          <span>{contract.sellerEmail}</span>
        </div>
        {contract.buyerEmail && (
          <div className="flex justify-between">
            <span>Payer:</span>
            <span>{contract.buyerEmail}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Payout at:</span>
          <span>{formatExpiryDate(contract.expiryTimestamp)}</span>
        </div>
        {contract.chainAddress && (
          <div className="flex justify-between">
            <span>Contract:</span>
            <ExpandableHash hash={contract.chainAddress} />
          </div>
        )}
      </div>

      {canAccept && onAccept && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button 
            onClick={() => onAccept(contract.id)}
            className="w-full bg-primary-500 hover:bg-primary-600"
          >
            Accept Contract
          </Button>
        </div>
      )}
    </div>
  );
}