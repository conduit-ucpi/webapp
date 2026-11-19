import { useEffect, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FundingOptions from '@/components/funding/FundingOptions';
import WalletAddressBox from '@/components/funding/WalletAddressBox';
import { openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { linkDelivers, linkOnrampUrl } from '@/lib/stripeLinkOnramp';
import { KRAKEN_MINIMUM_USD, krakenDelivers, krakenRampUrl } from '@/lib/krakenRamp';
import { canBuyToken } from '@/utils/buyableToken';
import { convertibleFrom, purchaseAmountFor } from '@/lib/stablecoinSwap';
import { useConfig } from '@/components/auth/ConfigProvider';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useT } from '../../i18n';

/**
 * Paying with the other stablecoin in the wallet: the shortfall is converted, then paid as usual
 * (lib/stablecoinSwap). The page works this out; the panel only shows it.
 */
export interface PaymentConversion {
  fromSymbol: string;
  fromTokenAddress: string;
  fromTokenDecimals: number;
  fromBalance: number;
  /** What converting the shortfall costs right now, in fromSymbol; null while not known. */
  cost: number | null;
  /** ready: the wallet holds enough to convert. short: it does not. unavailable: no usable quote. */
  status: 'quoting' | 'ready' | 'short' | 'unavailable';
}

interface PaymentActionPanelProps {
  /** Formatted for display, e.g. "1.0000 USDC". */
  amountLabel: string;
  amountInTokens: number;
  balanceFloat: number;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  chainId?: number;
  /** The connected wallet — embedded or external; both behave the same here. */
  walletAddress: string;
  networkName: string;
  isLoadingBalance: boolean;
  hasInsufficientBalance: boolean;
  isSameAddress: boolean;
  isPaymentInProgress: boolean;
  /**
   * The page is still doing the work that used to happen on the click — deriving the escrow
   * address, recording it, warming the gas estimate and topping the wallet up if it is short.
   *
   * ⚠️ DISABLED RATHER THAN SLOW. All of it finishes on its own in a moment, and a button that
   *    works but then stalls for several seconds is a worse experience than one that is
   *    briefly unavailable and then instant. Clicking early is not broken — the sequence does
   *    the work inline — it is just the wait we went to some trouble to remove.
   */
  isPreparing?: boolean;
  loadingMessage?: string;
  onPay: () => void;
  /** Switches to the direct-to-contract route (link + QR). */
  onPayFromExternalWallet: () => void;
  /** Where Coinbase should return the user; see FundingOptions. */
  addFundsReturnPath?: string;
  /**
   * Resolves (creating if needed) the contract address this payment funds. Present only where
   * paying straight into it makes sense; without it paying by card straight to the payment is
   * not offered.
   */
  resolveEscrowAddress?: () => Promise<string | null>;
  /**
   * Re-reads the wallet's balance. Asked for when a funding route reports the money sent, when
   * the buyer comes back to this tab from a provider's, and when they press the button for it.
   * Without it the Pay button cannot light up after funds are added, short of a reload.
   */
  onRefreshBalance?: () => void;
  /** A seller's preview: everything is off, and the preview says so, so no reasons are given. */
  preview?: boolean;
  /** Present when the wallet's other stablecoin could pay this; see PaymentConversion. */
  conversion?: PaymentConversion;
  /**
   * The payment's contract address, its QR and "I have paid": where money sent straight to the
   * payment is checked for and settled. Absent when the payment cannot be paid from elsewhere
   * (PaymentOptions).
   */
  elsewherePanel?: ReactNode;
}

/** A card or bank provider that can deliver straight to the payment's contract address. */
interface CardProvider {
  id: 'coinbase' | 'kraken' | 'link';
  name: string;
  /** The one fact that decides between providers: what it takes, and from how much. */
  fact: string;
  /** Where it is known not to complete for some buyers. It is still offered: we cannot tell who. */
  caution?: string;
  /** Why it cannot take this payment at all; absent when it can. */
  unavailable?: string;
  onChoose: () => void;
}

/**
 * The connected wallet and how to pay from here. Two cases, and the screen is one or the other.
 *
 * 1. THE WALLET CAN PAY. One button. Pressing it has the wallet sign a transfer into the
 *    payment's contract address, and the screen says so.
 *
 * 2. IT CANNOT. Three ways on, each a section on the screen itself, most direct first:
 *
 *    a. Card or bank, straight to the payment. A provider delivers the exact amount to the
 *       contract address (Coinbase, Kraken, Stripe's Link). Nothing passes through this wallet
 *       and nothing is signed: the page sees the money arrive and settles.
 *    b. Another wallet, straight to the payment. The contract address, a copy button, a QR code
 *       and a link, for the buyer who already holds the token somewhere.
 *    c. Top up this wallet. Anything that puts the token here (FundingOptions: a card, an
 *       exchange, a transfer). Any amount works, so it is the way under a provider's minimum.
 *       The buyer then comes back to case 1 and signs the transfer.
 *
 * ⚠️ (a) AND (b) GO TO THE CONTRACT ADDRESS; (c) GOES TO THE WALLET. They are different addresses
 *    and each section shows its own, with the network, so nobody copies one for the other.
 *    Money at the contract address is this payment. Money in the wallet is the buyer's until
 *    they press Pay.
 *
 * A token nobody sells for card or bank here (USDT on Base) has no (a). A wallet holding enough of
 * the token that converts into it (USDC) pays with one button that swaps and pays; one holding too
 * little of that is told to add it by (c), come back, and use that button.
 *
 * Whichever route is taken, the signed-in wallet remains the contract's buyer,
 * so dispute rights and refunds are unaffected and no further sign-in is needed.
 */
export default function PaymentActionPanel({
  amountLabel,
  amountInTokens,
  balanceFloat,
  tokenSymbol,
  tokenAddress,
  tokenDecimals,
  chainId,
  walletAddress,
  networkName,
  isLoadingBalance,
  hasInsufficientBalance,
  isSameAddress,
  isPaymentInProgress,
  isPreparing = false,
  loadingMessage,
  onPay,
  onPayFromExternalWallet,
  addFundsReturnPath,
  resolveEscrowAddress,
  onRefreshBalance,
  preview = false,
  conversion,
  elsewherePanel,
}: PaymentActionPanelProps) {
  const t = useT();
  const { config } = useConfig();
  // No project id, no Coinbase.
  const showCoinbasePay = !!config?.coinbaseProjectId;
  const [copied, setCopied] = useState(false);

  const shortfall = Math.max(amountInTokens - balanceFloat, 0);

  // The exchange refuses less than its minimum. Into the contract that rules the route out, since
  // the escrow takes the exact amount; into the wallet they buy the minimum and pay from it.
  // No onramp delivers this token (utils/buyableToken): paying by card is greyed out, and that
  // reason replaces the exchange's own, which say nothing to a buyer it cannot serve at all.
  const buyable = canBuyToken(tokenSymbol);
  // A token nobody sells is funded by buying the one that converts into it. What is bought is
  // what the conversion costs, plus a margin, less what the wallet already holds of it.
  const converting = !!conversion && hasInsufficientBalance;
  const viaConversion = !buyable && !!conversion && canBuyToken(conversion.fromSymbol);
  const fundingSymbol = viaConversion ? conversion.fromSymbol : tokenSymbol;
  const fundingShortfall = viaConversion
    ? Math.max(purchaseAmountFor(conversion.cost ?? shortfall) - conversion.fromBalance, 0)
    : shortfall;
  const minimum = useOnrampMinimum(fundingSymbol, showCoinbasePay);
  const minimumLabel = minimum ? `${minimum.amount} ${minimum.currency}` : '';
  const coinbase = useCoinbaseAvailability(showCoinbasePay);
  // Coinbase's minimum says nothing to a buyer it cannot serve.
  const belowMinimumForWallet =
    (buyable || viaConversion) && !!minimum && !coinbase.unavailable && fundingShortfall > 0 && fundingShortfall < minimum.inTokens;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  // The address is truncated for layout, so offer the full value — it is what
  // someone would paste into a block explorer or another wallet.
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the truncated address stays on screen.
    }
  };

  // Balance gates both wallet-dependent actions, in opposite directions.
  const canConvertAndPay = converting && conversion.status === 'ready';
  const canPayFromThisWallet =
    (!hasInsufficientBalance || canConvertAndPay) && !isSameAddress && !isLoadingBalance && !isPreparing;
  // Rounded up, so the figure on the button is never less than what leaves the wallet.
  // (Less a hair first: 20.01 * 100 is 2001.0000000000002 in floating point, and must not become 20.02.)
  const upToCent = (value: number) => (Math.ceil(value * 100 - 1e-7) / 100).toFixed(2);
  const costLabel = conversion?.cost != null ? upToCent(conversion.cost) : '';
  const cannotBuyReason = t('addFunds.cannotBuyToken', { token: tokenSymbol });

  const coinbaseUnavailableReason = t('paymentActionPanel.whyNoCoinbase', { country: coinbase.countryName ?? '' });


  const actionButton = 'w-full rounded-lg justify-center';
  const twoLineButton = `${actionButton} h-auto flex-col gap-1 py-3 text-center`;
  const secondLine = 'text-xs font-normal leading-snug text-secondary-500 dark:text-secondary-400';
  const quietLink = 'text-sm underline text-secondary-600 dark:text-secondary-300 hover:text-secondary-900 dark:hover:text-white disabled:opacity-50 disabled:no-underline';

  const belowMinimumForContract = !!minimum && amountInTokens < minimum.inTokens;
  // Into the contract address: only what a provider has been seen to deliver, and never below
  // its minimum, since that address takes the exact amount.
  const krakenCanDeliver = krakenDelivers(tokenSymbol, chainId);
  const belowKrakenMinimum = amountInTokens < KRAKEN_MINIMUM_USD;
  const linkCanDeliver = linkDelivers(tokenSymbol, chainId);

  /** Which of the three sections is open. One at a time, so each address is on screen once. */
  type Section = 'card' | 'elsewhere' | 'topUp';
  const [open, setOpen] = useState<Section | null>(null);
  /** A card provider has been opened: the address it pays, and "I have paid", are now the next thing. */
  const [cardStarted, setCardStarted] = useState(false);
  const cardSent = () => {
    setCardStarted(true);
    setOpen('card');
    onPayFromExternalWallet();
  };
  const [cbPayLoading, setCbPayLoading] = useState(false);
  const [cbPayError, setCbPayError] = useState<string | null>(null);

  /**
   * Buy the stablecoin and have Coinbase send it straight to the escrow.
   *
   * Labelled for what the payer does, not for who processes it. Beside "Pay from
   * external wallet" the pair explains itself: someone holding no crypto can see
   * at a glance which one is theirs. Coinbase is the processor and appears when
   * the window opens — leading with its name signals "this needs crypto", which
   * is the fear this route exists to remove.
   *
   * Distinct from "Add from Coinbase", which tops up the user's own wallet by
   * the shortfall: this funds the contract with the whole amount, because the
   * payer's wallet balance is not part of the journey at all. The escrow takes
   * a plain transfer, which the "I have paid" panel then sweeps in — the same
   * settlement the QR route uses.
   */
  const handlePayWithCoinbase = async () => {
    if (!resolveEscrowAddress) return;
    setCbPayError(null);
    setCbPayLoading(true);
    try {
      // The escrow has to exist before Coinbase can send to it.
      const escrowAddress = await resolveEscrowAddress();
      if (!escrowAddress) throw new Error(t('paymentActionPanel.couldNotPrepare'));

      await openCoinbaseOnramp({
        destinationAddress: escrowAddress,
        purpose: 'pay-by-card',
        asset: tokenSymbol,
        // The full amount owed, not a shortfall — nothing is coming from the
        // payer's wallet. Rounded up to the cent so the panel's >= balance
        // check cannot fail on dust.
        presetCryptoAmount: Math.ceil(amountInTokens * 100) / 100,
        returnPath: addFundsReturnPath,
        // Desktop: the popup closing is the signal, not Coinbase's redirect —
        // that needs the domain allowlisted and never fires if the window is
        // closed by hand. Either way the money may have landed, so show the
        // panel that can check the balance and sweep.
        onPopupClosed: cardSent,
      });
    } catch (e) {
      setCbPayError(e instanceof Error ? e.message : t('addFunds.couldNotOpenCoinbase'));
    } finally {
      setCbPayLoading(false);
    }
  };
  /**
   * Buy the stablecoin on Kraken and have it sent straight to the payment address: Kraken's
   * counterpart to handlePayWithCoinbase, settled the same way, by the "I have paid" panel.
   *
   * ⚠️ THE TAB IS OPENED BEFORE THE ADDRESS IS KNOWN, AND POINTED AT KRAKEN AFTER. Resolving the
   *    address is asynchronous, and a browser only lets a click open a window while it is still
   *    handling that click: opened afterwards, it is blocked as a popup.
   */
  const handlePayWithKraken = async () => {
    if (!resolveEscrowAddress) return;
    setCbPayError(null);
    const tab = window.open('', '_blank');
    try {
      const escrowAddress = await resolveEscrowAddress();
      // The whole amount owed, in tokens, rounded up to the cent as the Coinbase route is.
      const url = escrowAddress
        ? krakenRampUrl({ walletAddress: escrowAddress, tokenSymbol, chainId, amount: Math.ceil(amountInTokens * 100) / 100 })
        : null;
      if (!url) throw new Error(t('paymentActionPanel.couldNotPrepare'));
      void reportFundingEvent('kraken-opened', { wallet: escrowAddress ?? undefined, amount: String(amountInTokens) });
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      // Kraken has no way back here that we know of: show the address and "I have paid" now,
      // as the Coinbase route does when its window closes.
      cardSent();
    } catch (e) {
      tab?.close();
      setCbPayError(e instanceof Error ? e.message : t('paymentActionPanel.couldNotPrepare'));
    }
  };
  /**
   * Buy on Stripe's Link page and have it sent to the payment address. Link takes no address
   * from us, so it is copied for the buyer to paste there, and the panel this opens shows it.
   * The tab is opened during the click, for the reason given on handlePayWithKraken.
   */
  const handlePayWithLink = async () => {
    if (!resolveEscrowAddress) return;
    setCbPayError(null);
    const tab = window.open('', '_blank');
    try {
      const escrowAddress = await resolveEscrowAddress();
      const url = escrowAddress
        ? linkOnrampUrl({ tokenSymbol, chainId, amount: Math.ceil(amountInTokens * 100) / 100 })
        : null;
      if (!escrowAddress || !url) throw new Error(t('paymentActionPanel.couldNotPrepare'));
      void reportFundingEvent('link-opened', { wallet: escrowAddress, amount: String(amountInTokens) });
      try {
        await navigator.clipboard.writeText(escrowAddress);
      } catch {
        // Clipboard can be blocked; the address is on screen in the panel opened below.
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      cardSent();
    } catch (e) {
      tab?.close();
      setCbPayError(e instanceof Error ? e.message : t('paymentActionPanel.couldNotPrepare'));
    }
  };

  // What a seller's preview shows as bought, where the token itself is not sold.
  const previewOther = preview && !buyable ? convertibleFrom(chainId, tokenSymbol) : null;

  // The three ways on, and whether each exists for this payment.
  const offerCard = !!resolveEscrowAddress && buyable;
  const offerElsewhere = !!elsewherePanel;
  // Topping up buys the token itself, or, for one nobody sells, the one that converts into it,
  // once a price says the wallet holds too little of that as well.
  const buysOther = viaConversion && conversion.status === 'short';
  const offerTopUp = preview ? buyable || !!previewOther : buyable || buysOther;

  /**
   * Whether the wallet is short and the ways on are shown.
   *
   * ⚠️ THEY STAY UP WHILE THE BALANCE IS RE-READ. Re-reading is what happens when the buyer comes
   *    back from a provider, and the sections vanishing and returning under them, with the one
   *    they had open closed, reads as the page breaking.
   */
  const shortNow = hasInsufficientBalance && !isSameAddress && !canConvertAndPay;
  const [wasShort, setWasShort] = useState(false);
  useEffect(() => {
    if (!isLoadingBalance) setWasShort(shortNow);
  }, [isLoadingBalance, shortNow]);
  const isShort = preview || (!isPaymentInProgress && (isLoadingBalance ? wasShort && shortNow : shortNow));
  const showWays = isShort && (offerCard || offerElsewhere || offerTopUp);
  // No greyed-out pay button above the ways on, except while a conversion is still being priced
  // or cannot be made, when that button is what says so.
  const showPayButton = !preview && !(showWays && (buyable ? conversion?.status !== 'quoting' : buysOther));

  // The buyer has been away at a provider or an exchange: coming back is the moment to look
  // again. Not on a timer, which would spend the RPC's rate limit on a page left open.
  useEffect(() => {
    if (!showWays || preview || !onRefreshBalance) return;
    let last = 0;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 5000) return;
      last = Date.now();
      onRefreshBalance();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [showWays, preview, onRefreshBalance]);

  /**
   * ⚠️ COINBASE AND LINK ARE OFFERED TO EVERYONE, WITH A WARNING, NOT GREYED OUT BY COUNTRY. Both
   *    take the contract address and the amount from anywhere. Coinbase then refuses to complete
   *    for an account that is not a United States one, and Link sells in the United States only.
   *    The country we can see is the visitor's and not their account's, so the buyer is told and
   *    left to try: a US account holder abroad can pay, and one we guessed wrong is not blocked.
   */
  const cardProviders: CardProvider[] = !offerCard
    ? []
    : [
        ...(showCoinbasePay
          ? [
              {
                id: 'coinbase' as const,
                name: 'Coinbase',
                fact: minimum ? t('payByCardModal.coinbaseFactFrom', { minimum: minimumLabel }) : t('payByCardModal.coinbaseFact'),
                caution: t('paymentActionPanel.coinbaseUsOnly'),
                unavailable: belowMinimumForContract ? t('payByCardModal.coinbaseBelowMinimum', { minimum: minimumLabel }) : undefined,
                onChoose: handlePayWithCoinbase,
              },
            ]
          : []),
        {
          id: 'kraken' as const,
          name: 'Kraken',
          fact: t('payByCardModal.krakenFact', { minimum: KRAKEN_MINIMUM_USD }),
          unavailable: !krakenCanDeliver
            ? t('addFunds.krakenCannotDeliver', { token: tokenSymbol, network: networkName })
            : belowKrakenMinimum
              ? t('payByCardModal.krakenBelowMinimum', { minimum: KRAKEN_MINIMUM_USD })
              : undefined,
          onChoose: handlePayWithKraken,
        },
        {
          id: 'link' as const,
          name: 'Link by Stripe',
          fact: t('payByCardModal.linkFact'),
          caution: t('paymentActionPanel.linkUsOnly'),
          unavailable: !linkCanDeliver ? t('addFunds.linkCannotDeliver', { token: tokenSymbol, network: networkName }) : undefined,
          onChoose: handlePayWithLink,
        },
      ];
  const ableProviders = cardProviders.filter((provider) => !provider.unavailable);
  const unableProviders = cardProviders.filter((provider) => provider.unavailable);

  const toggle = (section: Section) => {
    const opening = open !== section;
    setOpen(opening ? section : null);
    // A seller looking is not a buyer choosing: nothing is recorded or started.
    if (!opening || preview || section !== 'elsewhere') return;
    void reportFundingEvent('other-wallet-opened', { wallet: walletAddress });
    onPayFromExternalWallet();
  };
  const sectionBox = 'rounded-xl border border-secondary-200 dark:border-secondary-700';
  const sectionHead = 'w-full text-left p-4 flex items-start justify-between gap-3 disabled:opacity-50';
  const sectionTitle = 'font-semibold text-secondary-900 dark:text-white';
  const sectionFact = 'mt-1 text-sm text-secondary-500 dark:text-secondary-400';
  const onNetwork = 'rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs font-medium text-yellow-800 dark:text-yellow-300';
  const chevron = (section: Section) => (
    <span aria-hidden="true" className="mt-1 text-secondary-400">{open === section ? '−' : '+'}</span>
  );
  // In a seller's preview everything inside is off.
  const shown = (content: ReactNode) =>
    preview ? <fieldset disabled className="min-w-0 border-0 p-0">{content}</fieldset> : content;

  const reason = (text: string) =>
    !preview && !isLoadingBalance && !isPaymentInProgress ? (
      <p className="-mt-2 text-xs text-secondary-500 dark:text-secondary-400">{text}</p>
    ) : null;

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-5">
      {/* The wallet and balance are the buyer's own. A seller looking at a preview would be shown
          theirs, which means nothing here and reads as if it did. */}
      {preview && (
        <p className="text-sm text-secondary-600 dark:text-secondary-300">{t('paymentActionPanel.previewWallet')}</p>
      )}
      {!preview && (
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">{t('paymentActionPanel.connectedWallet')}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm font-mono text-secondary-500 dark:text-secondary-400">
              {shortAddress}
            </p>
            <button
              type="button"
              onClick={handleCopyAddress}
              disabled={!walletAddress}
              aria-label={t('paymentActionPanel.copyFullWalletAddress')}
              className="text-secondary-400 hover:text-secondary-900 dark:hover:text-white transition-colors disabled:opacity-40"
            >
              {copied ? (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">{t('paymentActionPanel.copied')}</span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="text-right">
          {/* ⚠️ THE BALANCE OF THE TOKEN ASKED FOR IS ALWAYS SHOWN: it is what the payment is in, and
              the first thing a buyer checks. The other stablecoin is listed only when the wallet
              holds some and it can go towards this payment; otherwise it has nothing to do with
              it. Red, and "short", only while the wallet cannot pay by either means. */}
          <p
            className={`text-lg font-bold ${
              hasInsufficientBalance && !canConvertAndPay
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {isLoadingBalance ? (
              <span className="animate-pulse text-secondary-500">{t('paymentActionPanel.loading')}</span>
            ) : (
              `${balanceFloat.toFixed(4)} ${tokenSymbol}`
            )}
          </p>
          {!isLoadingBalance && hasInsufficientBalance && !canConvertAndPay && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {t('paymentActionPanel.short', { amount: shortfall.toFixed(4), token: tokenSymbol })}
            </p>
          )}
          {!isLoadingBalance && converting && conversion.fromBalance > 0 && (
            <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">
              {`${conversion.fromBalance.toFixed(4)} ${conversion.fromSymbol}`}
            </p>
          )}
        </div>
      </div>
      )}

      {isSameAddress && (
        <p className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {t('paymentActionPanel.sameAddress')}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {showPayButton && (
          <Button
            type="button"
            onClick={onPay}
            size="lg"
            disabled={!canPayFromThisWallet || isPaymentInProgress}
            className={canConvertAndPay && !isPaymentInProgress && !isPreparing ? twoLineButton : actionButton}
          >
            {isPaymentInProgress ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                {loadingMessage || t('pay.processing')}
              </>
            ) : isPreparing ? (
              // Named rather than spinning on its own: a disabled button with no explanation
              // reads as broken, and this one is unavailable for about a second.
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                {t('pay.preparing')}
              </>
            ) : canConvertAndPay ? (
              <>
                <span className="font-medium">{t('pay.payWithOther', { amount: amountLabel, from: conversion.fromSymbol })}</span>
                <span className="text-xs font-normal leading-snug opacity-80">
                  {t('pay.payWithOtherNote', { cost: costLabel, from: conversion.fromSymbol })}
                </span>
              </>
            ) : converting && conversion.status === 'quoting' ? (
              t('paymentActionPanel.convertQuoting', { from: conversion.fromSymbol })
            ) : (
              t('pay.payFromThisWallet', { amount: amountLabel })
            )}
          </Button>
        )}
        {converting && !isSameAddress && conversion.status === 'unavailable' &&
          reason(t('paymentActionPanel.convertUnavailable', { from: conversion.fromSymbol, token: tokenSymbol }))}

        {/* Paying from this wallet is a transfer the wallet signs: said before it asks. */}
        {showPayButton && canPayFromThisWallet && !isPaymentInProgress && (
          <p className="text-xs text-center text-secondary-500 dark:text-secondary-400">{t('paymentActionPanel.signNote')}</p>
        )}
        {isShort && !buyable && !viaConversion && reason(cannotBuyReason)}
      </div>

      {showWays && (
        <div className="mt-5 space-y-3">
          {!preview && (
            <p className="text-sm text-secondary-700 dark:text-secondary-200">
              {buysOther
                ? t('paymentActionPanel.convertFirst', { token: tokenSymbol, from: conversion.fromSymbol, network: networkName })
                : t('paymentActionPanel.waysOn')}
            </p>
          )}
          {preview && <p className="text-sm text-secondary-600 dark:text-secondary-300">{t('paymentActionPanel.previewFunding')}</p>}

          {offerCard && (
            <section className={sectionBox}>
              <button type="button" aria-expanded={open === 'card'} onClick={() => toggle('card')} disabled={isPaymentInProgress} className={sectionHead}>
                <span>
                  <span className={`block ${sectionTitle}`}>{t('paymentActionPanel.payByCard')}</span>
                  <span className={`block ${sectionFact}`}>{t('paymentActionPanel.cardStraight')}</span>
                </span>
                {chevron('card')}
              </button>
              {open === 'card' && (
                <div className="px-4 pb-4 space-y-3">
                  {ableProviders.map((provider) => (
                    <div key={provider.id}>
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        onClick={provider.onChoose}
                        disabled={cbPayLoading || preview}
                        className={twoLineButton}
                      >
                        <span className="font-medium">
                          {cbPayLoading && provider.id === 'coinbase'
                            ? t('payByCardModal.opening', { name: provider.name })
                            : t('payByCardModal.continueWith', { name: provider.name })}
                        </span>
                        <span className={secondLine}>{provider.fact}</span>
                      </Button>
                      {provider.caution && <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{provider.caution}</p>}
                    </div>
                  ))}
                  {ableProviders.length === 0 && (
                    <p className="text-sm text-secondary-700 dark:text-secondary-200">{t('payByCardModal.none')}</p>
                  )}
                  {cbPayError && <p role="alert" className="text-sm text-red-600">{cbPayError}</p>}
                  {unableProviders.length > 0 && (
                    <div className="pt-2 border-t border-secondary-200 dark:border-secondary-700">
                      <p className="text-xs font-medium text-secondary-600 dark:text-secondary-300">{t('payByCardModal.notAvailable')}</p>
                      <ul className="mt-1 space-y-1">
                        {unableProviders.map((provider) => (
                          <li key={provider.id} className="text-xs text-secondary-500 dark:text-secondary-400">{provider.unavailable}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Once a provider is opened: where it pays, to check against, and "I have paid". */}
                  {cardStarted && elsewherePanel && (
                    <div className="pt-3 border-t border-secondary-200 dark:border-secondary-700">
                      <p className="mb-3 text-sm text-secondary-700 dark:text-secondary-200">{t('paymentActionPanel.afterCard')}</p>
                      {elsewherePanel}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {offerElsewhere && (
            <section className={sectionBox}>
              <button
                type="button"
                aria-expanded={open === 'elsewhere'}
                onClick={() => toggle('elsewhere')}
                disabled={isPaymentInProgress}
                className={sectionHead}
              >
                <span>
                  <span className={`block ${sectionTitle}`}>{t('paymentActionPanel.otherWalletTitle')}</span>
                  <span className={`block ${sectionFact}`}>
                    {t('paymentActionPanel.otherWalletFact', { token: tokenSymbol, network: networkName })}
                  </span>
                </span>
                {chevron('elsewhere')}
              </button>
              {open === 'elsewhere' && (
                <div className="px-4 pb-4 space-y-3">
                  <p className={onNetwork}>{t('addFunds.sendOnly', { token: tokenSymbol, network: networkName })}</p>
                  <p className="text-sm text-secondary-600 dark:text-secondary-300">{t('pay.elsewhereLead')}</p>
                  {shown(elsewherePanel)}
                </div>
              )}
            </section>
          )}

          {offerTopUp && (
            <section className={sectionBox}>
              <button type="button" aria-expanded={open === 'topUp'} onClick={() => toggle('topUp')} disabled={isPaymentInProgress} className={sectionHead}>
                <span>
                  <span className={`block ${sectionTitle}`}>
                    {t('paymentActionPanel.topUpTitle', { token: previewOther ?? fundingSymbol })}
                  </span>
                  <span className={`block ${sectionFact}`}>
                    {preview
                      ? previewOther
                        ? t('paymentActionPanel.buyOtherAndPayPreview', { token: tokenSymbol })
                        : t('paymentActionPanel.topUpFact')
                      : viaConversion
                        ? belowMinimumForWallet
                          ? t('paymentActionPanel.buyOtherAndPayMinimum', { minimum: minimumLabel, token: tokenSymbol })
                          : t('paymentActionPanel.buyOtherAndPayNote', {
                              amount: upToCent(fundingShortfall),
                              from: conversion.fromSymbol,
                              token: tokenSymbol,
                            })
                        : belowMinimumForWallet
                          ? t('payWithCryptoModal.topUpMinimum', { minimum: minimumLabel })
                          : t('payWithCryptoModal.topUpNote', { held: balanceFloat.toFixed(2), amount: upToCent(shortfall), token: tokenSymbol })}
                  </span>
                </span>
                {chevron('topUp')}
              </button>
              {open === 'topUp' && (
                <div className="px-4 pb-4 space-y-3">
                  {/* The seller's own wallet means nothing in a preview of their customer's screen. */}
                  {!preview && (
                    <>
                      <p className="text-sm font-medium text-secondary-900 dark:text-white">
                        {t('paymentActionPanel.walletOnNetwork', { network: networkName })}
                      </p>
                      <WalletAddressBox walletAddress={walletAddress} />
                      <div className="flex justify-center">
                        <div className="bg-white p-3 rounded-lg border border-secondary-200">
                          <QRCodeSVG value={walletAddress} size={160} level="M" marginSize={4} />
                        </div>
                      </div>
                    </>
                  )}
                  <p className={onNetwork}>{t('addFunds.sendOnly', { token: previewOther ?? fundingSymbol, network: networkName })}</p>
                  <FundingOptions
                    walletAddress={walletAddress}
                    tokenAddress={viaConversion ? conversion.fromTokenAddress : previewOther ? undefined : tokenAddress}
                    tokenSymbol={previewOther ?? fundingSymbol}
                    tokenDecimals={viaConversion ? conversion.fromTokenDecimals : tokenDecimals}
                    chainId={chainId}
                    networkName={networkName}
                    // Already the shortfall: it counts what converting the wallet's other token would cover.
                    amount={preview ? amountInTokens : fundingShortfall}
                    minimumPurchase={minimum?.inTokens}
                    coinbaseUnavailable={coinbase.unavailable ? coinbaseUnavailableReason : undefined}
                    coinbaseOverrule={{
                      label: t('paymentActionPanel.notInCountry', { country: coinbase.countryName ?? '' }),
                      onClick: coinbase.overrule,
                    }}
                    returnPath={addFundsReturnPath}
                    onFunded={onRefreshBalance}
                    lookOnly={preview}
                    // The address and its QR code are above; this is the list of ways to send to it.
                    showTransfer={false}
                  />
                  {!preview && (
                    <p className="text-sm text-secondary-600 dark:text-secondary-300">
                      {viaConversion ? t('paymentActionPanel.topUpThenConvert', { token: tokenSymbol, from: conversion.fromSymbol }) : t('paymentActionPanel.topUpThen')}
                    </p>
                  )}
                  {!preview && onRefreshBalance && (
                    <button type="button" onClick={onRefreshBalance} disabled={isLoadingBalance} className={quietLink}>
                      {isLoadingBalance ? t('paymentActionPanel.loading') : t('paymentActionPanel.checkBalance')}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
