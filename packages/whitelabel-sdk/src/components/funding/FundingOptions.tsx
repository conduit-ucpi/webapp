import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
import ExchangeDirectory from './ExchangeDirectory';
import WalletAddressBox from './WalletAddressBox';

/**
 * Coinbase enforces a minimum purchase, so presetting a smaller amount bounces. Expressed in
 * tokens because that is what is asked for, and USDC tracks the dollar closely enough for the floor.
 */
const ONRAMP_MIN_CRYPTO = 5;
/** What the amount box starts at when nothing says how much is needed. */
const DEFAULT_AMOUNT = '50';

export interface FundingOptionsProps {
  /** The connected wallet: the destination of every route here. */
  walletAddress: string;
  tokenSymbol: string;
  /** For the transfer link, and for naming a token the wallet provider's on-ramp does not know. */
  tokenAddress?: string;
  tokenDecimals?: number;
  chainId?: number;
  networkName: string;
  /**
   * How much of the token is needed, in whole tokens. With it, every route is opened for exactly
   * the shortfall. Without it (or with nothing short), the visitor is asked how much they want.
   */
  amount?: number;
  /**
   * How much of it the wallet already holds; the shortfall is the difference. Leave it out when
   * `amount` is already the shortfall, as it is from the payment panel, which also counts what
   * the wallet could pay by converting its other token.
   */
  balance?: number;
  /** The exchange's current minimum in tokens, when known. Otherwise ONRAMP_MIN_CRYPTO applies. */
  minimumPurchase?: number;
  /** Why Coinbase cannot serve this buyer, when it cannot. Its option is greyed out and says so. */
  coinbaseUnavailable?: string;
  /** "Not in this country?", shown under a Coinbase option greyed out for the country. */
  coinbaseOverrule?: { label: string; onClick: () => void };
  /** Where Coinbase should return the user. Defaults to the page they left. */
  returnPath?: string;
  /** Which way into Coinbase this was, for the log. */
  purpose?: 'add-funds' | 'guide';
  /** A route reported the money as sent, or Coinbase's window came back. */
  onFunded?: () => void;
  /** Whether the exchange list starts open. Closed where space is short, such as a modal. */
  exchangesOpen?: boolean;
  /**
   * A seller's preview of what their customer gets: everything is shown and nothing can be
   * pressed, and the wallet address is left out, since the one to hand is the seller's own.
   */
  lookOnly?: boolean;
  /**
   * Whether "Transfer from another wallet" is offered, with its QR code. Off where the holder
   * already shows the wallet's address and code above this list.
   */
  showTransfer?: boolean;
}

/**
 * Every way we know to get the token into the connected wallet.
 *
 * Most direct first: the ramps that deliver straight to this wallet, a transfer from a wallet that
 * already holds the token, and then the exchanges to buy on and withdraw from (ExchangeDirectory).
 * All of them end in the same place, money in `walletAddress`, which is what separates this from
 * "pay from external wallet" on the payment panel: that sends straight to the payment contract and
 * never touches this wallet.
 *
 * One component for the payment screen's "top up this wallet" section (PaymentActionPanel, told
 * what is short) and for /buy-token (no amount, so it asks). Written with `dark:` classes: a
 * modal holding it must be `themed` (ui/Modal).
 */
