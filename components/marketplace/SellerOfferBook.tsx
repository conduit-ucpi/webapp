import { useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useOfferBook, useRefreshFromChain } from '@/hooks/useMarketplaceData';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { displayCurrency } from '@/utils/currency';
import { acceptableOffers, hoursUntil, reconciledLabel } from '@/utils/marketplace';
import { AcceptFlowNotice, NetProceedsBreakdown } from '@/components/marketplace/OfferDisclosures';
import OfferDetailsModal from '@/components/marketplace/OfferDetailsModal';
import type { OfferView } from '@/types/marketplace';

interface SellerOfferBookProps {
  escrowContract: string;
  /** What the escrow would pay at maturity, for the "instead of waiting" comparison. */
  maturityAmount?: number;
  /**
   * The escrow's gross amount. Only the detail view needs it — to show the platform fee as the
   * difference between it and the payout, rather than asserting a fee rate the escrow may not
   * have been created under.
   */
  nominalAmount?: number;
  maturity?: number;
  onAccepted?: () => Promise<void> | void;
}

/**
 * The offers standing on one escrow, from the seller's side (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ THE HEADLINE FIGURE IS THE SELLER'S NET, NOT THE OFFER (§8.5a, §13.10). The platform fee and
 *    any residual come out of the LP's deposit before the seller sees it, so a seller shown
 *    "10,000" who receives 8,900 reads it as theft. Fee and holdback are separate fields on
 *    `OfferCreated` precisely so offers can be compared on both — a smaller offer with no residual
 *    can be the better one.
 *
 * ⚠️ PENDING VAULTS ARE NOT OFFERS and never appear here (§5.0): the vault exists but the LP has
 *    not funded it, so showing it would advertise an offer nobody has committed to.
 */
export default function SellerOfferBook({
  escrowContract,
  maturityAmount,
  nominalAmount,
  maturity,
  onAccepted
}: SellerOfferBookProps) {
  const { config } = useConfig();
  const { data, loading, error, refetch } = useOfferBook(escrowContract);
  const { refresh, refreshing } = useRefreshFromChain(refetch);
  const { approveRecipientTransfer, acceptOffer, rejectOffer } = useMarketplaceActions();

  const [busyVault, setBusyVault] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OfferView | null>(null);
  const [viewing, setViewing] = useState<OfferView | null>(null);

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const offers = acceptableOffers(data?.offers ?? []);

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
      await acceptOffer(offer.vaultAddress);

      setConfirming(null);
      setViewing(null);

      /*
       * ⚠️ RECONCILE, DON'T REFETCH. The book is contractservice's index, and `OfferAccepted`
       *    has to travel chain → chainservice → contractservice before that index stops
       *    calling this offer OPEN. A bare refetch re-reads a record that does not know about
       *    the acceptance yet, so the offer comes back acceptable and the seller presses it
       *    again — the second swap reverts, because the escrow has already changed hands, but
       *    they have signed two more transactions to learn that.
       *
       *    `refresh` makes contractservice read the chain for this seller's escrows and ingest
       *    what it finds, and only returns once that has happened — so the refetch it triggers
       *    afterwards sees the acceptance. `acceptableOffers` then drops the offer for the
       *    right reason: the index says ACCEPTED, not because the UI is hiding it.
       *
       *    It closes the losing offers in the same pass, which matters just as much: accepting
       *    one sells the cashflow, so every other offer standing on it is dead in that moment.
       */
      // A failed reconcile calls no refetch of its own, so the book would otherwise sit
      // un-re-read on exactly the path where it is most stale. Falling back keeps the screen
      // honest: still showing the offer means the index genuinely has not caught up yet.
      if (!(await refresh())) await refetch();
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
      await rejectOffer(offer.vaultAddress);
      setViewing(null);

      /*
       * Same staleness as accepting, and for the same reason: `reject()` goes from the
       * seller's own wallet — the contract requires it — so chainservice never sees the
       * transaction and `OfferRejected` reaches the index only when someone reconciles. A bare
       * refetch brings the offer back OPEN, and the seller is looking at a bid they have
       * already killed.
       *
       * It matters on the LP's side too: a rejection is what makes their capital withdrawable
       * (§6.4), and nothing on-chain announces that. Until the rejection is indexed there is
       * nothing to tell them from, so the money simply sits in the vault.
       */
      if (!(await refresh())) await refetch();
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
                      {displayCurrency(offer.netAmount ?? 0, 'microUSDC')} {tokenSymbol}
                    </span>{' '}
                    today
                  </div>
                  {givenUp !== null && givenUp > 0 && (
                    <div className="text-sm text-gray-600 dark:text-secondary-300 mt-1">
                      Instead of waiting {maturity ? `until ${new Date(maturity * 1000).toLocaleDateString()}` : 'until maturity'} for{' '}
                      {displayCurrency(maturityAmount!, 'microUSDC')} {tokenSymbol} — you give up{' '}
                      {displayCurrency(givenUp, 'microUSDC')} {tokenSymbol}
                    </div>
                  )}
                  {offer.offerExpiry && (
                    <div className="text-xs text-gray-500 dark:text-secondary-400 mt-1">
                      Offer lapses in {hoursUntil(offer.offerExpiry)}h
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setViewing(offer)} disabled={isBusy}>
                    View details
                  </Button>
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

      {/* One modal for whichever offer is being looked at, rather than one per row. */}
      {viewing && (
        <OfferDetailsModal
          isOpen
          onClose={() => setViewing(null)}
          offer={viewing}
          nominalAmount={nominalAmount}
          payoutAmount={maturityAmount}
          maturity={maturity}
          tokenSymbol={tokenSymbol}
          busy={busyVault === viewing.vaultAddress}
          stage={busyVault === viewing.vaultAddress ? stage : null}
          onAccept={() => accept(viewing)}
          onDecline={() => decline(viewing)}
        />
      )}
    </div>
  );
}
