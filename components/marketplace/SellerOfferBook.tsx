import { useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useOfferBook, useRefreshFromChain } from '@/hooks/useMarketplaceData';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { displayCurrencyPrecise } from '@/utils/currency';
import { acceptableOffers, hoursUntil, reconciledLabel } from '@/utils/marketplace';
import { AcceptFlowNotice, NetProceedsBreakdown } from '@/components/marketplace/OfferDisclosures';
import type { OfferView } from '@/types/marketplace';

interface SellerOfferBookProps {
  escrowContract: string;
  /** What the escrow would pay at maturity, for the "instead of waiting" comparison. */
  maturityAmount?: number;
  maturity?: number;
  onAccepted?: () => Promise<void> | void;
  /**
   * The offers chainservice reports as standing, supplied by the page.
   *
   * ⚠️ THREE STATES, AND THEY MEAN DIFFERENT THINGS. `undefined` — not answered yet, so fall
   *    back to the index. `null` — chainservice could not read this escrow, which is UNKNOWN
   *    and again a reason to fall back, never a reason to say "no offers". An empty array is
   *    the only one that means nobody is bidding.
   *
   * Preferred over the index when present because it is the fresher answer: chainservice
   * created these vaults and relayed their funding, so it knows them without waiting for a
   * reconcile to carry the events into contractservice.
   */
  liveOffers?: OfferView[] | null;
  /**
   * Re-read the live offers after this seller has changed them.
   *
   * ⚠️ WITHOUT THIS THE BOOK REDRAWS THE OFFER IT JUST DISPOSED OF. Accept and reject go from
   *    the seller's own wallet, so the index cannot know they happened until something
   *    reconciles. chainservice is TOLD instead (see useMarketplaceActions), which makes the
   *    correction a re-read rather than a block scan.
   */
  onOffersChanged?: () => Promise<void> | void;
}

/**
 * The offers standing on one escrow, from the seller's side (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ THE HEADLINE FIGURE IS THE SELLER'S NET, NOT THE OFFER (§8.5a, §13.10). The platform fee and
 *    any reserve come out of the LP's deposit before the seller sees it, so a seller shown
 *    "10,000" who receives 8,900 reads it as theft. Fee and holdback are separate fields on
 *    `OfferCreated` precisely so offers can be compared on both — a smaller offer with no reserve
 *    can be the better one.
 *
 * ⚠️ PENDING VAULTS ARE NOT OFFERS and never appear here (§5.0): the vault exists but the LP has
 *    not funded it, so showing it would advertise an offer nobody has committed to.
 */
