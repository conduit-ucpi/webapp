import { useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AddFundsModal from '@/components/contracts/AddFundsModal';
import { openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { useConfig } from '@/components/auth/ConfigProvider';

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
  loadingMessage,
  onPay,
  onPayFromExternalWallet,
  addFundsReturnPath,
  resolveEscrowAddress,
}: PaymentActionPanelProps) {
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
      if (!escrowAddress) throw new Error('Could not prepare the escrow contract');

      await openCoinbaseOnramp({
        destinationAddress: escrowAddress,
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
      setCbPayError(e instanceof Error ? e.message : 'Could not open Coinbase');
    } finally {
      setCbPayLoading(false);
    }
  };
  const [copied, setCopied] = useState(false);

  const shortfall = Math.max(amountInTokens - balanceFloat, 0);
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
  const canPayFromThisWallet = !hasInsufficientBalance && !isSameAddress && !isLoadingBalance;
  const canAddFunds = hasInsufficientBalance && !isLoadingBalance;

  const actionButton = 'w-full rounded-lg justify-center';

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">
            Connected wallet
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm font-mono text-secondary-500 dark:text-secondary-400">
              {shortAddress}
            </p>
            <button
              type="button"
              onClick={handleCopyAddress}
              disabled={!walletAddress}
              aria-label="Copy full wallet address"
              className="text-secondary-400 hover:text-secondary-900 dark:hover:text-white transition-colors disabled:opacity-40"
            >
              {copied ? (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Copied</span>
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
              <span className="animate-pulse text-secondary-500">Loading…</span>
            ) : (
              `${balanceFloat.toFixed(4)} ${tokenSymbol}`
            )}
          </p>
          {!isLoadingBalance && hasInsufficientBalance && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {shortfall.toFixed(4)} {tokenSymbol} short
            </p>
          )}
        </div>
      </div>

      {isSameAddress && (
        <p className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          Your wallet address matches the seller&apos;s. The buyer and seller must be different
          accounts.
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
              {loadingMessage?.match(/Step \d+/)?.[0] || 'Processing…'}
            </>
          ) : (
            `Pay ${amountLabel} from this wallet`
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setShowAddFunds(true)}
          disabled={!canAddFunds || isPaymentInProgress}
          className={actionButton}
        >
          Add funds to this wallet
        </Button>

        {/* Never gated on balance: this route bypasses the connected wallet. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onPayFromExternalWallet}
          disabled={isPaymentInProgress || isSameAddress}
          className={actionButton}
        >
          Pay from external wallet
        </Button>

        {resolveEscrowAddress && showCoinbasePay && (
          <Button
            variant="outline"
            onClick={handlePayWithCoinbase}
            disabled={isPaymentInProgress || cbPayLoading}
            className={actionButton}
          >
            {cbPayLoading ? 'Opening Coinbase…' : 'Pay by card or bank transfer'}
          </Button>
        )}
      </div>

      {cbPayError && <p className="mt-2 text-sm text-red-600">{cbPayError}</p>}

      <AddFundsModal
        isOpen={showAddFunds}
        onClose={() => setShowAddFunds(false)}
        walletAddress={walletAddress}
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        tokenDecimals={tokenDecimals}
        chainId={chainId}
        networkName={networkName}
        shortfall={shortfall}
        returnPath={addFundsReturnPath}
      />
    </div>
  );
}
