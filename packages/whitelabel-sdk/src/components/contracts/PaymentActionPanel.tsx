import { useState, type ReactNode } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AddFundsModal from '@/components/contracts/AddFundsModal';
import PayByCardModal, { type CardProvider } from '@/components/contracts/PayByCardModal';
import PayWithCryptoModal from '@/components/contracts/PayWithCryptoModal';
import { openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { canBuyToken } from '@/utils/buyableToken';
import { convertibleFrom, purchaseAmountFor } from '@/lib/stablecoinSwap';
import { linkDelivers, linkOnrampUrl } from '@/lib/stripeLinkOnramp';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { KRAKEN_MINIMUM_USD, krakenDelivers, krakenRampUrl } from '@/lib/krakenRamp';
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
  /** Where Coinbase should return the user; see AddFundsModal. */
  addFundsReturnPath?: string;
  /**
   * Resolves (creating if needed) the escrow this payment funds. Present only
   * where paying straight into the contract makes sense; without it the
   * "Pay by card or bank transfer" option is not offered.
   */
  resolveEscrowAddress?: () => Promise<string | null>;
  /** A seller's preview: everything is off, and the preview says so, so no reasons are given. */
  preview?: boolean;
  /** Present when the wallet's other stablecoin could pay this; see PaymentConversion. */
  conversion?: PaymentConversion;
  /**
   * The payment address, its QR and "I have paid", for the "Pay with crypto" modal. Absent when
   * the payment cannot be paid from elsewhere (PaymentOptions).
   */
  elsewherePanel?: ReactNode;
}

