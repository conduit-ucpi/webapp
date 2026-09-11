import React, { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, DevicePhoneMobileIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface MobileWalletPromptProps {
  isOpen: boolean;
  onClose: () => void;
  walletName?: string;
  actionType: 'sign' | 'transaction';
}

export const MobileWalletPrompt: React.FC<MobileWalletPromptProps> = ({
  isOpen,
  onClose,
  walletName = 'your wallet',
  actionType
}) => {
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);
  const actionText = actionType === 'sign' ? 'sign the authentication message' : 'approve the transaction';

  useEffect(() => {
    // Auto-close after 30 seconds (user likely completed or cancelled)
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 30000);
      setAutoCloseTimer(timer);
    }

    return () => {
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
      }
    };
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded-xl bg-white dark:bg-gray-800 p-6 shadow-2xl animate-fade-in-up">
          <div className="flex justify-between items-start mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="relative">
                <DevicePhoneMobileIcon className="h-6 w-6 text-blue-600" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
              </div>
              Action Required on Mobile
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Please <span className="font-semibold">open {walletName} on your phone</span> to {actionText}.
              </p>

              <div className="flex items-center justify-center gap-3 py-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <DevicePhoneMobileIcon className="h-5 w-5" />
                  <span className="text-sm font-medium">Switch to {walletName} app</span>
                  <ArrowRightIcon className="h-4 w-4 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="space-y-2 px-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">💡</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  When connecting via QR code, the wallet app doesn't open automatically for subsequent actions.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📱</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  You need to manually switch to {walletName} on your phone to complete this action.
                </p>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                I've completed the action
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};