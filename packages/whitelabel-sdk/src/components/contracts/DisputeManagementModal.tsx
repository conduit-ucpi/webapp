import { apiFetch } from '@/lib/apiFetch';
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Contract, SubmitDisputeEntryRequest } from '@/types';
import { formatTimestamp, displayCurrency } from '@/utils/validation';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FarcasterNameDisplay from '@/components/ui/FarcasterNameDisplay';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { CASH_SETTLEMENT_CONFIRMED_REASON, isCashSettlementClaim } from '@/lib/cashSettlement';

/** What the dispute log shows when the tiebreaker steps down. A note, not a vote: no figure. */
export const ARBITER_RESIGNED_REASON = 'Resigned as tiebreaker';
import { useArbiterState, useSettlementState } from '@/hooks/useDisputeState';
import StandingFiguresPanel from '@/components/contracts/StandingFiguresPanel';
import ArbiterPanel from '@/components/contracts/ArbiterPanel';
import { useT } from '../../i18n';
import { explainTransactionFailure } from '@/lib/explainTransactionFailure';

interface DisputeManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onRefresh: () => void;
}

/**
 * Dispute settlement (MARKETPLACE_OPENSPEC §15.6b, §3.3A2a).
 *
 * ⚠️ THERE IS NO OFF-CHAIN AGREEMENT STAGE ANY MORE. Every figure a disputant names goes straight
 *    on-chain as `submitResolutionVote(X)` from their own wallet, and the contract is the only
 *    place agreement is detected: `_checkAndExecuteConsensus` runs at the end of every vote, so
 *    the instant any two of the three current votes match, the payout executes in that same
 *    transaction.
 *
 *    The superseded design had this component compare the two sides' figures itself and only
 *    then send a transaction. That mirrored the contract's own consensus rule off-chain, which
 *    can only agree with it or be wrong — and when it was wrong, users were shown "both parties
 *    agreed at 40%" while the chain held one vote, or none, and the money stayed locked.
 *
 * ⚠️ ORDER OF OPERATIONS, AND IT IS NOT INTERCHANGEABLE: name a figure → sign → the transaction
 *    succeeds → *only then* record it with contractservice. A declined signature or a reverted
 *    transaction means nothing happened on-chain, and contractservice's dispute record — a record
 *    of what happened, not of what was intended — must hold nothing suggesting otherwise.
 */
