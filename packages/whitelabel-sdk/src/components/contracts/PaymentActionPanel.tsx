import { useEffect, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExchangeDirectory from '@/components/funding/ExchangeDirectory';
import WalletAddressBox from '@/components/funding/WalletAddressBox';
import { openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { linkDelivers, linkOnrampUrl } from '@/lib/stripeLinkOnramp';
import { KRAKEN_MINIMUM_USD, krakenDelivers, krakenRampUrl } from '@/lib/krakenRamp';
import { canBuyToken } from '@/utils/buyableToken';
import { detectUserCurrency } from '@/utils/currencyDetection';
import { convertibleFrom, purchaseAmountFor } from '@/lib/stablecoinSwap';
import { useConfig } from '@/components/auth/ConfigProvider';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { useWalletFunding } from '@/hooks/useWalletFunding';
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
   * The same address, when it is already known. Kraken and Link are given it on the clipboard, and
   * that has to happen during the click, before their tab opens: see copyForProvider.
   */
  escrowAddress?: string;
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
  /**
   * The same address and "I have paid" without the code to scan, shown after a card purchase sent
   * there: that buyer scans and sends nothing. Falls back to `elsewherePanel`.
   */
  paidCheckPanel?: ReactNode;
}

/**
 * One way of paying by card or bank. Each company is listed ONCE, and where its purchase is
 * delivered is chosen for the buyer, not by them.
 */
interface CardRow {
  id: 'card' | 'coinbase' | 'kraken' | 'link';
  name: string;
  /** The one line under its name: what it takes, what it needs, and what to do over there. */
  fact: string;
  /**
   * payment: delivered to the payment's contract address; the page sees it arrive and settles.
   * wallet: delivered to the connected wallet; the buyer then presses Pay.
   */
  route: 'payment' | 'wallet';
  /** Known not to complete for some buyers (said in `fact`). Still offered, after those with no warning. */
  caution?: boolean;
  /** Why it cannot take this payment at all; absent when it can. */
  unavailable?: string;
  /** "Not in this country?", under one ruled out by the country we see. */
  overrule?: { label: string; onClick: () => void };
  busy?: boolean;
  onChoose: () => void;
}

/**
 * The connected wallet and how to pay from here. Two cases, and the screen is one or the other.
 *
 * 1. THE WALLET CAN PAY. One button. Pressing it has the wallet sign a transfer into the
 *    payment's contract address, and the screen says so.
 *
 * 2. IT CANNOT. The screen asks "How do you want to pay?" and gives two answers (2026-11-23,
 *    replacing three sections that listed Coinbase, Kraken and Link twice each and left the buyer
 *    to work out the difference):
 *
 *    a. Card or bank, for someone with no crypto. One row per company. Where each delivers is
 *       decided here: straight to the payment where the company can (nothing passes through this
 *       wallet and nothing is signed), and into this wallet where it cannot (under its minimum,
 *       or the wallet provider's own card window, which only funds the wallet), after which the
 *       buyer presses Pay. Once one is opened, what to do on coming back is shown beneath.
 *    b. Crypto I already have. The contract address, its QR code and "I have paid"; and, more
 *       quietly, this wallet's address for someone who would sooner top it up and pay from it.
 *
 * ⚠️ EVERYTHING THAT IS A WAY OF BUYING IS UNDER (a), AND NOTHING THAT IS ONE IS UNDER (b). The
 *    answer "Crypto I already have" is for someone who has it. A buyer who does not must never
 *    have to choose it to find where to get some.
 *
 * ⚠️ TWO ADDRESSES, NEVER ON SCREEN TOGETHER UNLABELLED. Money at the contract address is this
 *    payment. Money in the wallet is the buyer's until they press Pay. Each is shown only under
 *    the route that uses it, with the network.
 *
 * A token nobody sells for card or bank here (USDT on Base) is paid for by buying the one that
 * converts into it (USDC) into the wallet: one button then swaps and pays.
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
  escrowAddress: knownEscrowAddress,
  onRefreshBalance,
  preview = false,
  conversion,
  elsewherePanel,
  paidCheckPanel,
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
  // py-2: a line of underlined text is 20px high, and a thumb needs about twice that to hit it.
  const quietLink = 'py-2 text-sm underline text-secondary-600 dark:text-secondary-300 hover:text-secondary-900 dark:hover:text-white disabled:opacity-50 disabled:no-underline';

  const belowMinimumForContract = !!minimum && amountInTokens < minimum.inTokens;
  // Into the contract address: only what a provider has been seen to deliver, and never below
  // its minimum, since that address takes the exact amount.
  const krakenCanDeliver = krakenDelivers(tokenSymbol, chainId);
  const belowKrakenMinimum = amountInTokens < KRAKEN_MINIMUM_USD;
  const linkCanDeliver = linkDelivers(tokenSymbol, chainId);

  /** Which answer to "How do you want to pay?" is open. Null until chosen, when the default shows. */
  type Choice = 'card' | 'crypto';
  const [chosen, setChosen] = useState<Choice | null>(null);
  /** A company has been opened: what to do on coming back is now the next thing on screen. */
  const [started, setStarted] = useState<{ id: CardRow['id']; route: CardRow['route'] } | null>(null);
  /** Which company a purchase straight to the payment was started with, for cardSent. */
  const cardSent = (id: CardRow['id'] = 'coinbase') => {
    setStarted({ id, route: 'payment' });
    setChosen('card');
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
        onPopupClosed: () => cardSent('coinbase'),
      });
    } catch (e) {
      setCbPayError(e instanceof Error ? e.message : t('addFunds.couldNotOpenCoinbase'));
    } finally {
      setCbPayLoading(false);
    }
  };
  /**
   * Puts the payment address on the clipboard for a provider that will ask for it.
   *
   * ⚠️ NEVER AWAITED. A browser writes to the clipboard only for the page in front, and the
   *    provider's tab is in front from the moment it opens. Awaited after that, the write neither
   *    succeeded nor failed (seen 2026-11-23 in Chrome): the handler stopped there and the buyer
   *    was left looking at a blank tab. So it is asked for before the tab opens when the address
   *    is already known, and otherwise tried once and left; the address is on screen either way.
   */
  const copyForProvider = (address: string) => {
    try {
      void navigator.clipboard.writeText(address).catch(() => undefined);
    } catch {
      // No clipboard here; the address is on screen in the panel a provider opens.
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
    // Kraken's page drops the address we send it and asks the buyer for one after they sign in.
    if (knownEscrowAddress) copyForProvider(knownEscrowAddress);
    const tab = window.open('', '_blank');
    try {
      const escrowAddress = await resolveEscrowAddress();
      // The whole amount owed, in tokens, rounded up to the cent as the Coinbase route is.
      const url = escrowAddress
        ? krakenRampUrl({
            walletAddress: escrowAddress,
            tokenSymbol,
            chainId,
            amount: Math.ceil(amountInTokens * 100) / 100,
            fiatCurrency: detectUserCurrency(),
          })
        : null;
      if (!url) throw new Error(t('paymentActionPanel.couldNotPrepare'));
      if (escrowAddress && !knownEscrowAddress) copyForProvider(escrowAddress);
      void reportFundingEvent('kraken-opened', { wallet: escrowAddress ?? undefined, amount: String(amountInTokens) });
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      // Kraken has no way back here that we know of: show the address and "I have paid" now,
      // as the Coinbase route does when its window closes.
      cardSent('kraken');
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
    if (knownEscrowAddress) copyForProvider(knownEscrowAddress);
    const tab = window.open('', '_blank');
    try {
      const escrowAddress = await resolveEscrowAddress();
      const url = escrowAddress
        ? linkOnrampUrl({ tokenSymbol, chainId, amount: Math.ceil(amountInTokens * 100) / 100 })
        : null;
      if (!escrowAddress || !url) throw new Error(t('paymentActionPanel.couldNotPrepare'));
      void reportFundingEvent('link-opened', { wallet: escrowAddress, amount: String(amountInTokens) });
      if (!knownEscrowAddress) copyForProvider(escrowAddress);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      cardSent('link');
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

  /** Topping the wallet up buys this: the token itself, or the one that converts into it. */
  const walletToken = previewOther ?? fundingSymbol;
  // The routes that deliver into this wallet, shared with the "add funds" list.
  const walletFunding = useWalletFunding({
    walletAddress,
    tokenSymbol: walletToken,
    tokenAddress: viaConversion ? conversion.fromTokenAddress : previewOther ? undefined : tokenAddress,
    chainId,
    // Already the shortfall: it counts what converting the wallet's other token would cover.
    // Up to the cent, less a hair first: 20.19 - 5 is 15.190000000000001 in floating point, and
    // must not become 15.20 when each route rounds it up again.
    shortfall: Math.max(Math.ceil((preview ? amountInTokens : fundingShortfall) * 100 - 1e-7) / 100, 0),
    minimumPurchase: minimum?.inTokens,
    returnPath: addFundsReturnPath,
    onFunded: onRefreshBalance,
  });
  // True only when the visitor is known to be outside the United States, and has not said otherwise.
  const linkCountry = useLinkAvailability();
  const outsideUs = linkCountry.unavailable;

  const startWalletRoute = (id: CardRow['id'], start: () => void) => () => {
    setStarted({ id, route: 'wallet' });
    start();
  };
  const cents = (value: number) => (Math.ceil(value * 100 - 1e-7) / 100).toFixed(2);
  const needsAccount = (name: string) => t('paymentActionPanel.needsAccount', { name });
  const pasteNote = t('paymentActionPanel.pasteAddress');
  const minimumOf = (label: string) => t('paymentActionPanel.minimumNote', { minimum: label });
  /** A row's one line: the sentences that apply, in the order they matter. */
  const line = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

  /**
   * ⚠️ WHERE EACH COMPANY DELIVERS IS DECIDED HERE, ONCE, SO IT IS LISTED ONCE.
   *
   *    Straight to the payment where it can: the buyer comes back to a payment that finishes by
   *    itself. Into the wallet where it cannot: under the company's minimum (the contract address
   *    takes the exact amount, the wallet takes more), a token only its convertible is sold for,
   *    or the wallet provider's own card window, which funds this wallet and nothing else.
   *
   *    COINBASE BY COUNTRY: into the contract address it completes for United States accounts
   *    only, into a wallet it serves most countries. So a visitor known to be elsewhere gets the
   *    wallet route, which works for them, and everyone else the direct one with the warning. The
   *    country is the visitor's and not their account's: a US account holder abroad pays in two
   *    steps instead of one, and can say "Not in X?" to get the direct route back.
   *
   *    LINK is offered to everyone with its warning, as before: it sells in the United States,
   *    and one we guessed wrong is not blocked.
   *
   * ⚠️ ONE LINE EACH, AND ONLY WHAT DECIDES THE CHOICE OR IS NEEDED OVER THERE: what it takes,
   *    whether it needs an account, where it will not work, and anything the buyer has to do on
   *    the company's own page (they cannot read this one while they are on it). Where the
   *    purchase is delivered is NOT said here: it changes nothing about which to choose, and it is
   *    said, as what to do next, in the box that opens when one is chosen. Each row had three or
   *    four lines saying all of it at once, and nobody could tell the companies apart for words.
   */
  const rows: CardRow[] = [];
  if (offerTopUp && walletFunding.card.available) {
    rows.push({
      id: 'card',
      name: t('paymentActionPanel.rowCard'),
      fact: line(
        t('paymentActionPanel.rowCardFact'),
        t('paymentActionPanel.cardCheck', { amount: cents(Math.max(fundingShortfall, minimum?.inTokens ?? 0)), token: walletToken })
      ),
      route: 'wallet',
      busy: walletFunding.card.busy,
      onChoose: startWalletRoute('card', walletFunding.card.start),
    });
  }
  {
    const direct = offerCard && krakenCanDeliver && !belowKrakenMinimum;
    const viaWallet = offerTopUp && walletFunding.kraken.delivers;
    const base = { id: 'kraken' as const, name: 'Kraken' };
    const how = line(t('paymentActionPanel.byCard'), needsAccount('Kraken'));
    if (direct) {
      rows.push({ ...base, fact: line(how, pasteNote), route: 'payment', onChoose: handlePayWithKraken });
    } else if (viaWallet) {
      rows.push({
        ...base,
        fact: line(how, fundingShortfall < KRAKEN_MINIMUM_USD && minimumOf(`${KRAKEN_MINIMUM_USD} USD`), pasteNote),
        route: 'wallet',
        onChoose: startWalletRoute('kraken', walletFunding.kraken.start),
      });
    } else if (offerCard || offerTopUp) {
      rows.push({
        ...base,
        fact: how,
        route: 'payment',
        unavailable: !krakenCanDeliver
          ? t('addFunds.krakenCannotDeliver', { token: tokenSymbol, network: networkName })
          : t('payByCardModal.krakenBelowMinimum', { minimum: KRAKEN_MINIMUM_USD }),
        onChoose: () => undefined,
      });
    }
  }
  if (showCoinbasePay && (offerCard || offerTopUp)) {
    const direct = offerCard && !belowMinimumForContract;
    const base = { id: 'coinbase' as const, name: 'Coinbase' };
    const method = t('paymentActionPanel.byCardOrBank');
    if (coinbase.unavailable) {
      rows.push({
        ...base,
        fact: method,
        route: 'wallet',
        unavailable: coinbaseUnavailableReason,
        overrule: { label: t('paymentActionPanel.notInCountry', { country: coinbase.countryName ?? '' }), onClick: coinbase.overrule },
        onChoose: () => undefined,
      });
    } else if (direct && !(outsideUs && offerTopUp)) {
      rows.push({
        ...base,
        fact: line(method, t('paymentActionPanel.coinbaseUsOnly')),
        route: 'payment',
        caution: true,
        busy: cbPayLoading,
        onChoose: handlePayWithCoinbase,
      });
    } else if (offerTopUp) {
      rows.push({
        ...base,
        fact: line(method, needsAccount('Coinbase'), belowMinimumForWallet && minimumOf(minimumLabel)),
        route: 'wallet',
        busy: walletFunding.coinbase.busy,
        onChoose: startWalletRoute('coinbase', walletFunding.coinbase.start),
      });
    } else {
      rows.push({
        ...base,
        fact: method,
        route: 'payment',
        unavailable: t('payByCardModal.coinbaseBelowMinimum', { minimum: minimumLabel }),
        onChoose: () => undefined,
      });
    }
  }
  {
    const base = { id: 'link' as const, name: 'Link by Stripe' };
    const how = line(t('paymentActionPanel.byCard'), t('paymentActionPanel.linkUsOnly'), pasteNote);
    if (offerCard && linkCanDeliver) {
      rows.push({ ...base, fact: how, route: 'payment', caution: true, onChoose: handlePayWithLink });
    } else if (offerTopUp && walletFunding.link.delivers) {
      rows.push({ ...base, fact: how, route: 'wallet', caution: true, onChoose: startWalletRoute('link', walletFunding.link.start) });
    } else if (offerCard || offerTopUp) {
      rows.push({
        ...base,
        fact: t('paymentActionPanel.byCard'),
        route: 'payment',
        unavailable: t('addFunds.linkCannotDeliver', { token: tokenSymbol, network: networkName }),
        onChoose: () => undefined,
      });
    }
  }
  // Those with nothing to warn about first: the order they are most likely to complete in.
  const ableRows = rows.filter((row) => !row.unavailable).sort((a, b) => Number(!!a.caution) - Number(!!b.caution));
  const unableRows = rows.filter((row) => row.unavailable);

  // The two answers, and whether each exists for this payment.
  const hasCard = offerCard || offerTopUp;
  const hasCrypto = offerElsewhere || offerTopUp;
  // Card is open to begin with: it is the answer for a buyer who holds no crypto, which is who
  // arrives here short. Choosing is a selection, not a toggle: one is always open.
  const shownChoice: Choice | null = chosen ?? (hasCard ? 'card' : hasCrypto ? 'crypto' : null);
  const choose = (choice: Choice) => {
    if (choice === shownChoice) return;
    setChosen(choice);
    // A seller looking is not a buyer choosing: nothing is recorded or started.
    if (preview || choice !== 'crypto' || !offerElsewhere) return;
    void reportFundingEvent('other-wallet-opened', { wallet: walletAddress });
    onPayFromExternalWallet();
  };

  const tile = (selected: boolean) =>
    `flex-1 min-w-0 text-left rounded-xl border p-3 sm:p-4 transition-colors disabled:opacity-50 ${
      selected
        ? 'border-secondary-900 dark:border-white bg-secondary-50 dark:bg-secondary-700/40'
        : 'border-secondary-200 dark:border-secondary-700 hover:border-primary-500'
    }`;
  const tileTitle = 'block font-semibold text-secondary-900 dark:text-white';
  const tileFact = 'block mt-1 text-sm text-secondary-500 dark:text-secondary-400';
  const rowBox = 'rounded-xl border border-secondary-200 dark:border-secondary-700 p-4';
  const small = 'text-xs text-secondary-500 dark:text-secondary-400';
  const onNetwork = 'rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs font-medium text-yellow-800 dark:text-yellow-300';
  // In a seller's preview everything inside is off.
  const shown = (content: ReactNode) =>
    preview ? <fieldset disabled className="min-w-0 border-0 p-0">{content}</fieldset> : content;

  const reason = (text: string) =>
    !preview && !isLoadingBalance && !isPaymentInProgress ? (
      <p className="-mt-2 text-xs text-secondary-500 dark:text-secondary-400">{text}</p>
    ) : null;

  // The icon is 16px; its padding (cancelled by the margin) is what a thumb lands on.
  const copyButton = (
    <button
      type="button"
      onClick={handleCopyAddress}
      disabled={!walletAddress}
      aria-label={t('paymentActionPanel.copyFullWalletAddress')}
      className="p-3 -m-3 text-secondary-400 hover:text-secondary-900 dark:hover:text-white transition-colors disabled:opacity-40"
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
  );

  /** This wallet's address, to send to or to check against, with the way back to paying from it. */
  const walletDestination = (
    <>
      <p className="text-sm font-medium text-secondary-900 dark:text-white">
        {t('paymentActionPanel.walletOnNetwork', { network: networkName })}
      </p>
      <WalletAddressBox walletAddress={walletAddress} />
    </>
  );
  const checkBalance =
    !preview && onRefreshBalance ? (
      <button type="button" onClick={onRefreshBalance} disabled={isLoadingBalance} className={quietLink}>
        {isLoadingBalance ? t('paymentActionPanel.loading') : t('paymentActionPanel.checkBalance')}
      </button>
    ) : null;
  const thenPay = viaConversion
    ? t('paymentActionPanel.topUpThenConvert', { token: tokenSymbol, from: conversion.fromSymbol })
    : t('paymentActionPanel.topUpThen');

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-5">
      {/* The wallet and balance are the buyer's own. A seller looking at a preview would be shown
          theirs, which means nothing here and reads as if it did. */}
      {preview && (
        <p className="text-sm text-secondary-600 dark:text-secondary-300">{t('paymentActionPanel.previewWallet')}</p>
      )}
      {/* At the top only while the wallet is what pays. Short, it is one line at the foot: a red
          "99.9999 USDC short" as the first thing told a buyer with no crypto that something had
          gone wrong, before it told them anything they could do. */}
      {!preview && !showWays && (
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">{t('paymentActionPanel.connectedWallet')}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm font-mono text-secondary-500 dark:text-secondary-400">
              {shortAddress}
            </p>
            {copyButton}
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

      {(showPayButton || (isShort && !buyable && !viaConversion) || (converting && !isSameAddress && conversion.status === 'unavailable')) && (
      <div className={`${showWays ? '' : 'mt-5 '}space-y-3`}>
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
      )}

      {showWays && (
        <div className={`${showPayButton || preview ? 'mt-5 ' : ''}space-y-4`}>
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">{t('paymentActionPanel.howToPay')}</h3>
          {!preview && buysOther && (
            <p className="text-sm text-secondary-700 dark:text-secondary-200">
              {t('paymentActionPanel.convertFirst', { token: tokenSymbol, from: conversion.fromSymbol, network: networkName })}
            </p>
          )}
          {preview && <p className="text-sm text-secondary-600 dark:text-secondary-300">{t('paymentActionPanel.previewFunding')}</p>}

          {/* Side by side on a phone too: stacked, the two answers filled the screen and pushed
              every way of paying below it. */}
          {hasCard && hasCrypto && (
            <div className="flex gap-3">
              <button type="button" aria-pressed={shownChoice === 'card'} onClick={() => choose('card')} disabled={isPaymentInProgress} className={tile(shownChoice === 'card')}>
                <span className={tileTitle}>{t('paymentActionPanel.choiceCard')}</span>
                <span className={tileFact}>{t('paymentActionPanel.choiceCardFact')}</span>
              </button>
              <button type="button" aria-pressed={shownChoice === 'crypto'} onClick={() => choose('crypto')} disabled={isPaymentInProgress} className={tile(shownChoice === 'crypto')}>
                <span className={tileTitle}>{t('paymentActionPanel.choiceCrypto')}</span>
                <span className={tileFact}>{t('paymentActionPanel.choiceCryptoFact', { token: tokenSymbol, network: networkName })}</span>
              </button>
            </div>
          )}

          {shownChoice === 'card' && (
            <section aria-label={t('paymentActionPanel.choiceCard')} className="space-y-3">
              {/* How much of the other token is bought, where the token asked for is not sold. */}
              {!preview && viaConversion && (
                <p className="text-sm text-secondary-700 dark:text-secondary-200">
                  {belowMinimumForWallet
                    ? t('paymentActionPanel.buyOtherAndPayMinimum', { minimum: minimumLabel, token: tokenSymbol })
                    : t('paymentActionPanel.buyOtherAndPayNote', { amount: upToCent(fundingShortfall), from: conversion.fromSymbol, token: tokenSymbol })}
                </p>
              )}
              {/* The same, for a seller looking at what their customer will see. */}
              {preview && previewOther && (
                <p className="text-sm text-secondary-700 dark:text-secondary-200">
                  {t('paymentActionPanel.routeWalletConvert', { from: previewOther, token: tokenSymbol })}
                </p>
              )}
              {ableRows.length > 0 && <p className={small}>{t('paymentActionPanel.feesNote')}</p>}
              {shown(
                <ul className="space-y-3">
                  {ableRows.map((row) => (
                    <li key={row.id} className={rowBox}>
                      {/* On a phone the button goes under the line, full width: beside it, the line
                          was squeezed into a column four or five lines tall. */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-secondary-900 dark:text-white">{row.name}</p>
                          <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">{row.fact}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={row.onChoose}
                          disabled={preview || isPaymentInProgress || row.busy}
                          aria-label={t('payByCardModal.continueWith', { name: row.name })}
                          className="rounded-lg w-full sm:w-auto justify-center"
                        >
                          {row.busy ? t('addFunds.opening') : t('paymentActionPanel.continue')}
                        </Button>
                      </div>
                      {/* ⚠️ THE NEXT STEP IS INSIDE THE ROW OF THE COMPANY THAT WAS CHOSEN. It was a box
                          under the whole list headed "After you pay with Kraken", which read as
                          belonging to every company above it (2026-11-23). Here it can only be
                          Kraken's: what to do on coming back, and the address to check against. */}
                      {!preview && started?.id === row.id && (
                        <div className="mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-700 space-y-3">
                          <p className="text-sm font-semibold text-secondary-900 dark:text-white">{t('paymentActionPanel.afterTitle')}</p>
                          {row.route === 'payment' ? (
                            <>
                              <p className="text-sm text-secondary-700 dark:text-secondary-200">{t('paymentActionPanel.afterCard')}</p>
                              {paidCheckPanel ?? elsewherePanel}
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-secondary-700 dark:text-secondary-200">{thenPay}</p>
                              {walletDestination}
                              <p className={onNetwork}>{t('addFunds.sendOnly', { token: walletToken, network: networkName })}</p>
                              {checkBalance}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {ableRows.length === 0 && (
                <p className="text-sm text-secondary-700 dark:text-secondary-200">{t('payByCardModal.none')}</p>
              )}
              {(cbPayError || walletFunding.error) && <p role="alert" className="text-sm text-red-600">{cbPayError || walletFunding.error}</p>}

              {unableRows.length > 0 && (
                <div className="pt-2 border-t border-secondary-200 dark:border-secondary-700">
                  <p className="text-xs font-medium text-secondary-600 dark:text-secondary-300">{t('payByCardModal.notAvailable')}</p>
                  <ul className="mt-1 space-y-1">
                    {unableRows.map((row) => (
                      <li key={row.id} className={small}>
                        {row.name}: {row.unavailable}{' '}
                        {row.overrule && (
                          <button type="button" onClick={row.overrule.onClick} className="underline hover:text-secondary-900 dark:hover:text-white">
                            {row.overrule.label}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ⚠️ A QUIET LINK, NOT ANOTHER BOX. In the same box as Kraken and Coinbase it read as a
                  fifth company. It is the way on for someone none of them serve: only the card
                  services (the exchanges are the next link down, for someone with an exchange
                  account), and said first, that these deliver to the wallet here. */}
              {offerTopUp && (
                <details>
                  <summary className={`cursor-pointer ${quietLink}`}>{t('paymentActionPanel.moreCardServices')}</summary>
                  <div className={`mt-3 ${rowBox} space-y-3`}>
                    <p className="text-sm font-medium text-secondary-900 dark:text-white">
                      {viaConversion || previewOther
                        ? t('paymentActionPanel.routeWalletConvert', { from: walletToken, token: tokenSymbol })
                        : t('paymentActionPanel.moreCardServicesLead', { token: walletToken })}
                    </p>
                    <ExchangeDirectory
                      show="card-services"
                      tokenSymbol={walletToken}
                      networkName={networkName}
                      walletAddress={walletAddress || undefined}
                      preview={preview}
                      chainId={chainId}
                      amount={fundingShortfall > 0 ? Number(cents(fundingShortfall)) : undefined}
                    />
                    {checkBalance}
                  </div>
                </details>
              )}
              {/* ⚠️ UNDER "CARD OR BANK", WITH THE OTHER WAYS OF BUYING. It was put under "Crypto I
                  already have" for a day (2026-11-23), which sent a buyer with no crypto to the
                  answer that says they have some in order to find where to buy it. An exchange is
                  a place to buy with a card or a bank transfer: it is this answer. */}
              {offerTopUp && (
                <details>
                  <summary className={`cursor-pointer ${quietLink}`}>{t('paymentActionPanel.exchangeYouUse', { token: walletToken })}</summary>
                  <div className={`mt-3 ${rowBox} space-y-3`}>
                    <p className="text-sm font-medium text-secondary-900 dark:text-white">
                      {viaConversion || previewOther
                        ? t('paymentActionPanel.routeWalletConvert', { from: walletToken, token: tokenSymbol })
                        : t('paymentActionPanel.moreCardServicesLead', { token: walletToken })}
                    </p>
                    <ExchangeDirectory
                      show="exchanges"
                      ownRegionFirst
                      tokenSymbol={walletToken}
                      networkName={networkName}
                      walletAddress={walletAddress || undefined}
                      preview={preview}
                      chainId={chainId}
                      amount={fundingShortfall > 0 ? Number(cents(fundingShortfall)) : undefined}
                    />
                    {checkBalance}
                  </div>
                </details>
              )}
            </section>
          )}

          {shownChoice === 'crypto' && (
            <section aria-label={t('paymentActionPanel.choiceCrypto')} className="space-y-3">
              {offerElsewhere && (
                <>
                  {/* The network and the exact amount are said once, by the panel itself, beside the address. */}
                  <p className="text-sm text-secondary-600 dark:text-secondary-300">{t('pay.elsewhereLead')}</p>
                  {shown(elsewherePanel)}
                </>
              )}
              {offerTopUp && (
                <details open={!offerElsewhere} className={rowBox}>
                  <summary className="cursor-pointer font-semibold text-secondary-900 dark:text-white">
                    {t('paymentActionPanel.orAddToWallet', { token: walletToken })}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {/* The seller's own wallet means nothing in a preview of their customer's screen. */}
                    {!preview && (
                      <>
                        {walletDestination}
                        <div className="flex justify-center">
                          <div className="bg-white p-3 rounded-lg border border-secondary-200">
                            <QRCodeSVG value={walletAddress} size={160} level="M" marginSize={4} />
                          </div>
                        </div>
                      </>
                    )}
                    <p className={onNetwork}>{t('addFunds.sendOnly', { token: walletToken, network: networkName })}</p>
                    {!preview && <p className="text-sm text-secondary-600 dark:text-secondary-300">{thenPay}</p>}
                    {checkBalance}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* The wallet, said once and quietly: it is where a top-up lands and what Pay spends. */}
          {!preview && (
            <p className="pt-3 border-t border-secondary-200 dark:border-secondary-700 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary-500 dark:text-secondary-400">
              <span>{t('paymentActionPanel.walletLine')}</span>
              <span className="font-mono">{shortAddress}</span>
              {copyButton}
              <span aria-hidden="true">·</span>
              <span>
                {isLoadingBalance ? t('paymentActionPanel.loading') : `${balanceFloat.toFixed(4)} ${tokenSymbol}`}
                {!isLoadingBalance && converting && conversion.fromBalance > 0 && `, ${conversion.fromBalance.toFixed(4)} ${conversion.fromSymbol}`}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
