import { useState } from 'react';
import { useT } from '../../i18n';

/** The wallet address, selectable and with a copy button, wherever it has to be pasted elsewhere. */
export default function WalletAddressBox({ walletAddress }: { walletAddress: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the address is on screen to copy by hand.
    }
  };

  return (
    <div className="mt-2 flex gap-2">
      <input
        readOnly
        aria-label={t('funding.walletAddress')}
        value={walletAddress}
        onClick={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 rounded-md border border-secondary-300 dark:border-secondary-600 bg-secondary-50 dark:bg-secondary-700 text-secondary-900 dark:text-white px-3 py-2 font-mono text-xs"
      />
      <button
        type="button"
        onClick={copy}
        className="flex-shrink-0 rounded-md border border-secondary-300 dark:border-secondary-600 px-3 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-200 hover:border-primary-500"
      >
        {copied ? t('paymentActionPanel.copied') : t('qrPaymentPanel.copy')}
      </button>
    </div>
  );
}