export default function DisputeManagementModal({ isOpen, onClose, contract, onRefresh }: DisputeManagementModalProps) {
  const t = useT();
  const { config } = useConfig();
  const { user } = useAuth();
  const { submitSettlementVote } = useMarketplaceActions();

  const [reason, setReason] = useState('');
  const [refundPercent, setRefundPercent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const settlement = useSettlementState(contract.contractAddress);
  const arbiter = useArbiterState(contract.contractAddress);

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const figure = Math.round(refundPercent);

  /** The figures held by everyone other than the connected wallet — what this submission could match. */
  const othersFigures = (() => {
    const state = settlement.data;
    if (!state) return [] as Array<{ role: string; percent: number }>;
    const me = user?.walletAddress?.toLowerCase();
    return [
      { role: 'the buyer', address: state.buyer, percent: state.buyerVote },
      { role: 'the recipient', address: state.recipient, percent: state.recipientVote },
      { role: 'the tiebreaker', address: state.arbiter, percent: state.arbiterVote }
    ]
      .filter((f) => f.percent !== null && f.address && f.address.toLowerCase() !== me)
      .map((f) => ({ role: f.role, percent: f.percent as number }));
  })();

  /**
   * Which side of this escrow the viewer is, for the arbiter panel.
   *
   * ⚠️ THE CHAIN READ WINS. A sale moves the recipient to the LP, and the local contract record
   *    only learns that when `OfferAccepted` reaches the index — so on exactly the escrows where
   *    the arbiter seat is empty, the record is the thing most likely to be stale. Falls back to
   *    it only when the settlement state has not loaded.
   *
   * `'arbiter'` when the connected wallet holds the seat (chain read first, record second): the
   * tiebreaker uses this same screen to read both sides, vote, and resign (§3.3A1c).
   *
   * Null for anyone who is neither party; the panel then names both sides rather than guessing.
   */
  const chainBuyer = settlement.data?.buyer ?? contract.buyerAddress ?? null;
  const chainRecipient = settlement.data?.recipient ?? contract.sellerAddress ?? null;
  const viewerRole: 'buyer' | 'recipient' | 'arbiter' | null = (() => {
    const me = user?.walletAddress?.toLowerCase();
    if (!me) return null;
    const buyer = chainBuyer?.toLowerCase();
    const recipient = chainRecipient?.toLowerCase();
    const seated = (settlement.data?.arbiter ?? arbiter.data?.arbiter ?? contract.arbiterAddress)?.toLowerCase();
    if (buyer === me) return 'buyer';
    if (recipient === me) return 'recipient';
    if (seated && seated === me) return 'arbiter';
    return null;
  })();
  const isArbiter = viewerRole === 'arbiter';

  /** The dispute log is the record all three voters read; a resignation belongs in it. */
  const recordResignation = async () => {
    if (!contract.id) return;
    const entry: SubmitDisputeEntryRequest = {
      timestamp: Math.floor(Date.now() / 1000),
      reason: ARBITER_RESIGNED_REASON,
      refundPercent: null
    };
    const response = await apiFetch(`/api/contracts/${contract.id}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!response.ok) throw new Error(`recording resignation failed: ${response.status}`);
  };

  /**
   * After any seat action, have contractservice re-read the seat from the chain. Its arbiter
   * /disputes listing is built from the seat it has recorded, so without this a resigned
   * tiebreaker keeps the escrow and a newly seated one cannot find it until the hourly sweep.
   * Never gates anything: the chain already holds the outcome.
   */
  const refreshSeatRecord = async () => {
    if (!contract.id) return;
    try {
      const response = await apiFetch(`/api/contracts/${contract.id}/arbiter-seat/refresh`, { method: 'POST' });
      if (!response.ok) console.error(`Arbiter seat refresh failed: ${response.status}`);
    } catch (e) {
      console.error('Arbiter seat refresh failed:', e);
    }
  };

  const wouldSettleWith = othersFigures.find((f) => f.percent === figure);
  const alreadySettled = settlement.data?.resolvedBuyerPercentage != null;

  const startSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOutcome(null);
    if (!reason.trim() || figure < 0 || figure > 100) return;
    // Every submission is confirmed, not only the ones we predict will match. Predicting is
    // exactly what this screen no longer does — the chain may hold a figure our last read missed.
    setConfirming(true);
  };

  const submitFigure = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (!contract.contractAddress) {
        throw new Error('This contract has not been deployed to the blockchain yet.');
      }

      // 1. The figure goes on-chain first. If this throws — a declined signature, a revert, an
      //    out-of-gas — nothing happened, and nothing is recorded anywhere.
      await submitSettlementVote(contract.contractAddress, figure);

      // 2. Only now record it with contractservice, alongside the reasoning. This is a record of
      //    the conversation; it decides nothing and gates nothing.
      const disputeEntry: SubmitDisputeEntryRequest = {
        timestamp: Math.floor(Date.now() / 1000),
        reason: reason.trim(),
        refundPercent: figure
      };

      const response = await apiFetch(`/api/contracts/${contract.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disputeEntry)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // The vote is on-chain regardless — this only loses the note attached to it.
        console.error('Vote landed on-chain but recording it failed:', errorData);
      }

      // 3. A successful send says the vote landed, NOT that it settled. A second matching vote
      //    pays out in that same transaction, so ask the chain what state the escrow is in now
      //    rather than inferring it from what we just sent — and report from that answer, not
      //    from the figures we read before signing.
      const [fresh] = await Promise.all([settlement.refetch(), arbiter.refetch()]);

      setConfirming(false);
      setReason('');
      setOutcome(
        fresh?.resolvedBuyerPercentage != null
          ? t('disputeManagementModal.settledAt', { percent: fresh.resolvedBuyerPercentage })
          : t('disputeManagementModal.figureStanding')
      );
      onRefresh();
    } catch (e: any) {
      console.error('Settlement vote failed:', e);
      setError(explainTransactionFailure(e, t) || e?.message || 'The transaction was not sent. Nothing has been recorded.');
      setConfirming(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedDisputes = contract.disputes ? [...contract.disputes].sort((a, b) => a.timestamp - b.timestamp) : [];

  /**
   * The buyer's "I settled in cash" shortcut, seen from the seller's side (lib/cashSettlement.ts).
   *
   * Shown only to the recipient, only while unsettled, and only when BOTH halves of the shortcut
   * are present: the buyer's 100% is standing on-chain (the half that pays out) and the record
   * carries the sentinel reason (the half that says why). A 100% vote with any other reason is an
   * ordinary dispute and gets the ordinary form.
   */
  const cashSettlementClaimed =
    viewerRole === 'recipient' &&
    !alreadySettled &&
    settlement.data?.buyerVote === 100 &&
    sortedDisputes.some((d) => isCashSettlementClaim(d.reason) && d.refundPercent === 100);

  /** One click to line up the matching figure; the ordinary confirmation step still follows. */
  const confirmCashSettlement = () => {
    setReason(CASH_SETTLEMENT_CONFIRMED_REASON);
    setRefundPercent(100);
    setError(null);
    setOutcome(null);
    setConfirming(true);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      {/* Headless UI Dialog portals to the document root, so the overlay always
          covers the viewport — fixes the previous bleed-through where the
          hand-rolled `fixed inset-0` div was anchored to a transformed
          dashboard ancestor instead of the viewport. */}
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl max-h-[90vh] overflow-y-auto transform rounded-lg bg-white dark:bg-secondary-800 text-left align-middle shadow-2xl border border-transparent dark:border-secondary-700 transition-all">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('disputeManagementModal.settleThisDispute')}</h2>
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-600 dark:text-secondary-400 dark:hover:text-secondary-200 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Contract Info */}
                  <div className="bg-gray-50 dark:bg-secondary-900/60 border border-transparent dark:border-secondary-700 rounded-lg p-4 mb-6">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('contractDetailsModal.contractDetails')}</h3>
                    <div className="text-sm text-gray-600 dark:text-secondary-300 space-y-1">
                      <div><span className="font-medium">{t('contractAcceptance.description')}</span> {contract.description}</div>
                      {contract.productName && (
                        <div><span className="font-medium">{t('disputeManagementModal.product')}</span> {contract.productName}</div>
                      )}
                      <div><span className="font-medium">{t('contractAcceptance.amount')}</span> {displayCurrency(contract.amount, 'microUSDC')} {tokenSymbol}</div>
                      <div><span className="font-medium">{t('contractCard.buyer')}</span> <FarcasterNameDisplay identifier={contract.buyerEmail} fallbackToAddress={true} walletAddress={contract.buyerAddress} /></div>
                      <div><span className="font-medium">{t('contractAcceptance.seller')}</span> <FarcasterNameDisplay identifier={contract.sellerEmail} fallbackToAddress={true} walletAddress={contract.sellerAddress} /></div>
                    </div>
                  </div>

                  {/* What is standing on-chain right now — the numbers that settle on match. */}
                  <div className="mb-6">
                    <StandingFiguresPanel
                      state={settlement.data}
                      loading={settlement.loading}
                      amount={contract.amount}
                      tokenSymbol={tokenSymbol}
                      walletAddress={user?.walletAddress}
                    />
                  </div>

                  {/* Arbiter seat — only renders when an action is actually available (§15.6c). */}
                  {contract.contractAddress && (
                    <div className="mb-6">
                      <ArbiterPanel
                        contractAddress={contract.contractAddress}
                        state={arbiter.data}
                        loading={arbiter.loading}
                        viewerRole={viewerRole}
                        buyerAddress={chainBuyer}
                        recipientAddress={chainRecipient}
                        onResigned={recordResignation}
                        onChanged={async () => {
                          await Promise.all([arbiter.refetch(), settlement.refetch(), refreshSeatRecord()]);
                          onRefresh();
                        }}
                      />
                    </div>
                  )}

                  {/* Dispute Audit Trail — the conversation, kept off-chain. */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">{t('disputeManagementModal.discussion')}</h3>
                    {sortedDisputes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-secondary-400">{t('disputeManagementModal.noDisputeEntriesYet')}</div>
                    ) : (
                      <div className="space-y-4">
                        {sortedDisputes.map((dispute, index) => (
                          <div key={index} className="border border-gray-200 dark:border-secondary-700 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm text-gray-900 dark:text-white">{dispute.userEmail}</span>
                                <span className="text-xs text-gray-500 dark:text-secondary-400">
                                  {formatTimestamp(dispute.timestamp).date} at {formatTimestamp(dispute.timestamp).time}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                {dispute.refundPercent !== null ? `submitted ${dispute.refundPercent}% to buyer` : 'No figure submitted'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-secondary-200">{dispute.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Admin Notes */}
                  {contract.adminNotes && contract.adminNotes.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">{t('disputeManagementModal.adminNotes')}</h3>
                      <div className="space-y-2">
                        {contract.adminNotes.map((note, index) => (
                          <div key={index} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-medium text-yellow-800 dark:text-yellow-300">{note.createdBy}</span>
                              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                {formatTimestamp(note.timestamp).date} at {formatTimestamp(note.timestamp).time}
                              </span>
                            </div>
                            <p className="text-sm text-yellow-700 dark:text-yellow-200">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* The buyer says they paid in cash: offer the matching 100% in one step. */}
                  {cashSettlementClaimed && (
                    <div className="mb-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                      <h3 className="font-medium text-green-900 dark:text-green-200 mb-1">{t('disputeManagementModal.cashClaimTitle')}</h3>
                      <p className="text-sm text-green-800 dark:text-green-300">{t('disputeManagementModal.cashClaimBody')}</p>
                      <div className="mt-3">
                        <Button
                          type="button"
                          onClick={confirmCashSettlement}
                          disabled={isSubmitting || confirming}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {t('disputeManagementModal.confirmCashSettlement')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Submit a settlement figure */}
                  {!alreadySettled && (
                    <div className="border-t border-gray-200 dark:border-secondary-700 pt-6">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                        {isArbiter ? t('disputeManagementModal.castYourVote') : t('disputeManagementModal.submitYourSettlementFigure')}
                      </h3>
                      {isArbiter && (
                        <p className="text-sm text-gray-600 dark:text-secondary-300 mb-3">{t('disputeManagementModal.arbiterVoteNote')}</p>
                      )}

                      {/*
                        ⚠️ THE SINGLE MOST IMPORTANT THING ON THIS SCREEN (§15.6b). The contract
                        stores one value per party and settles the instant any two of the three
                        match. It cannot tell "I propose 40%" from "I accept 40%", because on-chain
                        they are the same transaction.
                      */}
                      <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 mb-4 text-sm text-amber-800 dark:text-amber-200">
                        <strong>{t('disputeManagementModal.whateverYouSubmitIs')}</strong> It
                        goes on-chain immediately. If it matches a figure another party is already
                        holding, the escrow pays out at that number in the same transaction, and it
                        cannot be undone.
                        <div className="mt-2">{t('disputeManagementModal.youCanReviseYour')}</div>
                      </div>

                      <form onSubmit={startSubmission} className="space-y-4">
                        <div>
                          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-secondary-200 mb-1">{t('disputeManagementModal.yourCommentMaxCharacters')}</label>
                          <p id="reason-privacy" className="text-xs text-gray-600 dark:text-secondary-300 mb-1">{t('dispute.noPersonalDetails')}</p>
                          <textarea
                            id="reason"
                            aria-describedby="reason-privacy"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={160}
                            required
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-secondary-500 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder={t('disputeManagementModal.explainYourPositionIn')}
                          />
                          <div className="text-xs text-gray-500 dark:text-secondary-400 mt-1">
                            {reason.length}/160 characters — kept off-chain, alongside the figure
                          </div>
                        </div>

                        <div>
                          <label htmlFor="refundPercent" className="block text-sm font-medium text-gray-700 dark:text-secondary-200 mb-1">{t('disputeManagementModal.settlementFigurePercentageTo')}</label>
                          <div className="flex items-center space-x-4">
                            <input
                              type="range"
                              id="refundPercent"
                              min="0"
                              max="100"
                              step="1"
                              value={refundPercent}
                              onChange={(e) => setRefundPercent(parseInt(e.target.value))}
                              className="flex-1"
                            />
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={refundPercent}
                                onChange={(e) => setRefundPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-gray-900 dark:text-white rounded text-center text-sm"
                              />
                              <span className="text-sm text-gray-600 dark:text-secondary-300">%</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-secondary-400 mt-1">
                            Buyer gets: {displayCurrency((contract.amount * figure) / 100, 'microUSDC')} {tokenSymbol},
                            Seller gets: {displayCurrency((contract.amount * (100 - figure)) / 100, 'microUSDC')} {tokenSymbol}
                          </div>

                          {/* Match is exact: two different percentages are two standing offers. */}
                          {wouldSettleWith && (
                            <div className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                              This matches the figure {wouldSettleWith.role} is holding — submitting
                              it settles the dispute and pays out immediately.
                            </div>
                          )}
                        </div>

                        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                        {outcome && <p className="text-sm text-green-700 dark:text-green-300">{outcome}</p>}

                        <div className="flex justify-end space-x-3">
                          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>{t('contractDetailsModal.close')}</Button>
                          <Button
                            type="submit"
                            disabled={isSubmitting || confirming || !reason.trim()}
                            className="bg-primary-600 hover:bg-primary-700"
                          >
                            Submit {figure}% to buyer
                          </Button>
                        </div>
                      </form>

                      {/* Confirmation. Shown for every submission, not only the ones we expect to match. */}
                      {confirming && (
                        <div className="mt-4 rounded-lg border border-gray-300 dark:border-secondary-600 bg-gray-50 dark:bg-secondary-900/60 p-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            Send {figure}% to the buyer on-chain?
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-secondary-200">
                            {wouldSettleWith ? (
                              <>
                                <strong>{t('disputeManagementModal.thisSettlesTheDispute')}</strong> {wouldSettleWith.role} is
                                already holding {figure}%, so the escrow pays out{' '}
                                {displayCurrency((contract.amount * figure) / 100, 'microUSDC')} {tokenSymbol} to
                                the buyer and the remainder to the seller, in this transaction.
                              </>
                            ) : (
                              <>
                                No one is currently holding {figure}%, so this will stand as your
                                binding offer. Anyone who submits the same number settles the dispute
                                at it.
                              </>
                            )}
                          </p>
                          <div className="flex justify-end space-x-3 mt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setConfirming(false)}
                              disabled={isSubmitting}
                            >{t('disputeManagementModal.cancel')}</Button>
                            <Button type="button" onClick={submitFigure} disabled={isSubmitting}>
                              {isSubmitting ? (
                                <>
                                  <LoadingSpinner className="w-4 h-4 mr-2" />{t('disputeManagementModal.sending')}</>
                              ) : (
                                t('disputeManagementModal.confirmAndSign')
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
