import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfig } from '@/components/auth/ConfigProvider';
import { RpcClient } from '@/lib/rpc/RpcClient';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { displayCurrency } from '@/utils/currency';
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

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const days = daysUntil(escrow.maturity);

  // The LP deposits by transferring THIS token to the vault. The escrow's own token is the
  // only correct one — the vault is initialized with `escrow.token()` on-chain, so a deposit
  // in anything else would sit in the vault as an unrelated balance and never open the offer.
  // The configured default is a fallback for discovery rows that did not carry it.
  const tokenAddress = escrow.token || config?.defaultToken?.address || config?.usdcContractAddress || null;

  // The figure the LP is buying, read from the escrow itself at the moment of pricing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!config?.rpcUrl) return;
      try {
        const value = await new RpcClient(config.rpcUrl).getPayoutAmount(escrow.escrowContract);
        if (!cancelled) setPayout(value);
      } catch (e) {
        console.warn('Could not read payoutAmount from the escrow:', e);
        if (!cancelled) setPayoutUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config?.rpcUrl, escrow.escrowContract]);

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
    ratesValid && offerAmount > BigInt(0) && step === 'compose' && !!lpAddress && !!tokenAddress;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-secondary-800 border border-transparent dark:border-secondary-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Offer on {escrow.productName || escrow.description || 'this payment'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-secondary-400 font-mono mt-1">
          {escrow.escrowContract}
        </p>

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
            <EvidenceAsymmetryNotice daysToMaturity={days} />

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
                <span>{displayCurrency(basis.toString(), 'microUSDC')} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-secondary-300">
                <span>Your discount</span>
                <span>− {displayCurrency((basis - offerAmount).toString(), 'microUSDC')} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white border-t border-gray-200 dark:border-secondary-700 pt-2 mt-1">
                <span>You deposit now</span>
                <span>{displayCurrency(offerAmount.toString(), 'microUSDC')} {tokenSymbol}</span>
              </div>
              {payoutUnavailable && (
                <p className="text-xs text-amber-700 dark:text-amber-300 pt-1">
                  The escrow&apos;s exact payout could not be read, so this is priced off the gross
                  amount. The real figure is slightly lower — the creator fee comes out of it.
                </p>
              )}
            </div>

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
