import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

interface QRCodeModalProps {
  uri: string;
  onClose: () => void;
}

export default function QRCodeModal({ uri, onClose }: QRCodeModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Generate QR code using a service (you could also use a library like qrcode)
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uri)}`;
    setQrCodeUrl(qrApiUrl);
  }, [uri]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Connect with WalletConnect">
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Scan this QR code with your WalletConnect-compatible wallet
          </p>
          
          {qrCodeUrl && (
            <div className="inline-block p-4 bg-white rounded-lg border border-gray-200">
              <img
                src={qrCodeUrl}
                alt="WalletConnect QR Code"
                className="w-64 h-64"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-500 text-center">Or copy the connection link:</p>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={uri}
              readOnly
              className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg font-mono"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              onClick={handleCopy}
              variant="secondary"
              size="sm"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={onClose}
            variant="secondary"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}