export default function SellerOfferBook({
  escrowContract,
  maturityAmount,
  maturity,
  onAccepted,
  liveOffers,
  onOffersChanged
}: SellerOfferBookProps) {
  const { config } = useConfig();
  const { data, loading, error, refetch } = useOfferBook(escrowContract);
  const { refresh, refreshing } = useRefreshFromChain(refetch);
  const { approveRecipientTransfer, acceptOffer, rejectOffer } = useMarketplaceActions();

  const [busyVault, setBusyVault] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OfferView | null>(null);

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  // `acceptableOffers` is applied either way: chainservice returns what was live when it
  // looked, and a short-lived offer can lapse between that read and this render.
  const offers = acceptableOffers(liveOffers ?? data?.offers ?? []);

  /**
   * The accept flow: two transactions with a five-minute fuse (§3.2, §15.2).
   *
   * The operator being approved is **this offer's own vault**, not a global venue address, and
   * the destination is bound at grant time — so even a compromised operator could only execute
   * the exact move the seller sanctioned. If the window lapses between the two signatures, the
   * approval is inert and nothing is at risk: re-prompt rather than treating it as a failure.
   */
  const accept = async (offer: OfferView) => {
    if (!offer.lp) {
      setActionError('This offer has no LP recorded, so the transfer target cannot be set.');
      return;
    }
    setBusyVault(offer.vaultAddress);
    setActionError(null);
    try {
      setStage('Authorising the swap…');
      await approveRecipientTransfer(escrowContract, offer.vaultAddress, offer.lp);

      setStage('Completing the swap…');
      await acceptOffer(offer.vaultAddress, escrowContract);

      setConfirming(null);
      /*
       * ⚠️ RE-READ BEFORE REDRAWING. Both signatures above came from the SELLER'S OWN WALLET
       *    (§15.6b), so the index cannot know about them — refetching it alone would put the
       *    offer just accepted straight back on screen, with an Accept button that would now
       *    revert. `acceptOffer` has already told chainservice, so asking it again is enough;
       *    this used to require a reconcile, and a reconcile is a block scan.
       */
      await onOffersChanged?.();
      await refetch();
      await onAccepted?.();
    } catch (e: any) {
      setActionError(
        e?.message ||
          'The swap did not complete. If the five-minute authorisation lapsed, simply start again — nothing is at risk.'
      );
    } finally {
      setBusyVault(null);
      setStage(null);
    }
  };

  const decline = async (offer: OfferView) => {
    setBusyVault(offer.vaultAddress);
    setActionError(null);
    try {
      await rejectOffer(offer.vaultAddress, escrowContract);
      // Sent by the seller's wallet, so chainservice was told rather than having seen it —
      // see accept() above.
      await onOffersChanged?.();
      await refetch();
    } catch (e: any) {
      setActionError(e?.message || 'Declining did not go through.');
    } finally {
      setBusyVault(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-secondary-400">
          {/* "No offers" and "no offers as of an hour ago" are different answers. */}
          {reconciledLabel(data?.lastReconciledAt)}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={() => refresh()} disabled={refreshing}>
          {refreshing ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>

      {(error || actionError) && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {actionError || error}
        </div>
      )}

      {offers.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-secondary-400 py-2">
          No offers on this payment yet.
        </p>
      ) : (
        offers.map((offer) => {
          const net = Number(offer.netAmount || 0);
          const givenUp = maturityAmount ? maturityAmount - net : null;
          const isBusy = busyVault === offer.vaultAddress;

          return (
            <div
              key={offer.vaultAddress}
              className="rounded-lg border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {/* The net is the headline. Everything else is the explanation of it. */}
                  <div className="text-base font-medium text-gray-900 dark:text-white">
                    Get{' '}
                    <span className="text-primary-600 dark:text-primary-400">
                      {displayCurrencyPrecise(offer.netAmount ?? 0, 'microUSDC')} {tokenSymbol}
                    </span>{' '}
                    today
                  </div>
                  {givenUp !== null && givenUp > 0 && (
                    <div className="text-sm text-gray-600 dark:text-secondary-300 mt-1">
                      Instead of waiting {maturity ? `until ${new Date(maturity * 1000).toLocaleDateString()}` : 'until maturity'} for{' '}
                      {displayCurrencyPrecise(maturityAmount!, 'microUSDC')} {tokenSymbol} — you give up{' '}
                      {displayCurrencyPrecise(givenUp, 'microUSDC')} {tokenSymbol}
                    </div>
                  )}
                  {offer.offerExpiry && (
                    <div className="text-xs text-gray-500 dark:text-secondary-400 mt-1">
                      Offer lapses in {hoursUntil(offer.offerExpiry)}h
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button type="button" size="sm" variant="outline" onClick={() => decline(offer)} disabled={isBusy}>
                    Decline
                  </Button>
                  <Button type="button" size="sm" onClick={() => setConfirming(offer)} disabled={isBusy}>
                    {isBusy ? <LoadingSpinner className="w-4 h-4" /> : 'Accept'}
                  </Button>
                </div>
              </div>

              {confirming?.vaultAddress === offer.vaultAddress && (
                <div className="mt-4 border-t border-gray-200 dark:border-secondary-700 pt-4 space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">Accept this offer?</h4>

                  <NetProceedsBreakdown
                    offerAmount={offer.offerAmount}
                    fee={offer.fee}
                    holdback={offer.holdback}
                    netAmount={offer.netAmount}
                    tokenSymbol={tokenSymbol}
                  />

                  <p className="text-sm text-gray-700 dark:text-secondary-200">
                    Accepting hands this payment to the buyer of your cashflow and pays you now. It
                    happens in one on-chain swap and cannot be undone.
                  </p>

                  <AcceptFlowNotice />

                  {stage && (
                    <p className="text-sm text-gray-600 dark:text-secondary-300">
                      <LoadingSpinner className="w-4 h-4 mr-2 inline" />
                      {stage}
                    </p>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(null)} disabled={isBusy}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={() => accept(offer)} disabled={isBusy}>
                      Confirm — get paid now
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
