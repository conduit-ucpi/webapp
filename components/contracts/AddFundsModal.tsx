import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useConfig } from '@/components/auth/ConfigProvider';
import { ONRAMP_RETURN_MESSAGE, openCoinbaseOnramp } from '@/lib/coinbaseOnramp';

/**
 * Coinbase's on-ramp enforces a fiat minimum, so presetting the literal
 * shortfall bounces on small payments (a $1 request would preset $1). Ask for
 * the shortfall or this floor, whichever is larger.
 */
// Coinbase enforces a minimum purchase. Expressed in tokens because that is what
// we now ask for, and USDC tracks the dollar closely enough for the floor.
const ONRAMP_MIN_CRYPTO = 5;

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The connected wallet — this is the destination for both routes. */
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  chainId?: number;
  networkName: string;
  /** How much more the wallet needs, in whole tokens. */
  shortfall: number;
  /**
   * Where to put the user when Coinbase is done. Defaults to the page they left,
   * which loses the panel they were on — pass the "I have paid" URL so they come
   * back able to finish, rather than to the payment-method chooser.
   */
  returnPath?: string;
}

/**
 * "Add funds to this wallet" — two ways to top up the CONNECTED wallet.
 *
 * Both routes here end in the same place: money in `walletAddress`, after which
 * the buyer pays from it. That is what separates this from "pay from external
 * wallet" on the panel behind, which sends straight to the escrow contract and
 * never touches this wallet. Same EIP-681 URI shape, deliberately different
 * destination — so the destination is named on screen in both places.
 */
export default function AddFundsModal({
  isOpen,
  onClose,
  walletAddress,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  chainId,
  networkName,
  shortfall,
  returnPath,
}: AddFundsModalProps) {
  const { config } = useConfig();
  const [showTransfer, setShowTransfer] = useState(false);
  const [copied, setCopied] = useState<'address' | 'link' | null>(null);
  const [onrampError, setOnrampError] = useState<string | null>(null);
  const [onrampLoading, setOnrampLoading] = useState(false);

  const showCoinbase = !!config?.coinbaseProjectId;
  const shortfallBase = BigInt(Math.ceil(shortfall * 10 ** tokenDecimals));

  // EIP-681: carries the token, the network (chainId) and the exact amount, so a
  // wallet app opens pre-filled rather than asking the user to type any of it.
  const transferUri = `ethereum:${tokenAddress}@${chainId}/transfer?address=${walletAddress}&uint256=${shortfallBase}`;

  const copy = async (value: string, which: 'address' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked; both values are on screen to copy by hand.
    }
  };

  // The desktop popup posts back here when Coinbase is done. Closing returns the
  // user to the payment panel, which re-reads the balance - otherwise they come
  // back to a modal still telling them they are short.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== ONRAMP_RETURN_MESSAGE) return;
      setOnrampLoading(false);
      onClose();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onClose]);

  const handleOnramp = async () => {
    setOnrampError(null);
    setOnrampLoading(true);
    try {
      await openCoinbaseOnramp({
        walletAddress,
        asset: tokenSymbol,
        // Ask for the tokens needed, not the dollars spent. Coinbase's fee comes
        // out of a fiat amount, so presetting fiat delivered a few percent less
        // USDC than the shortfall - and the escrow's activation gate is a
        // >= check on the token balance, which then never passes.
        // Rounded up to the cent so the gate cannot fail on dust.
        presetCryptoAmount: Math.max(Math.ceil(shortfall * 100) / 100, ONRAMP_MIN_CRYPTO),
        returnPath,
      });
    } catch (e) {
      setOnrampError(e instanceof Error ? e.message : 'Could not open Coinbase');
    } finally {
      setOnrampLoading(false);
    }
  };

  const handleClose = () => {
    setShowTransfer(false);
    setOnrampError(null);
    onClose();
  };

  const choiceBox =
    'w-full text-left rounded-xl border border-secondary-200 p-4 transition-colors ' +
    'hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Add ${shortfall.toFixed(4)} ${tokenSymbol} to this wallet`}
      size="medium"
    >
      {!showTransfer ? (
        <div className="space-y-3">
          {showCoinbase && (
            <button type="button" onClick={handleOnramp} disabled={onrampLoading} className={choiceBox}>
              <p className="font-semibold text-secondary-900">
                {onrampLoading ? 'Opening Coinbase…' : 'Add from Coinbase'}
              </p>
              <p className="mt-1 text-sm text-secondary-500">
                Buy {tokenSymbol} with a card or bank transfer
              </p>
            </button>
          )}

          <button type="button" onClick={() => setShowTransfer(true)} className={choiceBox}>
            <p className="font-semibold text-secondary-900">Transfer from another wallet</p>
            <p className="mt-1 text-sm text-secondary-500">
              Scan a QR code or use a link to send {tokenSymbol} you already hold
            </p>
          </button>

          {onrampError && <p className="text-sm text-red-600">{onrampError}</p>}
        </div>
      ) : (
        <div>
          <p className="text-sm text-secondary-600">
            Scan with your wallet app to send{' '}
            <span className="font-semibold text-secondary-900">
              {shortfall.toFixed(4)} {tokenSymbol}
            </span>{' '}
            on {networkName} to this wallet. The amount and network are already filled in.
          </p>

          <div className="mt-4 flex justify-center">
            <div className="bg-white p-3 rounded-lg border border-secondary-200">
              <QRCodeSVG value={transferUri} size={200} level="M" marginSize={4} />
            </div>
          </div>

          <label className="mt-5 block text-sm font-medium text-secondary-700">
            Or send manually to this address
          </label>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={walletAddress}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-md border border-secondary-300 bg-secondary-50 px-3 py-2 font-mono text-xs"
            />
            <Button variant="outline" onClick={() => copy(walletAddress, 'address')} className="flex-shrink-0">
              {copied === 'address' ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => copy(transferUri, 'link')} className="flex-1">
              {copied === 'link' ? 'Link copied' : 'Copy payment link'}
            </Button>
            <Button variant="outline" onClick={() => setShowTransfer(false)} className="flex-1">
              Back
            </Button>
          </div>

          <p className="mt-4 text-xs text-secondary-500">
            Send only {tokenSymbol} on {networkName}. Funds sent on another network may be lost.
          </p>
        </div>
      )}
    </Modal>
  );
}
