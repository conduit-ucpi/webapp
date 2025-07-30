import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface AdminNote {
  id: string;
  note: string;
  createdAt: string;
  adminEmail: string;
}

interface ContractWithNotes {
  id: string;
  description: string;
  amount: number;
  currency: string;
  sellerEmail: string;
  buyerEmail: string;
  adminNotes: AdminNote[];
}

interface DisputeResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  chainAddress?: string;
  onResolutionComplete: () => void;
}

export default function DisputeResolutionModal({
  isOpen,
  onClose,
  contractId,
  chainAddress,
  onResolutionComplete
}: DisputeResolutionModalProps) {
  const router = useRouter();
  const [contract, setContract] = useState<ContractWithNotes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [newNote, setNewNote] = useState('');
  const [buyerPercentage, setBuyerPercentage] = useState('');
  const [sellerPercentage, setSellerPercentage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch contract with notes when modal opens
  useEffect(() => {
    if (isOpen && contractId) {
      fetchContractWithNotes();
    }
  }, [isOpen, contractId]);

  // Auto-calculate percentages when one changes
  const handleBuyerPercentageChange = (value: string) => {
    setBuyerPercentage(value);
    if (value === '') {
      setSellerPercentage('');
      return;
    }
    const buyer = parseFloat(value);
    if (!isNaN(buyer) && buyer >= 0 && buyer <= 100) {
      const calculated = 100 - buyer;
      setSellerPercentage(calculated % 1 === 0 ? calculated.toString() : calculated.toFixed(2));
    }
  };

  const handleSellerPercentageChange = (value: string) => {
    setSellerPercentage(value);
    if (value === '') {
      setBuyerPercentage('');
      return;
    }
    const seller = parseFloat(value);
    if (!isNaN(seller) && seller >= 0 && seller <= 100) {
      const calculated = 100 - seller;
      setBuyerPercentage(calculated % 1 === 0 ? calculated.toString() : calculated.toFixed(2));
    }
  };

  const fetchContractWithNotes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${router.basePath}/api/admin/contracts/${contractId}/notes`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contract notes');
      }

      const data = await response.json();
      setContract(data);
    } catch (error: any) {
      console.error('Failed to fetch contract notes:', error);
      setError(error.message || 'Failed to load contract notes');
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = async (resolveDispute = false) => {
    if (!newNote.trim()) {
      setError('Please enter a note');
      return;
    }

    if (resolveDispute) {
      const buyer = parseFloat(buyerPercentage);
      const seller = parseFloat(sellerPercentage);
      
      if (isNaN(buyer) || isNaN(seller) || buyer + seller !== 100) {
        setError('Buyer and seller percentages must add up to 100%');
        return;
      }

      if (buyer < 0 || seller < 0 || buyer > 100 || seller > 100) {
        setError('Percentages must be between 0 and 100');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Add the note first
      const noteResponse = await fetch(`${router.basePath}/api/admin/contracts/${contractId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ note: newNote }),
      });

      if (!noteResponse.ok) {
        throw new Error('Failed to add note');
      }

      // If resolving dispute, call the resolution endpoint
      if (resolveDispute) {
        const resolutionResponse = await fetch(`${router.basePath}/api/admin/contracts/${contractId}/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            buyerPercentage: parseFloat(buyerPercentage),
            sellerPercentage: parseFloat(sellerPercentage),
            resolutionNote: newNote,
            chainAddress
          }),
        });

        if (!resolutionResponse.ok) {
          throw new Error('Failed to resolve dispute');
        }
      }

      // Reset form
      setNewNote('');
      if (resolveDispute) {
        setBuyerPercentage('');
        setSellerPercentage('');
        onResolutionComplete();
        onClose();
      } else {
        // Refresh notes if just adding a note
        await fetchContractWithNotes();
      }
    } catch (error: any) {
      console.error('Failed to process note:', error);
      setError(error.message || 'Failed to process request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResolutionValid = () => {
    const buyer = parseFloat(buyerPercentage);
    const seller = parseFloat(sellerPercentage);
    return !isNaN(buyer) && !isNaN(seller) && buyer + seller === 100 && buyer >= 0 && seller >= 0;
  };

  const handleModalClose = () => {
    setNewNote('');
    setBuyerPercentage('');
    setSellerPercentage('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Address Dispute">
      <div className="max-w-4xl">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : contract ? (
          <div className="space-y-6">
            {/* Contract Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Contract Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Amount:</span>
                  <span className="ml-2 font-medium">${contract.amount} {contract.currency}</span>
                </div>
                <div>
                  <span className="text-gray-600">Receiver:</span>
                  <span className="ml-2">{contract.sellerEmail}</span>
                </div>
                <div>
                  <span className="text-gray-600">Payer:</span>
                  <span className="ml-2">{contract.buyerEmail}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Description:</span>
                  <span className="ml-2">{contract.description}</span>
                </div>
              </div>
            </div>

            {/* Existing Notes */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Admin Notes</h3>
              {contract.adminNotes.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {contract.adminNotes.map((note) => (
                    <div key={note.id} className="bg-white border border-gray-200 p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900">{note.adminEmail}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{note.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No notes yet</p>
              )}
            </div>

            {/* Add New Note */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Add Note</h3>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note about this dispute..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={4}
              />
            </div>

            {/* Resolution Percentages */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Resolution Percentages</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buyer receives (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={buyerPercentage}
                    onChange={(e) => handleBuyerPercentageChange(e.target.value)}
                    placeholder="0-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seller receives (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={sellerPercentage}
                    onChange={(e) => handleSellerPercentageChange(e.target.value)}
                    placeholder="0-100"
                  />
                </div>
              </div>
              {buyerPercentage && sellerPercentage && (
                <div className="mt-2 text-sm">
                  <span className={`${
                    parseFloat(buyerPercentage) + parseFloat(sellerPercentage) === 100
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    Total: {(parseFloat(buyerPercentage) + parseFloat(sellerPercentage)).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={handleModalClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => addNote(false)}
                disabled={isSubmitting || !newNote.trim()}
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : 'Add Note'}
              </Button>
              <Button
                onClick={() => addNote(true)}
                disabled={isSubmitting || !newNote.trim() || !isResolutionValid()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : 'Add Note and Resolve'}
              </Button>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchContractWithNotes} variant="outline">
              Try Again
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}