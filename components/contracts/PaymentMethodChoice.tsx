interface PaymentMethodChoiceProps {
  /** Title for the wallet card. Differs between the pre-auth and post-create
   *  copies ("Connect my wallet" vs "Pay with connected wallet"). */
  walletTitle: string;
  /** Subtitle for the wallet card. */
  walletSubtitle: string;
  /** Fired with the chosen method when a card is clicked. */
  onSelect: (method: 'wallet' | 'qr') => void;
}

/**
 * The "How would you like to pay?" wallet/QR card pair, extracted from
 * contract-create.tsx where it appeared twice (pre-auth stage-1 choice and
 * post-create step-2 choice). The two copies were byte-identical except for the
 * wallet card's title/subtitle, which are now props. Card markup, icons and
 * classes are preserved verbatim so the rendered output is unchanged.
 */
export default function PaymentMethodChoice({
  walletTitle,
  walletSubtitle,
  onSelect,
}: PaymentMethodChoiceProps) {
  return (
    <div className="space-y-3">
      {/* Wallet option */}
      <button
        onClick={() => onSelect('wallet')}
        className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-secondary-900 dark:text-white">{walletTitle}</p>
            <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">{walletSubtitle}</p>
          </div>
        </div>
      </button>

      {/* QR option */}
      <button
        onClick={() => onSelect('qr')}
        className="w-full text-left p-4 rounded-lg border-2 border-secondary-200 dark:border-secondary-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-secondary-800"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-secondary-900 dark:text-white">Pay by link / QR code</p>
            <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">Send from any wallet -- no wallet connection needed</p>
          </div>
        </div>
      </button>
    </div>
  );
}
