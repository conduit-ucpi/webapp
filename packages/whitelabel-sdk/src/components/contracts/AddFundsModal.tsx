import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/SimpleAuthProvider';
import { ONRAMP_RETURN_MESSAGE, openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
import { canBuyToken } from '@/utils/buyableToken';
import { linkDelivers, linkOnrampUrl } from '@/lib/stripeLinkOnramp';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { KRAKEN_MINIMUM_USD, krakenDelivers, krakenPurchaseAmount, krakenRampUrl } from '@/lib/krakenRamp';
import { useT, withNodes } from '../../i18n';

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
  /** The exchange's current minimum in tokens, when known. Otherwise ONRAMP_MIN_CRYPTO applies. */
  minimumPurchase?: number;
  /** Why Coinbase cannot serve this buyer, when it cannot. Its option is greyed out and says so. */
  coinbaseUnavailable?: string;
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
  minimumPurchase = ONRAMP_MIN_CRYPTO,
  coinbaseUnavailable,
  returnPath,
}: AddFundsModalProps) {
  const t = useT();
  const { config } = useConfig();
  const [showTransfer, setShowTransfer] = useState(false);
  const [copied, setCopied] = useState<'address' | 'link' | null>(null);
  const [onrampError, setOnrampError] = useState<string | null>(null);
  const [onrampLoading, setOnrampLoading] = useState(false);

  const showCoinbase = !!config?.coinbaseProjectId;
  // The wallet provider's own on-ramp (Privy's funding modal). Absent for Reown, so the
  // guard is on capability, not on provider name.
  const { canFundWallet, fundWallet } = useAuth();
  const showProviderFunding = typeof canFundWallet === 'function' && canFundWallet();
  const [providerFundingBusy, setProviderFundingBusy] = useState(false);
  // No onramp delivers this token: the buying routes are greyed out and say so (utils/buyableToken).
  const cannotBuy = canBuyToken(tokenSymbol) ? undefined : t('addFunds.cannotBuyToken', { token: tokenSymbol });
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

  const handleProviderFunding = async () => {
    setOnrampError(null);
    setProviderFundingBusy(true);
    // Same rounding as the Coinbase route: ask for tokens, rounded up to the cent, so the
    // escrow's >= balance gate cannot fail on dust.
    const amount = Math.max(Math.ceil(shortfall * 100) / 100, minimumPurchase).toFixed(2);
    const logged = { wallet: walletAddress, amount };
    void reportFundingEvent('privy-started', logged);
    try {
      const result = await fundWallet({
        amount,
        asset: tokenSymbol === 'USDC' ? 'USDC' : { erc20: tokenAddress, symbol: tokenSymbol },
        chainId: chainId ?? config?.chainId ?? 0
      });
      const completed = result?.status === 'completed';
      void reportFundingEvent(completed ? 'privy-completed' : 'privy-cancelled', { ...logged, detail: result?.detail });
      if (completed) onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : t('addFunds.couldNotOpenFunding');
      void reportFundingEvent('privy-failed', { ...logged, detail: message });
      setOnrampError(message);
    } finally {
      setProviderFundingBusy(false);
    }
  };

  const handleOnramp = async () => {
    setOnrampError(null);
    setOnrampLoading(true);
    try {
      await openCoinbaseOnramp({
        destinationAddress: walletAddress,
        purpose: 'add-funds',
        asset: tokenSymbol,
        // Ask for the tokens needed, not the dollars spent. Coinbase's fee comes
        // out of a fiat amount, so presetting fiat delivered a few percent less
        // USDC than the shortfall - and the escrow's activation gate is a
        // >= check on the token balance, which then never passes.
        // Rounded up to the cent so the gate cannot fail on dust.
        presetCryptoAmount: Math.max(Math.ceil(shortfall * 100) / 100, minimumPurchase),
        returnPath,
      });
    } catch (e) {
      setOnrampError(e instanceof Error ? e.message : t('addFunds.couldNotOpenCoinbase'));
    } finally {
      setOnrampLoading(false);
    }
  };

  // Kraken's purchase page, for what it has been seen to deliver (lib/krakenRamp). Offered to
  // everyone and greyed out, with the reason, for a token or network it cannot.
  const krakenChainId = chainId ?? config?.chainId;
  const krakenUnavailable = krakenDelivers(tokenSymbol, krakenChainId)
    ? undefined
    : t('addFunds.krakenCannotDeliver', { token: tokenSymbol, network: networkName });
  const handleKraken = () => {
    const amount = krakenPurchaseAmount(shortfall);
    const url = krakenRampUrl({ walletAddress, tokenSymbol, chainId: krakenChainId, amount });
    if (!url) return;
    void reportFundingEvent('kraken-opened', { wallet: walletAddress, amount: String(amount) });
    // A new tab: Kraken has no way back here that we know of, and the payment waits in this one.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Stripe's Link page (lib/stripeLinkOnramp). It takes no wallet address, so the address is
  // copied for the buyer to paste there, and shown to check against.
  const linkCountry = useLinkAvailability();
  const linkUnavailable = !linkDelivers(tokenSymbol, krakenChainId)
    ? t('addFunds.linkCannotDeliver', { token: tokenSymbol, network: networkName })
    : linkCountry.unavailable
      ? t('addFunds.linkNotInCountry', { country: linkCountry.countryName ?? '' })
      : undefined;
  const handleLink = () => {
    const amount = Math.ceil(shortfall * 100) / 100;
    const url = linkOnrampUrl({ tokenSymbol, chainId: krakenChainId, amount });
    if (!url) return;
    void reportFundingEvent('link-opened', { wallet: walletAddress, amount: String(amount) });
    void copy(walletAddress, 'address');
    window.open(url, '_blank', 'noopener,noreferrer');
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
      title={t('addFunds.title', { amount: shortfall.toFixed(4), token: tokenSymbol })}
      size="medium"
    >
      {!showTransfer ? (
        <div className="space-y-3">
          {showProviderFunding && (
            <button type="button" onClick={handleProviderFunding} disabled={providerFundingBusy || !!cannotBuy} className={choiceBox}>
              <p className="font-semibold text-secondary-900">
                {providerFundingBusy ? t('addFunds.opening') : t('addFunds.addWithCard')}
              </p>
              <p className="mt-1 text-sm text-secondary-500">
                {cannotBuy ?? t('addFunds.buyWithCard', { token: tokenSymbol })}
              </p>
            </button>
          )}

          {showCoinbase && (
            <button type="button" onClick={handleOnramp} disabled={onrampLoading || !!coinbaseUnavailable || !!cannotBuy} className={choiceBox}>
              <p className="font-semibold text-secondary-900">
                {onrampLoading ? t('paymentActionPanel.openingCoinbase') : t('addFunds.addFromCoinbase')}
              </p>
              <p className="mt-1 text-sm text-secondary-500">
                {cannotBuy ?? coinbaseUnavailable ?? t('addFunds.buyWithCardOrBank', { token: tokenSymbol })}
              </p>
            </button>
          )}

          <button type="button" onClick={handleKraken} disabled={!!krakenUnavailable} className={choiceBox}>
            <p className="font-semibold text-secondary-900">{t('addFunds.addFromKraken')}</p>
            <p className="mt-1 text-sm text-secondary-500">
              {krakenUnavailable ?? t('addFunds.buyWithKraken', { token: tokenSymbol, minimum: KRAKEN_MINIMUM_USD })}
            </p>
            {!krakenUnavailable && (
              <p className="mt-1 text-xs text-secondary-500 break-all">
                {t('addFunds.krakenCheckAddress', { address: walletAddress, network: networkName })}
              </p>
            )}
          </button>

          <button type="button" onClick={handleLink} disabled={!!linkUnavailable} className={choiceBox}>
            <p className="font-semibold text-secondary-900">{t('addFunds.addFromLink')}</p>
            <p className="mt-1 text-sm text-secondary-500">
              {linkUnavailable ?? t('addFunds.buyWithLink', { token: tokenSymbol })}
            </p>
            {!linkUnavailable && (
              <p className="mt-1 text-xs text-secondary-500 break-all">
                {t('addFunds.linkPasteAddress', { address: walletAddress, network: networkName })}
              </p>
            )}
          </button>
          {linkCountry.unavailable && linkDelivers(tokenSymbol, krakenChainId) && (
            <button type="button" onClick={linkCountry.overrule} className="-mt-1 text-xs underline text-secondary-500 hover:text-secondary-900">
              {t('paymentActionPanel.notInCountry', { country: linkCountry.countryName ?? '' })}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void reportFundingEvent('transfer-opened', { wallet: walletAddress });
              setShowTransfer(true);
            }}
            className={choiceBox}
          >
            <p className="font-semibold text-secondary-900">{t('addFundsModal.transferFromAnotherWallet')}</p>
            <p className="mt-1 text-sm text-secondary-500">
              {t('addFunds.scanOrLink', { token: tokenSymbol })}
            </p>
          </button>

          {onrampError && <p className="text-sm text-red-600">{onrampError}</p>}
        </div>
      ) : (
        <div>
          <p className="text-sm text-secondary-600">
            {withNodes(t('addFunds.scanToSend', { network: networkName }), {
              amount: (
                <span className="font-semibold text-secondary-900">
                  {shortfall.toFixed(4)} {tokenSymbol}
                </span>
              ),
            })}
          </p>

          <div className="mt-4 flex justify-center">
            <div className="bg-white p-3 rounded-lg border border-secondary-200">
              <QRCodeSVG value={transferUri} size={200} level="M" marginSize={4} />
            </div>
          </div>

          <label className="mt-5 block text-sm font-medium text-secondary-700">{t('addFundsModal.orSendManuallyTo')}</label>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={walletAddress}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-md border border-secondary-300 bg-secondary-50 px-3 py-2 font-mono text-xs"
            />
            <Button variant="outline" onClick={() => copy(walletAddress, 'address')} className="flex-shrink-0">
              {copied === 'address' ? t('paymentActionPanel.copied') : t('qrPaymentPanel.copy')}
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => copy(transferUri, 'link')} className="flex-1">
              {copied === 'link' ? t('addFunds.linkCopied') : t('addFunds.copyPaymentLink')}
            </Button>
            <Button variant="outline" onClick={() => setShowTransfer(false)} className="flex-1">{t('addFundsModal.back')}</Button>
          </div>

          <p className="mt-4 text-xs text-secondary-500">
            {t('addFunds.sendOnly', { token: tokenSymbol, network: networkName })}
          </p>
        </div>
      )}
    </Modal>
  );
}
