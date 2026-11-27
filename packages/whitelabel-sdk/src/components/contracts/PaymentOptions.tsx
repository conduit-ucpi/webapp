import { useEffect, useState, type ComponentProps } from 'react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import PaymentProgress from '@/components/contracts/PaymentProgress';
import QrPaymentPanel from '@/components/contracts/QrPaymentPanel';
import { detectDevice } from '@/utils/deviceDetection';
import { useT } from '../../i18n';

type ActionPanelProps = ComponentProps<typeof PaymentActionPanel>;

interface PaymentOptionsProps extends ActionPanelProps {
  /** Shown while a wallet payment runs. */
  paymentSteps: ComponentProps<typeof PaymentProgress>['steps'];
  /** The one line of escrow reassurance over all the options; null for none. */
  reassurance: string | null;
  /**
   * Paying from somewhere else: the address, its QR and "I have paid". Omit to offer only the
   * signed-in wallet — /pay does when ap2service could not put the escrow on file, because
   * money sent to an address nothing is watching can be stranded.
   */
  elsewhere?: Omit<
    ComponentProps<typeof QrPaymentPanel>,
    'networkName' | 'tokenSymbol' | 'amountInTokens' | 'isMobileDevice' | 'copiedAddress' | 'onCopyAddress'
  >;
}

/**
 * Every way of paying, on one screen: from the signed-in wallet (adding funds first if it is
 * short, or by card straight into the escrow), or from any other wallet by address or QR.
 *
 * Shared by /contract-pay (a seller's request) and /pay (a buyer paying on their own terms), so
 * the two offer exactly the same choices laid out the same way. What differs — how the wallet
 * pays, how the escrow is resolved, how a transfer is swept in — comes in through the props.
 */
export default function PaymentOptions({
  paymentSteps,
  reassurance,
  elsewhere,
  ...actionPanel
}: PaymentOptionsProps) {
  const t = useT();
  const { isPaymentInProgress, hasInsufficientBalance, isSameAddress, loadingMessage } = actionPanel;

  // Mobile gets a wallet deep link rather than a QR it would have to scan with itself.
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  useEffect(() => {
    const device = detectDevice();
    setIsMobileDevice(device.isMobile || device.isTablet);
  }, []);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const handleCopyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const elsewherePanel = elsewhere ? (
    <QrPaymentPanel
      {...elsewhere}
      isMobileDevice={isMobileDevice}
      copiedAddress={copiedAddress}
      onCopyAddress={handleCopyAddress}
      networkName={actionPanel.networkName}
      tokenSymbol={actionPanel.tokenSymbol}
      amountInTokens={actionPanel.amountInTokens}
    />
  ) : null;
  // The address and what to send, without "I have paid": sending and confirming are two steps.
  const sendPanel = elsewhere ? (
    <QrPaymentPanel
      {...elsewhere}
      variant="address"
      isMobileDevice={isMobileDevice}
      copiedAddress={copiedAddress}
      onCopyAddress={handleCopyAddress}
      networkName={actionPanel.networkName}
      tokenSymbol={actionPanel.tokenSymbol}
      amountInTokens={actionPanel.amountInTokens}
    />
  ) : null;
  // The same address for someone who bought by card and had it sent there: nothing to scan or send.
  const paidCheckPanel = elsewhere ? (
    <QrPaymentPanel
      {...elsewhere}
      variant="check"
      isMobileDevice={isMobileDevice}
      copiedAddress={copiedAddress}
      onCopyAddress={handleCopyAddress}
      networkName={actionPanel.networkName}
      tokenSymbol={actionPanel.tokenSymbol}
      amountInTokens={actionPanel.amountInTokens}
    />
  ) : null;

  return (
    <>
      {isPaymentInProgress && <PaymentProgress steps={paymentSteps} loadingMessage={loadingMessage ?? ''} />}

      {/* Escrow reassurance. Stated once for the whole screen: the signed-in wallet is the
          escrow's buyer whichever route the funds take, so this holds for all of them. */}
      {reassurance && !isPaymentInProgress && !hasInsufficientBalance && !isSameAddress && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">{reassurance}</p>
        </div>
      )}

      {/* The contract address, its QR and "I have paid" belong to the buyer whose money goes
          straight to the payment, so the panel shows them inside those sections, not at the foot
          of the screen for everyone. Both ways of sending there are fire-and-forget from our
          side, so pressing "I have paid" is what secures the money if the page's own check has
          not already. A seller's preview shows the same sections, with everything in them off. */}
      <PaymentActionPanel
        {...actionPanel}
        elsewherePanel={elsewhere && !isPaymentInProgress && !isSameAddress ? elsewherePanel : undefined}
        paidCheckPanel={elsewhere && !isPaymentInProgress && !isSameAddress ? paidCheckPanel : undefined}
        sendPanel={elsewhere && !isPaymentInProgress && !isSameAddress ? sendPanel : undefined}
      />
    </>
  );
}
