import { useState, useEffect } from 'react';
import { Contract, PendingContract } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { formatWalletAddress, displayCurrency, formatDateTimeWithTZ } from '@/utils/validation';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import ContractActions from './ContractActions';
import FarcasterNameDisplay from '@/components/ui/FarcasterNameDisplay';

interface ContractDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | PendingContract;
  onRefresh?: () => void;
}

function isPendingContract(contract: Contract | PendingContract): contract is PendingContract {
  return !('contractAddress' in contract) || !contract.contractAddress;
}

export default function ContractDetailsModal({ isOpen, onClose, contract, onRefresh }: ContractDetailsModalProps) {
  const { user } = useAuth();
  const { config } = useConfig();
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);

  const isPending = isPendingContract(contract);
  const isBuyer = user?.walletAddress?.toLowerCase() ===
    (isPending ? '' : contract.buyerAddress?.toLowerCase());
  const isSeller = user?.walletAddress?.toLowerCase() ===
    contract.sellerAddress?.toLowerCase();

  const status = isPending ? 'PENDING' : (contract as Contract).status;

  // Generate payment link for pending contracts
  const generatePaymentLink = (): string => {
    if (!contract.id) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/contract-pay?contractId=${contract.id}`;
  };

  // Copy payment link to clipboard
  const handleCopyPaymentLink = async () => {
    const link = generatePaymentLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy payment link:', error);
    }
  };
  
  // Use centralized status display with role information
  // Use backend-provided status display
  const statusDisplay = {
    label: contract.ctaLabel || status || 'Unknown',
    color: contract.ctaVariant?.toLowerCase() === 'action' ? 'bg-primary-50 text-primary-600 border-primary-200' : 'bg-secondary-50 text-secondary-600 border-secondary-200'
  };
  
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
      children={
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-secondary-200">
          <div className="flex items-start space-x-3 mb-3 sm:mb-0">
            <StatusBadge 
              status={status} 
              label={contract.ctaLabel || statusDisplay.label}
              color={statusDisplay.color}
            />
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
                <p className="text-secondary-900">
                  <FarcasterNameDisplay 
                    identifier={contract.sellerEmail} 
                    showYouLabel={false}
                    fallbackToAddress={true}
                    walletAddress="Unknown"
                  />
                </p>
                <div className="mt-1">
                  <ExpandableHash hash={contract.sellerAddress} />
                </div>
              </div>
              
              {!isPending && contract.buyerAddress && (
                <div>
                  <p className="text-sm font-medium text-secondary-700">Buyer {isBuyer && '(You)'}</p>
                  <p className="text-secondary-900">
                    <FarcasterNameDisplay 
                      identifier={contract.buyerEmail} 
                      showYouLabel={false}
                      fallbackToAddress={true}
                      walletAddress="Unknown"
                    />
                  </p>
                  <div className="mt-1">
                    <ExpandableHash hash={contract.buyerAddress} />
                  </div>
                </div>
              )}
              
              {isPending && contract.buyerEmail && (
                <div>
                  <p className="text-sm font-medium text-secondary-700">Buyer {isBuyer && '(You)'}</p>
                  <p className="text-secondary-900">
                    <FarcasterNameDisplay 
                      identifier={contract.buyerEmail} 
                      showYouLabel={false}
                    />
                  </p>
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
                  <p className="text-sm text-secondary-500">by <FarcasterNameDisplay identifier={(contract as PendingContract).createdBy} showYouLabel={false} /></p>
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
                    {config?.explorerBaseUrl && (contract as Contract).contractAddress && (
                      <a
                        href={`${config.explorerBaseUrl}/address/${(contract as Contract).contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block"
                        onClick={() => console.log('Explorer URL:', `${config.explorerBaseUrl}/address/${(contract as Contract).contractAddress}`)}
                      >
                        View on Explorer ↗
                      </a>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-secondary-700">Funding Status</p>
                    <p className="text-secondary-900">
                      {contract.funded || status === 'CLAIMED' ? (
                        <span className="text-success-600 font-medium">✓ Funded</span>
                      ) : contract.funded === false ? (
                        <span className="text-warning-600 font-medium">⚠️ Not Funded</span>
                      ) : (
                        <span className="text-secondary-500 font-medium">— Status Unknown</span>
                      )}
                    </p>
                  </div>
                </>
              )}

              {isPending && (contract as PendingContract).chainAddress && (
                <div>
                  <p className="text-sm font-medium text-secondary-700">Contract Address</p>
                  <ExpandableHash hash={(contract as PendingContract).chainAddress || ''} />
                  {config?.explorerBaseUrl && (contract as PendingContract).chainAddress && (
                    <a
                      href={`${config.explorerBaseUrl}/address/${(contract as PendingContract).chainAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block"
                    >
                      View on Explorer ↗
                    </a>
                  )}
                </div>
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

        {/* Backend will provide all warnings and status information */}

        {/* Payment Link Section for Pending Contracts */}
        {isPending && isSeller && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-primary-900 mb-2">Share Payment Link</h4>
            <p className="text-sm text-primary-800 mb-3">
              Send this link to the buyer for instant payment:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatePaymentLink()}
                className="flex-1 text-xs border border-primary-300 rounded-md px-3 py-2 bg-white font-mono text-primary-900"
              />
              <Button
                onClick={handleCopyPaymentLink}
                className={`${
                  paymentLinkCopied
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-primary-500 hover:bg-primary-600'
                } whitespace-nowrap`}
                size="sm"
              >
                {paymentLinkCopied ? (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-secondary-200">
          {/* Contract-specific actions (Raise Dispute, Claim Funds, etc.) */}
          <ContractActions
            contract={contract}
            isBuyer={isBuyer}
            isSeller={isSeller}
            onAction={() => {
              // Refresh dashboard and close modal after action
              onRefresh?.();
              onClose();
            }}
          />

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Close
          </Button>

          {!isPending && config?.explorerBaseUrl && (contract as Contract).contractAddress && (
            <Button
              onClick={() => window.open(`${config.explorerBaseUrl}/address/${(contract as Contract).contractAddress}`, '_blank')}
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
      }
    />
  );
}