import { useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AddFundsModal from '@/components/contracts/AddFundsModal';
import { openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { canBuyToken } from '@/utils/buyableToken';
import { purchaseAmountFor } from '@/lib/stablecoinSwap';
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
}: PaymentActionPanelProps) {
  const t = useT();
  const { config } = useConfig();
  // Same gate AddFundsModal uses: no project id, no Coinbase.
  const showCoinbasePay = !!config?.coinbaseProjectId;
  const [showAddFunds, setShowAddFunds] = useState(false);
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
        onPopupClosed: onPayFromExternalWallet,
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
      onPayFromExternalWallet();
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
      onPayFromExternalWallet();
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

  const actionButton = 'w-full rounded-lg justify-center';

  const coinbaseUnavailableReason = t('paymentActionPanel.whyNoCoinbase', { country: coinbase.countryName ?? '' });

  const reason = (text: string) =>
    !preview && !isLoadingBalance && !isPaymentInProgress ? (
      <p className="-mt-2 text-xs text-secondary-500 dark:text-secondary-400">{text}</p>
    ) : null;

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-5">
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
          <p
            className={`text-lg font-bold ${
              hasInsufficientBalance
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
          {!isLoadingBalance && hasInsufficientBalance && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {t('paymentActionPanel.short', { amount: shortfall.toFixed(4), token: tokenSymbol })}
            </p>
          )}
          {!isLoadingBalance && converting && (
            <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">
              {`${conversion.fromBalance.toFixed(4)} ${conversion.fromSymbol}`}
            </p>
          )}
        </div>
      </div>

      {isSameAddress && (
        <p className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {t('paymentActionPanel.sameAddress')}
        </p>
      )}

      <div className="mt-5 space-y-3">
        <Button
          type="button"
          onClick={onPay}
          size="lg"
          disabled={!canPayFromThisWallet || isPaymentInProgress}
          className={actionButton}
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
          ) : (
            canConvertAndPay
              ? t('pay.payUsingOther', { amount: amountLabel, cost: costLabel, from: conversion.fromSymbol })
              : t('pay.payFromThisWallet', { amount: amountLabel })
          )}
        </Button>
        {hasInsufficientBalance && !isSameAddress && !converting &&
          reason(t('paymentActionPanel.whyNoPay', { amount: shortfall.toFixed(4), token: tokenSymbol }))}
        {converting && !isSameAddress && conversion.status === 'ready' &&
          reason(t('paymentActionPanel.convertNote', { from: conversion.fromSymbol, token: tokenSymbol }))}
        {converting && !isSameAddress && conversion.status === 'quoting' &&
          reason(t('paymentActionPanel.convertQuoting', { from: conversion.fromSymbol }))}
        {converting && !isSameAddress && conversion.status === 'unavailable' &&
          reason(t('paymentActionPanel.convertUnavailable', { from: conversion.fromSymbol, token: tokenSymbol }))}
        {converting && !isSameAddress && conversion.status === 'short' &&
          reason(
            t('paymentActionPanel.whyNoConvert', {
              amount: upToCent(Math.max((conversion.cost ?? shortfall) - conversion.fromBalance, 0)),
              from: conversion.fromSymbol,
              token: tokenSymbol,
            })
          )}

        {/* Both rows always on screen: the buyer sees that nobody sells this token here, and why
            they are being sent to the other one. The first row lights up when a supplier does. */}
        {viaConversion && hasInsufficientBalance && !isSameAddress && !preview && !isLoadingBalance && (
          <div role="radiogroup" aria-label={t('paymentActionPanel.howToBuy', { token: tokenSymbol })} className="rounded-lg border border-secondary-200 dark:border-secondary-700 divide-y divide-secondary-200 dark:divide-secondary-700 text-sm">
            <div role="radio" aria-checked="false" aria-disabled="true" className="flex items-start gap-3 p-3 opacity-60">
              <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-secondary-400" />
              <span>
                <span className="block font-medium text-secondary-700 dark:text-secondary-300">{t('paymentActionPanel.buyDirect', { token: tokenSymbol })}</span>
                <span className="block text-xs text-secondary-500 dark:text-secondary-400">{t('paymentActionPanel.buyDirectUnavailable', { token: tokenSymbol })}</span>
              </span>
            </div>
            <div role="radio" aria-checked="true" className="flex items-start gap-3 p-3">
              <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-4 border-primary-600" />
              <span className="font-medium text-secondary-900 dark:text-white">
                {t('paymentActionPanel.buyAndConvert', { from: conversion.fromSymbol, token: tokenSymbol })}
              </span>
            </div>
          </div>
        )}

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
            : viaConversion
              ? t('paymentActionPanel.addOtherToThis', { from: conversion.fromSymbol })
              : t('paymentActionPanel.addFundsToThis')}
        </Button>
        {!hasInsufficientBalance && !isSameAddress && reason(t('paymentActionPanel.whyNoAddFunds'))}
        {hasInsufficientBalance && !isSameAddress && !buyable && !viaConversion && reason(cannotBuyReason)}

        {/* Never gated on balance: this route bypasses the connected wallet. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            void reportFundingEvent('other-wallet-opened', { wallet: walletAddress });
            onPayFromExternalWallet();
          }}
          disabled={isPaymentInProgress || isSameAddress}
          className={actionButton}
        >{t('paymentActionPanel.payFromExternalWallet')}</Button>

        {resolveEscrowAddress && showCoinbasePay && (
          // The note lives INSIDE the button. Beneath it — even tightly spaced —
          // it read as a footnote for the whole group, and it is untrue of the
          // other options: you do not finish on Coinbase when paying from a
          // wallet. Inside the border there is nothing else it could describe.
          //
          // h-auto/py-3/flex-col override the fixed single-line height; twMerge
          // resolves them against the size classes.
          <Button
            variant="outline"
            onClick={handlePayWithCoinbase}
            disabled={isPaymentInProgress || cbPayLoading || belowMinimumForContract || coinbase.unavailable || !buyable}
            className={`${actionButton} h-auto flex-col gap-1 py-3 text-center`}
          >
            <span className="font-medium">
              {cbPayLoading ? t('paymentActionPanel.openingCoinbase') : t('paymentActionPanel.payByCard')}
            </span>
            <span className="text-xs font-normal leading-snug text-secondary-500 dark:text-secondary-400">
              {t('paymentActionPanel.coinbaseNote')}
            </span>
          </Button>
        )}
        {/* Said once: under Add funds when that is greyed out for the same reason, else here. */}
        {resolveEscrowAddress && showCoinbasePay && !buyable && !preview && !viaConversion && !(hasInsufficientBalance && !isSameAddress) &&
          reason(cannotBuyReason)}
        {/* These never pass through the wallet, so there is nothing to convert what they send. */}
        {resolveEscrowAddress && showCoinbasePay && viaConversion && !preview &&
          reason(t('paymentActionPanel.directCannotConvert', { token: tokenSymbol }))}
        {resolveEscrowAddress && showCoinbasePay && buyable && coinbase.unavailable && !preview && (
          <p className="-mt-2 text-xs text-secondary-500 dark:text-secondary-400">
            {coinbaseUnavailableReason}{' '}
            <button type="button" onClick={coinbase.overrule} className="underline hover:text-secondary-900 dark:hover:text-white">
              {t('paymentActionPanel.notInCountry', { country: coinbase.countryName ?? '' })}
            </button>
          </p>
        )}
        {resolveEscrowAddress && showCoinbasePay && buyable && !coinbase.unavailable && belowMinimumForContract &&
          reason(t('paymentActionPanel.whyNoCard', { minimum: minimumLabel }))}

        {resolveEscrowAddress && (
          <Button
            variant="outline"
            onClick={handlePayWithKraken}
            disabled={isPaymentInProgress || !krakenCanDeliver || belowKrakenMinimum}
            className={`${actionButton} h-auto flex-col gap-1 py-3 text-center`}
          >
            <span className="font-medium">{t('paymentActionPanel.payWithKraken')}</span>
            <span className="text-xs font-normal leading-snug text-secondary-500 dark:text-secondary-400">
              {t('paymentActionPanel.krakenNote')}
            </span>
          </Button>
        )}
        {/* A token nothing delivers already has its own line above; this is for the rest. */}
        {resolveEscrowAddress && buyable && !krakenCanDeliver &&
          reason(t('addFunds.krakenCannotDeliver', { token: tokenSymbol, network: networkName }))}
        {resolveEscrowAddress && krakenCanDeliver && belowKrakenMinimum &&
          reason(t('paymentActionPanel.whyNoKraken', { minimum: KRAKEN_MINIMUM_USD }))}

        {resolveEscrowAddress && (
          <Button
            variant="outline"
            onClick={handlePayWithLink}
            disabled={isPaymentInProgress || !linkCanDeliver || linkCountry.unavailable}
            className={`${actionButton} h-auto flex-col gap-1 py-3 text-center`}
          >
            <span className="font-medium">{t('paymentActionPanel.payWithLink')}</span>
            <span className="text-xs font-normal leading-snug text-secondary-500 dark:text-secondary-400">
              {t('paymentActionPanel.linkNote')}
            </span>
          </Button>
        )}
        {resolveEscrowAddress && buyable && !linkCanDeliver &&
          reason(t('addFunds.linkCannotDeliver', { token: tokenSymbol, network: networkName }))}
        {resolveEscrowAddress && linkCanDeliver && linkCountry.unavailable && !preview && (
          <p className="-mt-2 text-xs text-secondary-500 dark:text-secondary-400">
            {t('addFunds.linkNotInCountry', { country: linkCountry.countryName ?? '' })}{' '}
            <button type="button" onClick={linkCountry.overrule} className="underline hover:text-secondary-900 dark:hover:text-white">
              {t('paymentActionPanel.notInCountry', { country: linkCountry.countryName ?? '' })}
            </button>
          </p>
        )}
      </div>

      {cbPayError && <p className="mt-2 text-sm text-red-600">{cbPayError}</p>}

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
