import { QRCodeSVG } from 'qrcode.react';
import Modal from './Modal';
import Button from './Button';
import { useT } from '../../i18n';

interface PaymentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  amount: string;
  description: string;
  tokenSymbol?: string;
}

export default function PaymentQRModal({
  isOpen,
  onClose,
  url,
  amount,
  description,
  tokenSymbol = 'USDC'
}: PaymentQRModalProps) {
  const t = useT();
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert('Payment link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link. Please copy manually.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('paymentQRModal.inPersonPaymentQr')} size="medium">
      <div className="flex flex-col items-center">
        <p className="text-secondary-600 mb-4 text-center">{t('paymentQRModal.haveTheCustomerScan')}</p>

        {/* Payment Details Summary */}
        <div className="w-full bg-secondary-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-secondary-900 mb-3">{t('paymentQRModal.paymentDetails')}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary-600">{t('paymentQRModal.amount')}</span>
              <span className="font-medium">{amount} {tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600">{t('paymentQRModal.description')}</span>
              <span className="font-medium text-right max-w-xs">{description}</span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-white p-6 rounded-lg border-2 border-secondary-200 shadow-sm mb-6">
          <QRCodeSVG
            value={url}
            size={256}
            level="M"
            includeMargin={true}
          />
        </div>

        {/* URL Display */}
        <div className="w-full mb-6">
          <label className="block text-sm font-medium text-secondary-700 mb-2">{t('paymentQRModal.paymentLinkForManual')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 border border-secondary-300 rounded-md px-3 py-2 text-sm bg-secondary-50 font-mono text-xs overflow-x-auto"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="whitespace-nowrap flex-shrink-0"
            >{t('paymentQRModal.copy')}</Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="w-full bg-info-50 border border-info-200 rounded-md p-4 mb-6">
          <h4 className="font-medium text-info-900 mb-2">{t('paymentQRModal.howItWorks')}</h4>
          <ol className="text-sm text-info-800 space-y-1.5 list-decimal list-inside">
            <li>{t('paymentQRModal.customerScansTheQr')}</li>
            <li>{t('paymentQRModal.theyLlBeTaken')}</li>
            <li>{t('paymentQRModal.customerConnectsTheirWallet')}</li>
            <li>{t('paymentQRModal.paymentIsSecuredIn')}</li>
            <li>{t('paymentQRModal.youLlReceiveAn')}</li>
          </ol>
        </div>

        {/* Close Button */}
        <div className="w-full">
          <Button
            onClick={onClose}
            className="w-full"
            variant="primary"
          >{t('paymentQRModal.done')}</Button>
        </div>
      </div>
    </Modal>
  );
}
