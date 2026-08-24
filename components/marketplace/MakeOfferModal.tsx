import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { displayCurrencyPrecise } from '@/utils/currency';
import { daysUntil } from '@/utils/marketplace';
import { EvidenceAsymmetryNotice, ExistingHoldbackNotice } from '@/components/marketplace/OfferDisclosures';
import OfferFundingPanel from '@/components/marketplace/OfferFundingPanel';
import type { SellableEscrow } from '@/types/marketplace';

interface MakeOfferModalProps {
  escrow: SellableEscrow;
  lpAddress: string;
  onClose: () => void;
  onOfferMade: () => Promise<void> | void;
}

type Step = 'compose' | 'creating' | 'funding' | 'done';

/**
 * An LP's bid (MARKETPLACE_OPENSPEC §15.6d, §5.0).
 *
 * ⚠️ THE LP SIGNS EXACTLY ONE TRANSACTION: a plain ERC20 transfer of their capital to their
 *    own vault. The platform deploys the vault beforehand (moves no money, needs no signature)
 *    and opens the offer afterwards (moves no money either — `fund()` only observes that the
 *    balance arrived). This mirrors the escrow's direct-payment path, `transferToContract` +
 *    `checkAndActivate`, and for the same reason: a token transfer is the one call a wallet
 *    can decode and show the LP honestly, in the token they are actually spending.
 *
 *    That split is exactly why the platform may create the vault on their behalf without
 *    holding any power over their money, and it is why an unfunded vault is not an offer and
 *    never appears in a seller's book.
 *
 * ⚠️ THIS MODAL DEPLOYS THE VAULT AND NOTHING ELSE. Getting capital into it is
 *    `OfferFundingPanel`, which is the escrow's own funding flow — including the rule that
 *    a retry after a landed deposit must open it rather than send again.
 *
 * ⚠️ PRICE AGAINST `payoutAmount()`, NOT THE GROSS ESCROW AMOUNT (§3.1). The recipient collects
 *    `AMOUNT − CREATOR_FEE`, so quoting a discount off the gross overstates the position by the
 *    creator fee — on every offer, in the LP's favour on screen and against them in reality.
 */