export default function FundingOptions({
  walletAddress,
  tokenSymbol,
  tokenAddress,
  tokenDecimals = 6,
  chainId: givenChainId,
  networkName,
  amount,
  balance = 0,
  minimumPurchase = ONRAMP_MIN_CRYPTO,
  coinbaseUnavailable,
  coinbaseOverrule,
  returnPath,
  purpose = 'add-funds',
  onFunded,
  exchangesOpen = false,
  lookOnly = false,
  showTransfer: offerTransfer = true,
}: FundingOptionsProps) {
  const t = useT();
  const { config } = useConfig();
  const chainId = givenChainId ?? config?.chainId;
  const [showTransfer, setShowTransfer] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [onrampError, setOnrampError] = useState<string | null>(null);
  const [onrampLoading, setOnrampLoading] = useState(false);
  const [amountText, setAmountText] = useState(DEFAULT_AMOUNT);

  // What is short is known, or it is asked for.
  // Up to the cent, less a hair first: 20.19 - 5 is 15.190000000000001 in floating point, and
  // must not become 15.20 when each route rounds it up again.
  const needed = amount === undefined ? 0 : Math.max(Math.ceil((amount - balance) * 100 - 1e-7) / 100, 0);
  const asksAmount = needed <= 0;
  const typed = Number(amountText);
  const shortfall = asksAmount ? typed : needed;
  const hasAmount = Number.isFinite(shortfall) && shortfall > 0;

  const showCoinbase = !!config?.coinbaseProjectId;
  // The wallet provider's own on-ramp (Privy's funding window). Absent for Reown, so the
  // guard is on capability, not on provider name.
  const { canFundWallet, fundWallet } = useAuth();
  const showProviderFunding = typeof canFundWallet === 'function' && canFundWallet();
  const [providerFundingBusy, setProviderFundingBusy] = useState(false);
  // No onramp delivers this token: the buying routes are greyed out and say so (utils/buyableToken).
  const cannotBuy = canBuyToken(tokenSymbol) ? undefined : t('addFunds.cannotBuyToken', { token: tokenSymbol });

  // EIP-681: carries the token, the network (chainId) and the exact amount, so a wallet app opens
  // pre-filled rather than asking the user to type any of it. Without those, the bare address.
  const transferUri =
    hasAmount && tokenAddress && chainId !== undefined
      ? `ethereum:${tokenAddress}@${chainId}/transfer?address=${walletAddress}&uint256=${BigInt(Math.ceil(shortfall * 10 ** tokenDecimals))}`
      : null;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Clipboard can be blocked; both values are on screen to copy by hand.
      return false;
    }
  };

  // The desktop popup posts back here when Coinbase is done. The holder re-reads the balance -
  // otherwise the user comes back to a screen still telling them they are short.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== ONRAMP_RETURN_MESSAGE) return;
      setOnrampLoading(false);
      onFunded?.();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onFunded]);

  const handleProviderFunding = async () => {
    setOnrampError(null);
    setProviderFundingBusy(true);
    // Same rounding as the Coinbase route: ask for tokens, rounded up to the cent, so a
    // >= balance gate cannot fail on dust.
    const asked = Math.max(Math.ceil(shortfall * 100) / 100, minimumPurchase).toFixed(2);
    const logged = { wallet: walletAddress, amount: asked };
    void reportFundingEvent('privy-started', logged);
    try {
      const result = await fundWallet({
        amount: asked,
        asset: tokenSymbol === 'USDC' || !tokenAddress ? 'USDC' : { erc20: tokenAddress, symbol: tokenSymbol },
        chainId: chainId ?? 0
      });
      const completed = result?.status === 'completed';
      void reportFundingEvent(completed ? 'privy-completed' : 'privy-cancelled', { ...logged, detail: result?.detail });
      if (completed) onFunded?.();
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
        purpose,
        asset: tokenSymbol,
        // Ask for the tokens needed, not the dollars spent. Coinbase's fee comes
        // out of a fiat amount, so presetting fiat delivered a few percent less
        // USDC than the shortfall - and the payment's activation gate is a
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
  const krakenUnavailable = krakenDelivers(tokenSymbol, chainId)
    ? undefined
    : t('addFunds.krakenCannotDeliver', { token: tokenSymbol, network: networkName });
  const handleKraken = () => {
    const asked = krakenPurchaseAmount(shortfall);
    const url = krakenRampUrl({ walletAddress, tokenSymbol, chainId, amount: asked });
    if (!url) return;
    void reportFundingEvent('kraken-opened', { wallet: walletAddress, amount: String(asked) });
    // A new tab: Kraken has no way back here that we know of, and the payment waits in this one.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Stripe's Link page (lib/stripeLinkOnramp). It takes no wallet address, so the address is
  // copied for the buyer to paste there, and shown to check against.
  const linkCountry = useLinkAvailability();
  const linkCanDeliver = linkDelivers(tokenSymbol, chainId);
  const linkUnavailable = !linkCanDeliver
    ? t('addFunds.linkCannotDeliver', { token: tokenSymbol, network: networkName })
    : linkCountry.unavailable
      ? t('addFunds.linkNotInCountry', { country: linkCountry.countryName ?? '' })
      : undefined;
  const handleLink = () => {
    const asked = Math.ceil(shortfall * 100) / 100;
    const url = linkOnrampUrl({ tokenSymbol, chainId, amount: asked });
    if (!url) return;
    void reportFundingEvent('link-opened', { wallet: walletAddress, amount: String(asked) });
    void copy(walletAddress);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const choiceBox =
    'w-full text-left rounded-xl border border-secondary-200 dark:border-secondary-600 p-4 transition-colors ' +
    'hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed';
  const choiceTitle = 'font-semibold text-secondary-900 dark:text-white';
  const choiceFact = 'mt-1 text-sm text-secondary-500 dark:text-secondary-400';
  const choiceNote = 'mt-1 text-xs text-secondary-500 dark:text-secondary-400 break-all';
  const overruleLink = '-mt-1 text-xs underline text-secondary-500 hover:text-secondary-900 dark:text-secondary-400 dark:hover:text-white';

  if (showTransfer) {
    return (
      <div>
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          {transferUri
            ? withNodes(t('addFunds.scanToSend', { network: networkName }), {
                amount: (
                  <span className="font-semibold text-secondary-900 dark:text-white">
                    {shortfall.toFixed(4)} {tokenSymbol}
                  </span>
                ),
              })
            : t('funding.scanToSendAny', { token: tokenSymbol, network: networkName })}
        </p>

        <div className="mt-4 flex justify-center">
          <div className="bg-white p-3 rounded-lg border border-secondary-200">
            <QRCodeSVG value={transferUri ?? walletAddress} size={200} level="M" marginSize={4} />
          </div>
        </div>

        <p className="mt-5 block text-sm font-medium text-secondary-700 dark:text-secondary-200">{t('addFundsModal.orSendManuallyTo')}</p>
        <WalletAddressBox walletAddress={walletAddress} />

        <div className="mt-3 flex gap-2">
          {transferUri && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!(await copy(transferUri))) return;
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="flex-1"
            >
              {linkCopied ? t('addFunds.linkCopied') : t('addFunds.copyPaymentLink')}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowTransfer(false)} className="flex-1">{t('addFundsModal.back')}</Button>
        </div>

        <p className="mt-4 text-xs text-secondary-500 dark:text-secondary-400">
          {t('addFunds.sendOnly', { token: tokenSymbol, network: networkName })}
        </p>
      </div>
    );
  }

  return (
    // Each button is off by name as well: a fieldset's own `disabled` is the browser's doing.
    <fieldset disabled={lookOnly} className="min-w-0 border-0 p-0 space-y-3">
      {asksAmount && (
        <div className="pb-2">
          <label htmlFor="funding-amount" className="block text-sm font-medium text-secondary-700 dark:text-secondary-200">
            {t('funding.howMuch', { token: tokenSymbol })}
          </label>
          <input
            id="funding-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="mt-2 w-40 rounded-md border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white px-3 py-2"
          />
          {!hasAmount && <p className="mt-1 text-sm text-red-600">{t('funding.enterAmount')}</p>}
        </div>
      )}

      {showProviderFunding && (
        <button type="button" onClick={handleProviderFunding} disabled={lookOnly || !hasAmount || providerFundingBusy || !!cannotBuy} className={choiceBox}>
          <p className={choiceTitle}>
            {providerFundingBusy ? t('addFunds.opening') : t('addFunds.addWithCard')}
          </p>
          <p className={choiceFact}>
            {cannotBuy ?? t('addFunds.buyWithCard', { token: tokenSymbol })}
          </p>
        </button>
      )}

      {showCoinbase && (
        <button type="button" onClick={handleOnramp} disabled={lookOnly || !hasAmount || onrampLoading || !!coinbaseUnavailable || !!cannotBuy} className={choiceBox}>
          <p className={choiceTitle}>
            {onrampLoading ? t('paymentActionPanel.openingCoinbase') : t('addFunds.addFromCoinbase')}
          </p>
          <p className={choiceFact}>
            {cannotBuy ?? coinbaseUnavailable ?? t('addFunds.buyWithCardOrBank', { token: tokenSymbol })}
          </p>
        </button>
      )}
      {showCoinbase && coinbaseUnavailable && coinbaseOverrule && !cannotBuy && (
        <button type="button" onClick={coinbaseOverrule.onClick} className={overruleLink}>
          {coinbaseOverrule.label}
        </button>
      )}

      <button type="button" onClick={handleKraken} disabled={lookOnly || !hasAmount || !!krakenUnavailable} className={choiceBox}>
        <p className={choiceTitle}>{t('addFunds.addFromKraken')}</p>
        <p className={choiceFact}>
          {krakenUnavailable ?? t('addFunds.buyWithKraken', { token: tokenSymbol, minimum: KRAKEN_MINIMUM_USD })}
        </p>
        {!krakenUnavailable && !lookOnly && (
          <p className={choiceNote}>
            {t('addFunds.krakenCheckAddress', { address: walletAddress, network: networkName })}
          </p>
        )}
      </button>

      <button type="button" onClick={handleLink} disabled={lookOnly || !hasAmount || !!linkUnavailable} className={choiceBox}>
        <p className={choiceTitle}>{t('addFunds.addFromLink')}</p>
        <p className={choiceFact}>
          {linkUnavailable ?? t('addFunds.buyWithLink', { token: tokenSymbol })}
        </p>
        {!linkUnavailable && !lookOnly && (
          <p className={choiceNote}>
            {t('addFunds.linkPasteAddress', { address: walletAddress, network: networkName })}
          </p>
        )}
      </button>
      {linkCountry.unavailable && linkCanDeliver && (
        <button type="button" onClick={linkCountry.overrule} className={overruleLink}>
          {t('paymentActionPanel.notInCountry', { country: linkCountry.countryName ?? '' })}
        </button>
      )}

      {offerTransfer && (
      <button
        type="button"
        onClick={() => {
          void reportFundingEvent('transfer-opened', { wallet: walletAddress });
          setShowTransfer(true);
        }}
        disabled={lookOnly}
        className={choiceBox}
      >
        <p className={choiceTitle}>{t('addFundsModal.transferFromAnotherWallet')}</p>
        <p className={choiceFact}>
          {t('addFunds.scanOrLink', { token: tokenSymbol })}
        </p>
      </button>
      )}

      {onrampError && <p role="alert" className="text-sm text-red-600">{onrampError}</p>}

      <details open={exchangesOpen} className="rounded-xl border border-secondary-200 dark:border-secondary-600 p-4">
        <summary className={`cursor-pointer ${choiceTitle}`}>{t('funding.exchanges.more', { token: tokenSymbol })}</summary>
        <div className="mt-3">
          <ExchangeDirectory tokenSymbol={tokenSymbol} networkName={networkName} walletAddress={walletAddress} preview={lookOnly} />
        </div>
      </details>
    </fieldset>
  );
}
