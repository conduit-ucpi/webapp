import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, refundPercent: number) => void;
  isSubmitting?: boolean;
}

export default function DisputeModal({ isOpen, onClose, onSubmit, isSubmitting = false }: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [refundPercent, setRefundPercent] = useState(50);
  const [errors, setErrors] = useState<{ reason?: string; split?: string }>({});

  const handleSubmit = () => {
    const newErrors: { reason?: string; split?: string } = {};

    // Validate reason
    if (!reason.trim()) {
      newErrors.reason = 'Please provide a reason for the dispute';
    } else if (reason.length > 160) {
      newErrors.reason = 'Reason must be 160 characters or less';
    }

    // Validate split percentage
    if (refundPercent < 0 || refundPercent > 100) {
      newErrors.split = 'Split percentage must be between 0 and 100';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(reason.trim(), refundPercent);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      setRefundPercent(50);
      setErrors({});
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Raise a Dispute
                </Dialog.Title>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                      Dispute Reason
                    </label>
                    <textarea
                      id="reason"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={3}
                      maxLength={160}
                      placeholder="Please describe the reason for this dispute..."
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        if (errors.reason) {
                          setErrors(prev => ({ ...prev, reason: undefined }));
                        }
                      }}
                      disabled={isSubmitting}
                    />
                    <div className="mt-1 flex justify-between">
                      <span className="text-xs text-gray-500">
                        {reason.length}/160 characters
                      </span>
                      {errors.reason && (
                        <span className="text-xs text-red-600">{errors.reason}</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="split" className="block text-sm font-medium text-gray-700 mb-1">
                      Suggested Split (% to buyer)
                    </label>
                    <div className="flex items-center space-x-3">
                      <Input
                        id="split"
                        type="number"
                        min="0"
                        max="100"
                        value={refundPercent}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            setRefundPercent(value);
                            if (errors.split) {
                              setErrors(prev => ({ ...prev, split: undefined }));
                            }
                          }
                        }}
                        disabled={isSubmitting}
                        className="w-24"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Buyer gets {refundPercent}%, Seller gets {100 - refundPercent}%
                    </div>
                    {errors.split && (
                      <div className="mt-1 text-xs text-red-600">{errors.split}</div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isSubmitting ? 'Raising Dispute...' : 'Raise Dispute'}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}