export default function MakeOfferModal({ escrow, lpAddress, onClose, onOfferMade }: MakeOfferModalProps) {
  const { config } = useConfig();
  const { createOfferVault } = useMarketplaceActions();

  const [discount, setDiscount] = useState('1.5');
  const [holdbackPercent, setHoldbackPercent] = useState('0');
  const [step, setStep] = useState<Step>('compose');
  const [error, setError] = useState<string | null>(null);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [payout, setPayout] = useState<bigint | null>(null);
  const [payoutUnavailable, setPayoutUnavailable] = useState(false);
  /* How long an offer stands. Needed to know whether this escrow can be bid on at all — see
     the maturity guard below. Null until read; the guard stays silent rather than guessing. */
  const [offerWindowSeconds, setOfferWindowSeconds] = useState<number | null>(null);

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const days = daysUntil(escrow.maturity);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/chain/marketplace/terms');
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const body = await response.json();
        if (!cancelled && body.defaultOfferDurationSeconds != null) {
          setOfferWindowSeconds(Number(body.defaultOfferDurationSeconds));
        }
      } catch (e) {
        // Unknown window: the guard below stays quiet rather than blocking an offer that
        // might be perfectly valid. The factory still refuses a genuinely bad one.
        console.warn('Could not read the marketplace offer window:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * ⚠️ AN ESCROW CLOSER TO MATURITY THAN THE OFFER WINDOW CANNOT BE BID ON.
   *
   *    The factory sets the expiry to `block.timestamp + defaultOfferDuration` and reverts if
   *    that reaches maturity — OfferExpiryExceedsEscrowMaturity. So for an escrow maturing
   *    inside the window, every offer fails, and it fails AFTER the LP has signed and paid for
   *    gas. Observed in the wild: an escrow 97 seconds from maturity against a 600 second
   *    window, reverting 503 seconds past it.
   *
   *    Checked here so the answer arrives before the signature rather than after it. The
   *    contract remains the authority; this only avoids asking the user to pay to be refused.
   */
  const secondsToMaturity = escrow.maturity - Math.floor(Date.now() / 1000);
  const maturesInsideOfferWindow =
    offerWindowSeconds !== null && secondsToMaturity <= offerWindowSeconds;

  // The LP deposits by transferring THIS token to the vault. The escrow's own token is the
  // only correct one — the vault is initialized with `escrow.token()` on-chain, so a deposit
  // in anything else would sit in the vault as an unrelated balance and never open the offer.
  // The configured default is a fallback for discovery rows that did not carry it.
  const tokenAddress = escrow.token || config?.defaultToken?.address || config?.usdcContractAddress || null;

  /* The figure the LP is buying, at the moment of pricing.
     Read through chainservice rather than from a node: the webapp does not talk to the chain,
     and this figure is fixed at the escrow's creation, so chainservice serves it from cache to
     every LP looking at the same escrow. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/chain/marketplace/escrows/${escrow.escrowContract}/payout-amount`
        );
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const body = await response.json();
        if (cancelled) return;
        // Null means the escrow could not be read — unknown, not zero. Falling back to the
        // discovery row's amount would price the offer against a figure nobody confirmed.
        if (body.payoutAmount == null) setPayoutUnavailable(true);
        else setPayout(BigInt(body.payoutAmount));
      } catch (e) {
        console.warn('Could not read payoutAmount for the escrow:', e);
        if (!cancelled) setPayoutUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [escrow.escrowContract]);

  const basis = payout ?? (escrow.amount ? BigInt(escrow.amount) : BigInt(0));
  const discountRate = parseFloat(discount);
  const holdbackRate = parseFloat(holdbackPercent);
  const ratesValid =
    Number.isFinite(discountRate) && discountRate >= 0 && discountRate < 100 &&
    Number.isFinite(holdbackRate) && holdbackRate >= 0 && holdbackRate < 100;

  // Integer arithmetic in base units — basis points keep this exact rather than round-tripping
  // through a float and paying out a dust discrepancy.
  const offerAmount = ratesValid && basis > BigInt(0)
    ? (basis * BigInt(Math.round((100 - discountRate) * 100))) / BigInt(10_000)
    : BigInt(0);
  const holdbackAmount = ratesValid && offerAmount > BigInt(0)
    ? (offerAmount * BigInt(Math.round(holdbackRate * 100))) / BigInt(10_000)
    : BigInt(0);

  // A holdback may only be set on an escrow that has never been sold — the escrow holds exactly
  // one reserve record, and the contract rejects a second at acceptance (§0.4c H-1).
  const holdbackAllowed = !escrow.previouslySold;

  const canSubmit =
    ratesValid && offerAmount > BigInt(0) && step === 'compose' && !!lpAddress && !!tokenAddress &&
    !maturesInsideOfferWindow;

  const submit = async () => {
    setError(null);
    setStep('creating');
    try {
      if (!tokenAddress) {
        throw new Error('This escrow\u2019s payment token could not be determined, so there is nothing to deposit.');
      }
      // The platform deploys the vault. No money moves and the LP signs nothing. Everything
      // after this — which wallet the capital comes from, and opening the offer once it
      // lands — belongs to OfferFundingPanel, which is the escrow's own funding flow.
      const created = await createOfferVault({
        escrowContract: escrow.escrowContract,
        lp: lpAddress,
        offerAmount: offerAmount.toString(),
        holdback: holdbackAllowed ? holdbackAmount.toString() : '0'
      });

      if (!created.success || !created.vaultAddress) {
        throw new Error(created.error || 'The offer vault could not be created.');
      }
      setVaultAddress(created.vaultAddress);
      setStep('funding');
    } catch (e: any) {
      setError(e?.message || 'The offer could not be completed.');
      setStep('compose');
    }
  };

  /*
   * Dismissing is refused once the vault exists.
   *
   * `submit` deploys the vault BEFORE any money moves, so from `creating` onwards there is a
   * real contract on chain that only this LP can fund. A stray click on the backdrop at that
   * point leaves it deployed and empty: it holds no capital, but it is listed against the
   * escrow until it lapses and is swept, and the seller sees it alongside genuine offers with
   * nothing to tell them apart. Deliberate exits still work — `Cancel` in the compose step, and
   * the funding panel's own cancel — but a misplaced click no longer strands one.
   */
  const dismissable = step === 'compose' || step === 'done';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-secondary-800 border border-transparent dark:border-secondary-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Offer on {escrow.description || escrow.productName || 'this payment'}
        </h3>
        {/*
          The LP is committing capital against this specific cashflow, so both facts they need
          to check it out themselves are here: a link to the escrow on the explorer, and the
          CURRENT recipient they would be buying from — which after a resale is not the original
          seller.
        */}
        <p className="text-sm text-gray-500 dark:text-secondary-400 font-mono mt-1">
          {config?.explorerBaseUrl ? (
            <a
              href={`${config.explorerBaseUrl}/address/${escrow.escrowContract}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
              title="View this payment on the block explorer"
            >
              {escrow.escrowContract}
            </a>
          ) : (
            escrow.escrowContract
          )}
        </p>
        {escrow.seller && (
          <p className="text-sm text-gray-500 dark:text-secondary-400 mt-1">
            Currently paid to{' '}
            {config?.explorerBaseUrl ? (
              <a
                href={`${config.explorerBaseUrl}/address/${escrow.seller}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                title="View the current recipient on the block explorer"
              >
                {escrow.seller}
              </a>
            ) : (
              <span className="font-mono">{escrow.seller}</span>
            )}
          </p>
        )}

        {step === 'done' ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-200">
              <div className="font-medium">Your offer is funded and live.</div>
              <p className="mt-1">
                The seller can now accept it. Nothing moves until they do — and if they never do,
                you withdraw your capital from your offer list once it lapses.
              </p>
            </div>
            <Button type="button" className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <EvidenceAsymmetryNotice maturity={escrow.maturity} />

            {escrow.existingHoldback && escrow.existingHoldback !== '0' && (
              <ExistingHoldbackNotice
                holdback={escrow.existingHoldback}
                funder={escrow.existingHoldbackFunder}
                tokenSymbol={tokenSymbol}
              />
            )}

            <div>
              <label htmlFor="discount" className="block text-sm font-medium text-gray-700 dark:text-secondary-200 mb-1">
                Your discount rate (%)
              </label>
              <input
                id="discount"
                type="number"
                min="0"
                max="99"
                step="0.1"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                disabled={step !== 'compose'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-gray-900 dark:text-white rounded-md"
              />
            </div>

            <div>
              <label htmlFor="holdback" className="block text-sm font-medium text-gray-700 dark:text-secondary-200 mb-1">
                Reserve to hold back (% of your offer)
              </label>
              <input
                id="holdback"
                type="number"
                min="0"
                max="99"
                step="0.5"
                value={holdbackAllowed ? holdbackPercent : '0'}
                onChange={(e) => setHoldbackPercent(e.target.value)}
                disabled={!holdbackAllowed || step !== 'compose'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-gray-900 dark:text-white rounded-md disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 dark:text-secondary-400 mt-1">
                {holdbackAllowed ? (
                  <>
                    Withheld from the seller until the escrow settles in full, then returned to
                    them. It is your buffer if the payment is disputed — and one of the few levers
                    you have.
                  </>
                ) : (
                  <>
                    This escrow already carries a reserve from an earlier sale, and an escrow can
                    hold only one. You cannot set another.
                  </>
                )}
              </p>
            </div>

            <div className="rounded-md bg-gray-50 dark:bg-secondary-900/60 p-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-600 dark:text-secondary-300">
                <span>Collects at maturity</span>
                <span>{displayCurrencyPrecise(basis.toString(), 'microUSDC')} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-secondary-300">
                <span>Your discount</span>
                <span>− {displayCurrencyPrecise((basis - offerAmount).toString(), 'microUSDC')} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white border-t border-gray-200 dark:border-secondary-700 pt-2 mt-1">
                <span>You deposit now</span>
                <span>{displayCurrencyPrecise(offerAmount.toString(), 'microUSDC')} {tokenSymbol}</span>
              </div>
              {payoutUnavailable && (
                <p className="text-xs text-amber-700 dark:text-amber-300 pt-1">
                  The escrow&apos;s exact payout could not be read, so this is priced off the gross
                  amount. The real figure is slightly lower — the creator fee comes out of it.
                </p>
              )}
            </div>

            {/* Said plainly, and before the signature: the transaction cannot succeed. */}
            {maturesInsideOfferWindow && (
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200">
                This payment matures{' '}
                {secondsToMaturity > 0
                  ? `in about ${Math.max(1, Math.round(secondsToMaturity / 60))} minute${Math.round(secondsToMaturity / 60) === 1 ? '' : 's'}`
                  : 'imminently'}
                , sooner than the {Math.round((offerWindowSeconds ?? 0) / 60)}-minute window an
                offer stands for. An offer here would outlive the payment it is bidding on, which
                the contract refuses — so it cannot be made rather than being worth trying.
              </div>
            )}

            {/*
              The seller's headline is their NET, and it is not the number above: the platform fee
              and any reserve come out of the LP's deposit before they see it (§8.5a).
            */}
            <p className="text-xs text-gray-500 dark:text-secondary-400">
              The seller sees what they would receive after the platform fee and any reserve — a
              smaller number than your deposit. They accept or decline; nothing moves until they do.
            </p>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {/*
              Funding hands off entirely to the escrow's own flow: pay from the connected
              wallet, top that wallet up first, or send from an external wallet by link/QR
              with an "I have paid" button. The vault address is fixed by now, so the LP may
              leave and come back to any of those routes.
            */}
            {step === 'funding' && vaultAddress && tokenAddress ? (
              <OfferFundingPanel
                vaultAddress={vaultAddress}
                tokenAddress={tokenAddress}
                offerAmount={offerAmount.toString()}
                lpAddress={lpAddress}
                onFunded={async () => {
                  setStep('done');
                  await onOfferMade();
                }}
                onCancel={onClose}
              />
            ) : (
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={step === 'creating'}>
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={submit} disabled={!canSubmit}>
                  {step === 'compose' ? (
                    'Make this offer'
                  ) : (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Creating vault…
                    </>
                  )}
                </Button>
              </div>
            )}

            {!ethers.isAddress(lpAddress) && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Connect a wallet before making an offer.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
