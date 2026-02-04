import { useState } from 'react';
import { ethers } from 'ethers';
import { Contract, SubmitDisputeEntryRequest } from '@/types';
import { formatTimestamp, displayCurrency, formatCurrency } from '@/utils/validation';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FarcasterNameDisplay from '@/components/ui/FarcasterNameDisplay';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { ESCROW_CONTRACT_ABI } from '@/lib/web3';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';

interface DisputeManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onRefresh: () => void;
}

export default function DisputeManagementModal({ isOpen, onClose, contract, onRefresh }: DisputeManagementModalProps) {
  const { config } = useConfig();
  const { user } = useAuth();
  const { getWeb3Service } = useSimpleEthers();
  const [reason, setReason] = useState('');
  const [refundPercent, setRefundPercent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim() || refundPercent < 0 || refundPercent > 100) {
      return;
    }

    setIsSubmitting(true);

    try {
      // STEP 1: Check if agreement will be reached BEFORE notifying backend
      let agreementReached = false;

      if (user?.walletAddress) {
        // Determine if current user is buyer or seller
        const userIsBuyer = user.walletAddress.toLowerCase() === contract.buyerAddress.toLowerCase();
        const otherPartyEmail = userIsBuyer ? contract.sellerEmail : contract.buyerEmail;

        console.log('Current user is:', userIsBuyer ? 'buyer' : 'seller');
        console.log('Looking for disputes from:', otherPartyEmail);

        // Find the latest dispute from the OTHER party
        const otherPartyDisputes = contract.disputes?.filter(d =>
          d.userEmail === otherPartyEmail
        );

        if (otherPartyDisputes && otherPartyDisputes.length > 0) {
          // Sort by timestamp descending to get the latest
          const latestOtherPartyDispute = otherPartyDisputes.sort((a, b) => b.timestamp - a.timestamp)[0];

          console.log('Latest dispute from other party:', {
            email: latestOtherPartyDispute.userEmail,
            refundPercent: latestOtherPartyDispute.refundPercent,
            timestamp: latestOtherPartyDispute.timestamp
          });

          console.log('Current submission refundPercent:', Math.round(refundPercent));

          // Check if percentages match
          if (latestOtherPartyDispute.refundPercent === Math.round(refundPercent)) {
            agreementReached = true;
            console.log('Agreement detected! Will submit blockchain vote first, then notify backend.');
          }
        }
      }

      // STEP 2: If agreement reached, submit user's vote to blockchain FIRST
      if (agreementReached) {
        console.log('Submitting user vote to blockchain...');

        // Check if contract has blockchain address
        if (!contract.contractAddress) {
          throw new Error('Contract not deployed to blockchain yet');
        }

        // Encode the vote transaction
        const escrowInterface = new ethers.Interface(ESCROW_CONTRACT_ABI);
        const data = escrowInterface.encodeFunctionData('submitResolutionVote', [
          Math.round(refundPercent)
        ]);

        // Use gas-sponsored transaction (same pattern as deposits)
        const web3Service = await getWeb3Service();
        const txHash = await web3Service.fundAndSendTransaction({
          to: contract.contractAddress,
          data,
          value: '0'
        });

        console.log('✅ User vote submitted to blockchain! Transaction hash:', txHash);
        console.log('Waiting for transaction to complete before notifying backend...');

        // Note: fundAndSendTransaction already waits for the transaction to complete
        // Now proceed to notify backend, which will submit the admin's deciding vote
      }

      // STEP 3: Submit dispute entry to backend
      // If agreement was reached, this will trigger admin vote (which will be the deciding vote)
      // If no agreement, this just records the dispute entry
      const disputeEntry: SubmitDisputeEntryRequest = {
        timestamp: Math.floor(Date.now() / 1000),
        reason: reason.trim(),
        refundPercent: Math.round(refundPercent)
      };

      console.log('Notifying backend of dispute entry...');
      const response = await fetch(`/api/contracts/${contract.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(disputeEntry)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit dispute entry');
      }

      const result = await response.json();
      // Check if response has success field (old format) or is a contract object (new format)
      if (result.success === false) {
        throw new Error(result.error || 'Failed to submit dispute entry');
      }

      console.log('✅ Backend notified. If agreement reached, admin vote will be submitted as deciding vote.');

      if (agreementReached) {
        alert('Agreement reached! Your vote has been submitted to the blockchain. The admin will now submit the final deciding vote to execute the resolution.');
      }

      // Reset form and close modal
      setReason('');
      setRefundPercent(0);
      onRefresh();
      onClose();
    } catch (error: any) {
      console.error('Failed to submit dispute entry:', error);
      alert(error.message || 'Failed to submit dispute entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Sort disputes by timestamp (oldest first)
  const sortedDisputes = contract.disputes ? [...contract.disputes].sort((a, b) => a.timestamp - b.timestamp) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Manage Dispute</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contract Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Contract Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div><span className="font-medium">Description:</span> {contract.description}</div>
              {contract.productName && (
                <div><span className="font-medium">Product:</span> {contract.productName}</div>
              )}
              <div><span className="font-medium">Amount:</span> {displayCurrency(contract.amount, 'microUSDC')} {config?.tokenSymbol || 'USDC'}</div>
              <div><span className="font-medium">Buyer:</span> <FarcasterNameDisplay identifier={contract.buyerEmail} fallbackToAddress={true} walletAddress={contract.buyerAddress} /></div>
              <div><span className="font-medium">Seller:</span> <FarcasterNameDisplay identifier={contract.sellerEmail} fallbackToAddress={true} walletAddress={contract.sellerAddress} /></div>
            </div>
          </div>

          {/* Dispute Audit Trail */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-4">Dispute History (Chronological Order)</h3>
            {sortedDisputes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No dispute entries yet
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDisputes.map((dispute, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900">{dispute.userEmail}</span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(dispute.timestamp).date} at {formatTimestamp(dispute.timestamp).time}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-primary-600">
                        {dispute.refundPercent !== null ? `${dispute.refundPercent}% refund to buyer` : 'No refund percentage specified'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{dispute.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Notes */}
          {contract.adminNotes && contract.adminNotes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-4">Admin Notes</h3>
              <div className="space-y-2">
                {contract.adminNotes.map((note, index) => (
                  <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-yellow-800">{note.createdBy}</span>
                      <span className="text-xs text-yellow-600">
                        {formatTimestamp(note.timestamp).date} at {formatTimestamp(note.timestamp).time}
                      </span>
                    </div>
                    <p className="text-sm text-yellow-700">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Dispute Entry Form */}
          <div className="border-t pt-6">
            <h3 className="font-medium text-gray-900 mb-4">Add Your Position</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Your comment (max 160 characters)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={160}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Explain your position in the dispute..."
                />
                <div className="text-xs text-gray-500 mt-1">
                  {reason.length}/160 characters
                </div>
              </div>

              <div>
                <label htmlFor="refundPercent" className="block text-sm font-medium text-gray-700 mb-1">
                  Proposed refund percentage to buyer (0-100%)
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    id="refundPercent"
                    min="0"
                    max="100"
                    step="1"
                    value={refundPercent}
                    onChange={(e) => setRefundPercent(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={refundPercent}
                      onChange={(e) => setRefundPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Buyer gets: {displayCurrency((contract.amount * refundPercent) / 100, 'microUSDC')} {config?.tokenSymbol || 'USDC'},
                  Seller gets: {displayCurrency((contract.amount * (100 - refundPercent)) / 100, 'microUSDC')} {config?.tokenSymbol || 'USDC'}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !reason.trim() || refundPercent < 0 || refundPercent > 100}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Position'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}