import { useState, useEffect } from 'react';
import { Contract, PendingContract } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { formatWalletAddress, displayCurrency, formatDateTimeWithTZ, getStatusDisplay } from '@/utils/validation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConfig } from '@/components/auth/ConfigProvider';

interface ContractDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | PendingContract;
}

function isPendingContract(contract: Contract | PendingContract): contract is PendingContract {
  return !('contractAddress' in contract) || !contract.contractAddress;
}

export default function ContractDetailsModal({ isOpen, onClose, contract }: ContractDetailsModalProps) {
  const { user } = useAuth();
  const { config } = useConfig();

  const isPending = isPendingContract(contract);
  const isBuyer = user?.walletAddress?.toLowerCase() === 
    (isPending ? '' : contract.buyerAddress?.toLowerCase());
  const isSeller = user?.walletAddress?.toLowerCase() === 
    contract.sellerAddress?.toLowerCase();

  const status = isPending ? 'PENDING' : (contract as Contract).status;
  
  // Use centralized status display with role information
  const statusDisplay = getStatusDisplay(status, isBuyer, isSeller);
  
  // Calculate time remaining for active contracts
  const timeRemaining = () => {
    if (isPending) return null;
    
    const now = Date.now() / 1000;
    const expiry = contract.expiryTimestamp;
    const remaining = expiry - now;
    
    if (remaining <= 0) return { text: 'Expired', isExpired: true };
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    let text = '';
    if (days > 0) {
      text = `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      text = `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      text = `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    return { text, isExpired: false };
  };

  const timeInfo = timeRemaining();

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Contract Details"
      size="large"
    >
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-secondary-200">
          <div className="flex items-start space-x-3 mb-3 sm:mb-0">
            <StatusBadge status={status} isBuyer={isBuyer} isSeller={isSeller} />
            <div>
              <h3 className="text-xl font-semibold text-secondary-900">
                {contract.description || 'Untitled Contract'}
              </h3>
              <p className="text-sm text-secondary-600 mt-1">
                Contract ID: {contract.id}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-secondary-900">
              {displayCurrency(contract.amount, isPending ? ((contract as PendingContract).currency || 'microUSDC') : 'microUSDC')}
            </p>
            <p className="text-sm text-secondary-500 mt-1">
              {statusDisplay.label}
            </p>
          </div>
        </div>

        {/* Time Remaining for Active Contracts */}
        {!isPending && status === 'ACTIVE' && timeInfo && !timeInfo.isExpired && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-blue-900">Time Remaining</h4>
                <p className="text-blue-800">{timeInfo.text} remaining until expiry</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600">Expires</p>
                <p className="font-medium text-blue-900">
                  {formatDateTimeWithTZ(contract.expiryTimestamp)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contract Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Participants */}
          <div className="space-y-4">
            <h4 className="font-semibold text-secondary-900 text-lg">Participants</h4>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-secondary-700">Seller {isSeller && '(You)'}</p>
                <p className="text-secondary-900">{contract.sellerEmail || 'Unknown'}</p>
                <div className="mt-1">
                  <ExpandableHash hash={contract.sellerAddress} />
                </div>
              </div>
              
              {!isPending && contract.buyerAddress && (
                <div>
                  <p className="text-sm font-medium text-secondary-700">Buyer {isBuyer && '(You)'}</p>
                  <p className="text-secondary-900">{contract.buyerEmail || 'Unknown'}</p>
                  <div className="mt-1">
                    <ExpandableHash hash={contract.buyerAddress} />
                  </div>
                </div>
              )}
              
              {isPending && contract.buyerEmail && (
                <div>
                  <p className="text-sm font-medium text-secondary-700">Buyer {isBuyer && '(You)'}</p>
                  <p className="text-secondary-900">{contract.buyerEmail}</p>
                  <p className="text-sm text-secondary-500">Pending acceptance</p>
                </div>
              )}
            </div>
          </div>

          {/* Contract Details */}
          <div className="space-y-4">
            <h4 className="font-semibold text-secondary-900 text-lg">Contract Information</h4>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-secondary-700">Created</p>
                <p className="text-secondary-900">
                  {formatDateTimeWithTZ(contract.createdAt)}
                </p>
                {isPending && (contract as PendingContract).createdBy && (
                  <p className="text-sm text-secondary-500">by {(contract as PendingContract).createdBy}</p>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium text-secondary-700">Expiry Date</p>
                <p className="text-secondary-900">
                  {formatDateTimeWithTZ(contract.expiryTimestamp)}
                </p>
                {timeInfo?.isExpired && (
                  <p className="text-sm text-error-600 font-medium">⚠️ Expired</p>
                )}
              </div>
              
              {!isPending && (
                <>
                  <div>
                    <p className="text-sm font-medium text-secondary-700">Contract Address</p>
                    <ExpandableHash hash={(contract as Contract).contractAddress} />
                    {config?.snowtraceBaseUrl && (contract as Contract).contractAddress && (
                      <a
                        href={`${config.snowtraceBaseUrl}/address/${(contract as Contract).contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block"
                        onClick={() => console.log('Snowtrace URL:', `${config.snowtraceBaseUrl}/address/${(contract as Contract).contractAddress}`)}
                      >
                        View on Explorer ↗
                      </a>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-secondary-700">Funding Status</p>
                    <p className="text-secondary-900">
                      {contract.funded ? (
                        <span className="text-success-600 font-medium">✓ Funded</span>
                      ) : (
                        <span className="text-warning-600 font-medium">⚠️ Not Funded</span>
                      )}
                    </p>
                  </div>
                </>
              )}
              
              {isPending && (
                <div>
                  <p className="text-sm font-medium text-secondary-700">State</p>
                  <p className="text-secondary-900 capitalize">{(contract as PendingContract).state}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disputes Section */}
        {!isPending && (contract as Contract).disputes && (contract as Contract).disputes!.length > 0 && (
          <div className="bg-error-50 border border-error-200 rounded-lg p-4">
            <h4 className="font-semibold text-error-900 mb-3">Dispute Information</h4>
            <div className="space-y-3">
              {(contract as Contract).disputes!.map((dispute, index) => (
                <div key={index} className="bg-white rounded p-3 border border-error-200">
                  <p className="text-error-800 mb-2">
                    <span className="font-medium">Dispute #{index + 1}:</span> {dispute.reason || 'No reason provided'}
                  </p>
                  <p className="text-error-600 text-sm mb-2">
                    Raised on {formatDateTimeWithTZ(dispute.timestamp)}
                  </p>
                  
                  {/* Show refund information if available */}
                  {dispute.refundPercent !== null && dispute.refundPercent !== undefined && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <p className="font-medium text-blue-900 mb-1">Refund Details:</p>
                      <div className="text-xs text-blue-800">
                        <div>Refund Percentage: {dispute.refundPercent}%</div>
                        {/* Calculate refund amount from contract total */}
                        <div>
                          Refund Amount: {displayCurrency(
                            Math.round((contract.amount * dispute.refundPercent) / 100), 
                            isPending ? ((contract as PendingContract).currency || 'microUSDC') : 'microUSDC'
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show when no refund percentage set */}
                  {(dispute.refundPercent === null || dispute.refundPercent === undefined) && (
                    <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                      <p className="text-xs text-gray-600">Refund percentage not yet determined</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dispute Resolution Notes */}
        {!isPending && (contract as Contract).adminNotes && (contract as Contract).adminNotes!.length > 0 && (
          <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
            <h4 className="font-semibold text-secondary-900 mb-3">Dispute Resolution Notes</h4>
            <div className="space-y-3">
              {(contract as Contract).adminNotes!.map((note, index) => {
                // Handle different possible structures of admin notes
                const noteData = note as any; // Type assertion for flexibility
                console.log('Admin note data structure:', noteData); // Debug all properties
                
                const noteText = noteData.note || noteData.content || 'No content';
                const createdBy = noteData.createdBy || noteData.addedBy || 'Unknown';
                const timestamp = noteData.timestamp || noteData.addedAt || noteData.createdAt;
                
                // Extract refund/payout information - check multiple possible property names
                const buyerActualAmount = noteData.buyerActualAmount || noteData.buyerAmount;
                const sellerActualAmount = noteData.sellerActualAmount || noteData.sellerAmount;
                const buyerPercentage = noteData.buyerPercentage || noteData.buyerPercent;
                const sellerPercentage = noteData.sellerPercentage || noteData.sellerPercent;
                const refundAmount = noteData.refundAmount;
                const refundPercent = noteData.refundPercent || noteData.refundPercentage;
                
                console.log('Refund data check:', { refundAmount, refundPercent, buyerActualAmount, sellerActualAmount });
                
                return (
                  <div key={index} className="bg-white rounded p-3 border border-secondary-200">
                    <p className="text-secondary-900 mb-2">{noteText}</p>
                    
                    {/* Show refund amounts if available */}
                    {(buyerActualAmount || sellerActualAmount || buyerPercentage !== undefined || sellerPercentage !== undefined || refundAmount || refundPercent !== undefined) && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <p className="font-medium text-blue-900 mb-1">Resolution Details:</p>
                        <div className="space-y-1 text-xs text-blue-800">
                          {/* Buyer/Seller breakdown */}
                          {(buyerPercentage !== undefined || sellerPercentage !== undefined) && (
                            <div className="grid grid-cols-2 gap-2">
                              {buyerPercentage !== undefined && (
                                <div>Buyer: {buyerPercentage}% ({buyerActualAmount ? displayCurrency(parseInt(buyerActualAmount), 'microUSDC') : 'N/A'})</div>
                              )}
                              {sellerPercentage !== undefined && (
                                <div>Seller: {sellerPercentage}% ({sellerActualAmount ? displayCurrency(parseInt(sellerActualAmount), 'microUSDC') : 'N/A'})</div>
                              )}
                            </div>
                          )}
                          
                          {/* Refund information */}
                          {(refundAmount || refundPercent !== undefined) && (
                            <div className="pt-1 border-t border-blue-200">
                              {refundPercent !== undefined && (
                                <div>Refund Percentage: {refundPercent}%</div>
                              )}
                              {refundAmount && (
                                <div>Refund Amount: {displayCurrency(parseInt(refundAmount), 'microUSDC')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs text-secondary-500">
                      <span>by {createdBy}</span>
                      <span>
                        {timestamp ? formatDateTimeWithTZ(timestamp) : 'Invalid date'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Discrepancy Warning */}
        {!isPending && contract.hasDiscrepancy && (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <h4 className="font-semibold text-warning-900 mb-2">⚠️ Data Discrepancy Detected</h4>
            <p className="text-warning-800 text-sm">
              There may be inconsistencies between the database and blockchain data for this contract.
              Please verify all information before taking any actions.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-secondary-200">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          
          {!isPending && config?.snowtraceBaseUrl && (contract as Contract).contractAddress && (
            <Button
              onClick={() => window.open(`${config.snowtraceBaseUrl}/address/${(contract as Contract).contractAddress}`, '_blank')}
              variant="outline"
              className="w-full sm:w-auto"
            >
              View on Blockchain ↗
            </Button>
          )}
          
          {/* Copy Contract ID */}
          <Button
            onClick={() => {
              navigator.clipboard.writeText(contract.id || 'unknown');
              // Could add a toast notification here
            }}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Copy Contract ID
          </Button>
        </div>
      </div>
    </Modal>
  );
}