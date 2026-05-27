import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/** The subset of useQrPayment's return that this panel renders. */
interface QrController {
  qrContractAddress: string | null;
  qrCountdown: number;
  qrPaymentDetected: boolean;
  qrActivationStatus: 'idle' | 'checking' | 'success' | 'waiting';
  isCreatingContract: boolean;
  createContract: () => void;
  checkAndActivate: () => void;
  buildEip681Uri: () => string;
  formatCountdown: (seconds: number) => string;
}

interface QrPaymentPanelProps {
  qr: QrController;
  networkName: string;
  tokenSymbol: string;
  amountInTokens: number;
  isMobileDevice: boolean;
  copiedAddress: boolean;
  onCopyAddress: (address: string) => void;
  /** Step-1 create button label (create: 'Generate Payment Link'; pay: 'Pay'). */
  createButtonLabel: string;
  /** Disable the create button (pay: when buyer === seller). */
  createDisabled: boolean;
  /** Optional note under the create button (pay's same-address warning). */
  createNote?: string;
  onCancel: () => void;
  successMessage: string;
}

/**
 * The QR-payment panel shared by contract-create and contract-pay. The QR
 * mechanics come from a useQrPayment controller; the page-specific leaves
 * (create button label / disabled / note, displayed amount, cancel handler,
 * success message) are props. Structurally identical markup in both pages.
 */
export default function QrPaymentPanel({
  qr,
  networkName,
  tokenSymbol,
  amountInTokens,
  isMobileDevice,
  copiedAddress,
  onCopyAddress,
  createButtonLabel,
  createDisabled,
  createNote,
  onCancel,
  successMessage,
}: QrPaymentPanelProps) {
  return (
    <>
      {/* Step 1: Create the contract first */}
      {!qr.qrContractAddress && (
        <div className="text-center">
          <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-4">
            First, we need to create a secure escrow contract on the blockchain. Then you will get a payment link to send your payment.
          </p>
          <Button
            onClick={qr.createContract}
            disabled={qr.isCreatingContract || createDisabled}
            className="w-full"
          >
            {qr.isCreatingContract ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Creating contract...
              </>
            ) : (
              createButtonLabel
            )}
          </Button>
          {createNote && (
            <p className="text-sm text-red-600 mt-2">{createNote}</p>
          )}
        </div>
      )}

      {/* Step 2: Show QR code and payment instructions */}
      {qr.qrContractAddress && qr.qrActivationStatus !== 'success' && (
        <div>
          {/* Payment detected banner */}
          {qr.qrPaymentDetected && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 mb-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Payment detected! Verifying...
              </p>
            </div>
          )}

          {/* QR Code (desktop) or Deep Link button (mobile) */}
          {isMobileDevice ? (
            <div className="mb-4 space-y-3">
              <Button
                onClick={() => { window.location.href = qr.buildEip681Uri(); }}
                className="w-full"
              >
                Open in Wallet App
              </Button>
              <p className="text-xs text-center text-secondary-500 dark:text-secondary-400">
                Tap to open your wallet app with the payment pre-filled
              </p>
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-lg border-2 border-secondary-200 shadow-sm">
                <QRCodeSVG
                  value={qr.buildEip681Uri()}
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
            </div>
          )}

          {/* Contract address with copy */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-secondary-500 dark:text-secondary-400 mb-1">
              Pay-to Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={qr.qrContractAddress}
                className="flex-1 border border-secondary-300 dark:border-secondary-600 rounded-md px-3 py-2 text-xs bg-secondary-50 dark:bg-secondary-800 font-mono text-secondary-900 dark:text-secondary-100"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                onClick={() => onCopyAddress(qr.qrContractAddress || '')}
                className="whitespace-nowrap flex-shrink-0 text-xs"
              >
                {copiedAddress ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Payment instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 text-sm mb-2">Payment Instructions</h4>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
              <li>Network: <span className="font-medium">{networkName}</span></li>
              <li>Token: <span className="font-medium">{tokenSymbol}</span></li>
              <li>Amount: <span className="font-medium">{amountInTokens.toFixed(4)} {tokenSymbol}</span></li>
            </ul>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
            <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium">
              Send exactly {amountInTokens.toFixed(4)} {tokenSymbol} -- do not send more or less.
            </p>
          </div>

          {/* Countdown and activation controls */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-secondary-500 dark:text-secondary-400">
                Auto-checking in <span className="font-mono font-medium text-secondary-900 dark:text-white">{qr.formatCountdown(qr.qrCountdown)}</span>
              </p>
            </div>

            {qr.qrActivationStatus === 'checking' && (
              <div className="flex items-center justify-center text-sm text-blue-600 dark:text-blue-400">
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Checking payment status...
              </div>
            )}
            {qr.qrActivationStatus === 'waiting' && (
              <p className="text-center text-sm text-yellow-600 dark:text-yellow-400">
                Still waiting for payment... The timer and button remain active for retry.
              </p>
            )}

            <Button
              onClick={qr.checkAndActivate}
              disabled={qr.qrActivationStatus === 'checking'}
              className="w-full"
            >
              {qr.qrActivationStatus === 'checking' ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Checking...
                </>
              ) : (
                'I have paid'
              )}
            </Button>

            <Button
              onClick={onCancel}
              variant="outline"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Success state */}
      {qr.qrActivationStatus === 'success' && (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">Payment Confirmed!</h3>
          <p className="text-sm text-secondary-600 dark:text-secondary-300">{successMessage}</p>
        </div>
      )}
    </>
  );
}
