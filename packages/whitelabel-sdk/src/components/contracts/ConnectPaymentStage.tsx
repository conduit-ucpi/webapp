import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';

interface ConnectPaymentStageProps {
  /** Which payment method the user picked; drives copy + connection mode. */
  paymentMethod: 'wallet' | 'qr';
  /** Return to the payment-method choice. */
  onBack: () => void;
  /** Called when the embedded connect flow reports success. */
  onConnectSuccess: () => void;
}

/**
 * The connect/auth screen content shared by contract-create and contract-pay.
 * Inner markup was byte-identical in both pages; only the outer wrapper (page
 * background / Head) differed, so that stays in each page and this renders the
 * shared inner content. connectionMode is derived from the chosen method
 * (qr → social-only, wallet → default), exactly as before.
 */
export default function ConnectPaymentStage({
  paymentMethod,
  onBack,
  onConnectSuccess,
}: ConnectPaymentStageProps) {
  return (
    <div className="text-center p-6 max-w-md mx-auto">
      {paymentMethod === 'qr' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Sign in to protect your payment -- if there is ever a problem, you will be able to raise a dispute.
          </p>
        </div>
      )}

      <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-4">
        {paymentMethod === 'wallet' ? 'Connect Your Wallet' : 'Sign In to Continue'}
      </h2>
      <p className="text-secondary-600 dark:text-secondary-300 mb-6">
        {paymentMethod === 'wallet'
          ? 'Connect your wallet to complete the payment.'
          : 'Sign in with your email or wallet to proceed.'}
      </p>
      <ConnectWalletEmbedded
        compact={true}
        useSmartRouting={false}
        showTwoOptionLayout={true}
        connectionMode={paymentMethod === 'qr' ? 'social-only' : 'default'}
        autoConnect={true}
        onSuccess={onConnectSuccess}
      />
      <button
        onClick={onBack}
        className="mt-4 text-sm text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200 underline"
      >
        Back to payment options
      </button>
    </div>
  );
}