/**
 * The connected wallet, and the three things a buyer can do from it.
 *
 * Balance decides which of the two wallet-dependent actions is live: with
 * enough funds you can pay and there is nothing to add; short of funds you must
 * add first. Exactly one of those two is ever enabled, so the choice is made
 * for the user rather than by them.
 *
 * "Pay from external wallet" is the exception and stays enabled either way — it
 * sends straight to the escrow contract and never touches this wallet, so
 * balance is irrelevant to it. That is also why topping up and paying
 * externally are kept visibly distinct despite both meaning "use a wallet I
 * already have": they end in different places.
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
  preview = false,
  conversion,
  elsewherePanel,
}: PaymentActionPanelProps) {
  const t = useT();
  const { config } = useConfig();
  // Same gate AddFundsModal uses: no project id, no Coinbase.
  const showCoinbasePay = !!config?.coinbaseProjectId;
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showCrypto, setShowCrypto] = useState(false);
  const [cryptoView, setCryptoView] = useState<'ask' | 'elsewhere'>('ask');
  /**
   * The address, QR and "I have paid": where a buyer lands after sending money from anywhere
   * else, a card provider included, because pressing "I have paid" is what secures it.
   */
  const showElsewhere = () => {
    setShowCard(false);
    setCryptoView('elsewhere');
    setShowCrypto(true);
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
        onPopupClosed: showElsewhere,
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
      // Kraken has no way back here that we know of: show the panel that checks the address
      // and sweeps the money in, as the Coinbase route does when its window closes.
      showElsewhere();
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
      showElsewhere();
    } catch (e) {
      tab?.close();
      setCbPayError(e instanceof Error ? e.message : t('paymentActionPanel.couldNotPrepare'));
    }
  };
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
  const belowMinimumForContract = !!minimum && amountInTokens < minimum.inTokens;
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
  // Every way of adding funds buys the token or sends it to this wallet first; for a token no
  // onramp delivers the buyer is pointed at what does work instead (their own holding, or USDC).
  // Kraken into the payment address: only what it has been seen to deliver, and never below its
  // minimum, since the payment address takes the exact amount.
  const krakenCanDeliver = krakenDelivers(tokenSymbol, chainId);
  const belowKrakenMinimum = amountInTokens < KRAKEN_MINIMUM_USD;
  const linkCanDeliver = linkDelivers(tokenSymbol, chainId);
  // Link sells in the United States only; the country is advice, so it can be overruled.
  const linkCountry = useLinkAvailability();
  // With enough of the other token already in the wallet there is nothing to add: it pays.
  const canAddFunds =
    hasInsufficientBalance && !isLoadingBalance && (buyable || (viaConversion && !canConvertAndPay));
  // Rounded up, so the figure on the button is never less than what leaves the wallet.
  // (Less a hair first: 20.01 * 100 is 2001.0000000000002 in floating point, and must not become 20.02.)
  const upToCent = (value: number) => (Math.ceil(value * 100 - 1e-7) / 100).toFixed(2);
  const costLabel = conversion?.cost != null ? upToCent(conversion.cost) : '';
  const cannotBuyReason = t('addFunds.cannotBuyToken', { token: tokenSymbol });

  const coinbaseUnavailableReason = t('paymentActionPanel.whyNoCoinbase', { country: coinbase.countryName ?? '' });

  const actionButton = 'w-full rounded-lg justify-center';
  const twoLineButton = `${actionButton} h-auto flex-col gap-1 py-3 text-center`;
  const secondLine = 'text-xs font-normal leading-snug text-secondary-500 dark:text-secondary-400';
  // Short of both tokens, with a price to go on: buying the other one is the next step, and the
  // pay button would only be a greyed-out thing above it.
  const buyOtherIsNext = viaConversion && hasInsufficientBalance && conversion.status === 'short' && !isSameAddress && !preview;
  // The two choices, and whether each exists for this payment.
  const offerCard = !!resolveEscrowAddress && buyable;
  const offerCrypto = !!elsewherePanel || preview;
  // No greyed-out pay button above the choices when paying from the wallet is not the next step.
  const walletCannotPay =
    hasInsufficientBalance && !isLoadingBalance && !isPreparing && !isPaymentInProgress && !isSameAddress && !preview;
  // ⚠️ A SELLER'S PREVIEW IS THE SCREEN A CUSTOMER WITH NO MONEY IN THEIR WALLET GETS, AND IT OPENS.
  //    That customer is the one a seller worries about, so the preview shows the two choices and
  //    lets both modals be opened to look at. Nothing behind them is live: no provider can be
  //    continued with, no address is real, nothing can be pressed that pays. A preview where
  //    nothing responded left the seller wondering whether the real thing works.
  const previewOther = preview && !buyable ? convertibleFrom(chainId, tokenSymbol) : null;
  const showPayButton = !preview && !(
    buyOtherIsNext ||
    (walletCannotPay && buyable && (offerCard || offerCrypto) && !canConvertAndPay && conversion?.status !== 'quoting')
  );

  const cardProviders: CardProvider[] = !offerCard
    ? []
    : [
        ...(showCoinbasePay
          ? [
              {
                id: 'coinbase' as const,
                name: 'Coinbase',
                fact: minimum ? t('payByCardModal.coinbaseFactFrom', { minimum: minimumLabel }) : t('payByCardModal.coinbaseFact'),
                unavailable: coinbase.unavailable
                  ? coinbaseUnavailableReason
                  : belowMinimumForContract
                    ? t('payByCardModal.coinbaseBelowMinimum', { minimum: minimumLabel })
                    : undefined,
                overrule: coinbase.unavailable
                  ? { label: t('paymentActionPanel.notInCountry', { country: coinbase.countryName ?? '' }), onClick: coinbase.overrule }
                  : undefined,
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
          unavailable: !linkCanDeliver
            ? t('addFunds.linkCannotDeliver', { token: tokenSymbol, network: networkName })
            : linkCountry.unavailable
              ? t('addFunds.linkNotInCountry', { country: linkCountry.countryName ?? '' })
              : undefined,
          overrule:
            linkCanDeliver && linkCountry.unavailable
              ? { label: t('paymentActionPanel.notInCountry', { country: linkCountry.countryName ?? '' }), onClick: linkCountry.overrule }
              : undefined,
          onChoose: handlePayWithLink,
        },
      ];


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

      {/*
        ⚠️ ONE NEXT STEP, OR TWO PLAIN CHOICES. NOTHING ELSE ON THIS SCREEN.
           A wallet that can pay gets one prominent button. One that cannot gets "Pay by card or
           bank transfer" and "Pay with crypto": a question any buyer can answer. Which provider,
           topping up, the payment address and its QR all live in the modals behind those two
           (PayByCardModal, PayWithCryptoModal). The screen used to carry six buttons of equal
           weight, three of them different companies doing the same thing.

           The buttons say it, not a paragraph beside them: a main line for what happens and,
           where one fact decides it, a second line for that fact. A request in a token nobody
           sells here (USDT) is paid with the one they do (USDC), and its buttons are where the
           buyer learns that: "Pay 20 USDT with your USDC", or "Buy USDC and pay with it" beside
           a greyed "Buy USDT" that says it is not sold here.
      */}
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

        {buyOtherIsNext && (
          <Button
            type="button"
            size="lg"
            onClick={() => setShowAddFunds(true)}
            disabled={isPaymentInProgress}
            className={twoLineButton}
          >
            <span className="font-medium">{t('paymentActionPanel.buyOtherAndPay', { from: conversion.fromSymbol })}</span>
            <span className="text-xs font-normal leading-snug opacity-80">
              {belowMinimumForWallet
                ? t('paymentActionPanel.buyOtherAndPayMinimum', { minimum: minimumLabel, token: tokenSymbol })
                : t('paymentActionPanel.buyOtherAndPayNote', {
                    amount: upToCent(fundingShortfall),
                    from: conversion.fromSymbol,
                    token: tokenSymbol,
                  })}
            </span>
          </Button>
        )}
        {/* Always beside the route that works, so the buyer sees this token cannot be bought here
            and is not left wondering why they are being sent to another. It lights up, with a
            supplier behind it, the day one sells it. */}
        {viaConversion && hasInsufficientBalance && !canConvertAndPay && conversion.status !== 'quoting' && !preview && (
          <Button type="button" variant="outline" size="lg" disabled className={twoLineButton}>
            <span className="font-medium">{t('paymentActionPanel.buyToken', { token: tokenSymbol })}</span>
            <span className={secondLine}>{t('paymentActionPanel.buyTokenUnavailable')}</span>
          </Button>
        )}

        {previewOther && (
          <>
            <Button type="button" size="lg" disabled className={twoLineButton}>
              <span className="font-medium">{t('paymentActionPanel.buyOtherAndPay', { from: previewOther })}</span>
              <span className="text-xs font-normal leading-snug opacity-80">
                {t('paymentActionPanel.buyOtherAndPayPreview', { token: tokenSymbol })}
              </span>
            </Button>
            <Button type="button" variant="outline" size="lg" disabled className={twoLineButton}>
              <span className="font-medium">{t('paymentActionPanel.buyToken', { token: tokenSymbol })}</span>
              <span className={secondLine}>{t('paymentActionPanel.buyTokenUnavailable')}</span>
            </Button>
          </>
        )}

        {/* The card route: only for a token a card can buy, and only where the money can be sent
            straight to the payment (resolveEscrowAddress). */}
        {offerCard && (
          <Button
            type="button"
            size="lg"
            variant={showPayButton ? 'outline' : undefined}
            onClick={() => setShowCard(true)}
            disabled={isPaymentInProgress}
            className={twoLineButton}
          >
            <span className="font-medium">{t('paymentActionPanel.payByCard')}</span>
            <span className={showPayButton ? secondLine : 'text-xs font-normal leading-snug opacity-80'}>
              {t('paymentActionPanel.payByCardNote')}
            </span>
          </Button>
        )}

        {/* Never gated on balance: holding the token somewhere else is one of the answers. */}
        {offerCrypto && (
          <Button
            type="button"
            size="lg"
            variant={showPayButton || buyOtherIsNext || !buyable ? 'outline' : undefined}
            onClick={() => {
              // Where the token cannot be bought there is nothing to ask: this is for someone who
              // already holds it, and goes straight to the address.
              setCryptoView(buyable ? 'ask' : 'elsewhere');
              setShowCrypto(true);
              // A seller looking is not a buyer choosing: nothing is recorded or started.
              if (preview) return;
              void reportFundingEvent('other-wallet-opened', { wallet: walletAddress });
              if (!buyable) onPayFromExternalWallet();
            }}
            disabled={isPaymentInProgress || isSameAddress}
            className={twoLineButton}
          >
            <span className="font-medium">
              {buyable ? t('paymentActionPanel.payWithCrypto') : t('paymentActionPanel.sendFromAnotherWallet', { token: tokenSymbol })}
            </span>
            <span className={showPayButton || buyOtherIsNext || !buyable ? secondLine : 'text-xs font-normal leading-snug opacity-80'}>
              {buyable
                ? t('paymentActionPanel.payWithCryptoNote')
                : t('paymentActionPanel.sendFromAnotherWalletNote', { token: tokenSymbol })}
            </span>
          </Button>
        )}

        {/* With no modal to hold it (no address to pay from elsewhere), topping up stays here. */}
        {!offerCrypto && !(viaConversion && hasInsufficientBalance) && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setShowAddFunds(true)}
            disabled={!canAddFunds || isPaymentInProgress}
            className={actionButton}
          >
            {belowMinimumForWallet
              ? t('paymentActionPanel.addFundsBelowMinimum', { minimum: minimumLabel })
              : t('paymentActionPanel.addFundsToThis')}
          </Button>
        )}
        {hasInsufficientBalance && !isSameAddress && !buyable && !viaConversion && reason(cannotBuyReason)}
      </div>

      {cbPayError && <p className="mt-2 text-sm text-red-600">{cbPayError}</p>}

      <PayByCardModal
        isOpen={showCard}
        onClose={() => setShowCard(false)}
        providers={cardProviders}
        lookOnly={preview}
        opening={cbPayLoading ? 'coinbase' : null}
        error={cbPayError}
        onUseCrypto={
          offerCrypto
            ? () => {
                setShowCard(false);
                setCryptoView('ask');
                setShowCrypto(true);
              }
            : undefined
        }
      />
      <PayWithCryptoModal
        isOpen={showCrypto}
        onClose={() => setShowCrypto(false)}
        tokenSymbol={tokenSymbol}
        view={cryptoView}
        lookOnly={preview}
        onViewChange={setCryptoView}
        elsewhere={elsewherePanel}
        topUp={
          canAddFunds && buyable && !preview
            ? {
                note: belowMinimumForWallet
                  ? t('payWithCryptoModal.topUpMinimum', { minimum: minimumLabel })
                  : t('payWithCryptoModal.topUpNote', { held: balanceFloat.toFixed(2), amount: upToCent(shortfall), token: tokenSymbol }),
                onClick: () => {
                  setShowCrypto(false);
                  setShowAddFunds(true);
                },
              }
            : undefined
        }
        onUseCard={
          offerCard
            ? () => {
                setShowCrypto(false);
                setShowCard(true);
              }
            : undefined
        }
      />
      <AddFundsModal
        isOpen={showAddFunds}
        onClose={() => setShowAddFunds(false)}
        walletAddress={walletAddress}
        tokenAddress={viaConversion ? conversion.fromTokenAddress : tokenAddress}
        tokenSymbol={fundingSymbol}
        tokenDecimals={viaConversion ? conversion.fromTokenDecimals : tokenDecimals}
        chainId={chainId}
        networkName={networkName}
        shortfall={fundingShortfall}
        minimumPurchase={minimum?.inTokens}
        coinbaseUnavailable={coinbase.unavailable ? coinbaseUnavailableReason : undefined}
        returnPath={addFundsReturnPath}
      />
    </div>
  );
}
