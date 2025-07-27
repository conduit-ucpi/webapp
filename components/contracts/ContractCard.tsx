import { Contract } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { formatUSDC, formatExpiryDate } from '@/utils/validation';
import ContractActions from './ContractActions';
import ExpandableHash from '@/components/ui/ExpandableHash';

interface ContractCardProps {
  contract: Contract;
  onAction: () => void;
}

export default function ContractCard({ contract, onAction }: ContractCardProps) {
  const { user } = useAuth();
  
  const isBuyer = user?.walletAddress?.toLowerCase() === contract.buyerAddress?.toLowerCase();
  const isSeller = user?.walletAddress?.toLowerCase() === contract.sellerAddress?.toLowerCase();
  
  const getStatusDisplay = (status: Contract['status']) => {
    switch (status) {
      case 'CREATED':
        return 'Awaiting money';
      case 'ACTIVE':
        return 'Holding funds';
      default:
        return status;
    }
  };
  
  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'CREATED':
        return 'bg-gray-100 text-gray-800';
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'EXPIRED':
        return 'bg-yellow-100 text-yellow-800';
      case 'DISPUTED':
        return 'bg-red-100 text-red-800';
      case 'RESOLVED':
        return 'bg-blue-100 text-blue-800';
      case 'CLAIMED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            <ExpandableHash hash={contract.contractAddress} />
          </h3>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(contract.status)}`}>
            {getStatusDisplay(contract.status).toUpperCase()}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            ${formatUSDC(contract.amount)}
          </div>
          <div className="text-sm text-gray-600">USDC</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Payer:</span>
          <div className={`${isBuyer ? 'font-semibold text-primary-600' : ''}`}>
            {contract.buyerEmail ? (
              <span>{contract.buyerEmail}</span>
            ) : (
              <ExpandableHash hash={contract.buyerAddress} showCopyButton={false} />
            )}
            {isBuyer && <span className="ml-1">(You)</span>}
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Receiver:</span>
          <div className={`${isSeller ? 'font-semibold text-primary-600' : ''}`}>
            {contract.sellerEmail ? (
              <span>{contract.sellerEmail}</span>
            ) : (
              <ExpandableHash hash={contract.sellerAddress} showCopyButton={false} />
            )}
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

      <ContractActions 
        contract={contract} 
        isBuyer={isBuyer} 
        isSeller={isSeller} 
        onAction={onAction} 
      />
    </div>
  );
}