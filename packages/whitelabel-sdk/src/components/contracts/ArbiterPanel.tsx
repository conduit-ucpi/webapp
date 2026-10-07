import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { formatTimestamp } from '@/utils/validation';
import type { ArbiterState } from '@/types/marketplace';
import { useT } from '../../i18n';

// Fast feedback only; userservice decides what an email is.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What the email in the field names, looked up as the party types (never creating a wallet). */
type EmailPreview =
  | { email: string; status: 'looking' }
  | { email: string; status: 'found'; wallet: string }
  | { email: string; status: 'new' }
  | { email: string; status: 'error'; message: string };

interface ArbiterPanelProps {
  contractAddress: string;
  state: ArbiterState | null;
  loading: boolean;
  onChanged: () => Promise<void> | void;
  /**
   * Which side of this escrow is looking, so the panel can say whose nomination is whose.
   *
   * ⚠️ A SALE MOVES THE RECIPIENT, so this cannot be derived from the contract record alone —
   *    after a sale the recipient is the LP, and the local record only learns that when
   *    `OfferAccepted` reaches the index. The caller resolves it against the chain read.
   *
   * Null for anyone who is neither party, and for a viewer we could not place. The panel then
   * falls back to naming both sides explicitly rather than guessing which one is "theirs".
   *
   * `'arbiter'` is the seated tiebreaker looking at their own seat: no nominating (the contract
   * refuses a non-party), no evicting, and a resign control instead (§3.3A1c).
   */
  viewerRole?: 'buyer' | 'recipient' | 'arbiter' | null;
  /**
   * Called after a resignation lands on-chain, before the state is re-read: the caller records
   * it with contractservice so the parties see it in the dispute log. A failure here never
   * undoes what is on-chain.
   */
  onResigned?: () => Promise<void> | void;
}

/**
 * The arbiter seat (MARKETPLACE_OPENSPEC §15.6c, §3.3).
 *
 * Two things happen here. A marketplace sale empties the seat: `transferRecipientFrom` unseats the
 * incumbent in the same transaction as the sale — automatically, not on objection — because in the
 * §8.1a attack the seller *is* the adversary and would otherwise bundle the sale, a dispute and a
 * pre-loaded arbiter's vote into one block. Every path back to a seat then runs through the new
 * recipient. And on ANY live escrow, sold or not, buyer and recipient may jointly replace whoever
 * holds the seat by naming the same address (§3.3A1b) — the platform's default included. That is
 * how a party who does not want the default tiebreaker deciding their case leaves it, with the
 * other party's consent.
 *
 * ⚠️ DRIVEN ENTIRELY OFF THE `can*` FLAGS. Show a control when its flag is true; that is the whole
 *    rule. A legacy escrow returns every flag false, so no legacy-specific UI is needed and none
 *    should be written — legacy escrows cannot reach these states at all, since the marketplace
 *    only accepts clones matching the new codehash.
 */
export default function ArbiterPanel({
  contractAddress,
  state,
  loading,
  onChanged,
  viewerRole = null,
  onResigned
}: ArbiterPanelProps) {
  const t = useT();
  const { nominateArbiter, resolveArbiterEmail, evictArbiter, resignArbiter, seatDefaultArbiter } = useMarketplaceActions();
  const [candidate, setCandidate] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const isArbiter = viewerRole === 'arbiter';

  /*
   * The live lookup. The other party's choice is only ever shown as a wallet, so a party who was
   * told "it's mediator@example.com" needs to see which wallet that email is before agreeing.
   * Debounced, stale answers dropped, and create: false — a half-typed address must never get a
   * wallet made for it. The wallet is only made on Nominate.
   */
  useEffect(() => {
    if (!EMAIL.test(candidate)) {
      setPreview(null);
      return;
    }
    setPreview({ email: candidate, status: 'looking' });
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const wallet = await resolveArbiterEmail(candidate, { create: false });
        if (current) setPreview(wallet ? { email: candidate, status: 'found', wallet } : { email: candidate, status: 'new' });
      } catch (e: any) {
        if (current) setPreview({ email: candidate, status: 'error', message: e?.message || t('arbiterPanel.lookupFailed') });
      }
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, resolveArbiterEmail]);

  if (loading && !state) {
    return <div className="text-sm text-gray-500 dark:text-secondary-400">{t('arbiterPanel.readingTheArbiterSeat')}</div>;
  }

  // Nothing to offer: either not a marketplace-capable escrow, or no action is currently live.
  // The seated arbiter always has one action - resigning - so their view never collapses.
  if (!state || (!isArbiter && !state.canNominate && !state.canSeatDefaultArbiter && !state.canEvictArbiter && state.seated)) {
    return state?.seated ? (
      <div className="text-sm text-gray-600 dark:text-secondary-300">
        Tiebreaker seated: <span className="font-mono text-xs">{state.arbiter}</span>
      </div>
    ) : null;
  }

  /** `success` may be worked out from what the action returned, e.g. the wallet an email named. */
  const run = async <T,>(label: string, action: () => Promise<T>, success: string | ((result: T) => string)) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      setNotice(typeof success === 'function' ? success(result) : success);
      await onChanged();
    } catch (e: any) {
      // A nomination racing a seat-default is an ordinary race, not a fault: a late match still
      // wins right up until the fallback transaction actually executes.
      setError(e?.message || t('arbiterPanel.actionFailed', { action: label }));
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  // A tiebreaker may be named by email: a wallet is made for it if need be on Nominate, and the
  // wallet is what goes on chain.
  const candidateIsEmail = EMAIL.test(candidate);
  const candidateIsValid = ethers.isAddress(candidate) || candidateIsEmail;
  const shownPreview = preview && preview.email === candidate ? preview : null;

  /*
   * ⚠️ WHOSE NOMINATION IS WHOSE. This used to be `nominatedByBuyer || nominatedByRecipient`,
   *    which is not the other party — it is "the buyer's, else the recipient's", whoever is
   *    looking. For a BUYER who had already nominated it returned their OWN choice, and the
   *    match test below then told them "that arbiter is now seated" when re-nominating their
   *    own candidate had seated nobody. A false claim about who can decide their dispute.
   *
   * Null role means we could not place the viewer, so neither nomination may be called theirs.
   */
  const mine =
    viewerRole === 'buyer' ? state.nominatedByBuyer
      : viewerRole === 'recipient' ? state.nominatedByRecipient
        : null;
  const theirs =
    viewerRole === 'buyer' ? state.nominatedByRecipient
      : viewerRole === 'recipient' ? state.nominatedByBuyer
        : null;
  const unplaced = viewerRole === null && (state.nominatedByBuyer || state.nominatedByRecipient);

  // The wallet the field names, as far as we know yet, and whether it is the other party's pick.
  const candidateWallet = candidateIsEmail
    ? (shownPreview?.status === 'found' ? shownPreview.wallet : null)
    : (ethers.isAddress(candidate) ? candidate : null);
  const matchesTheirs = !!theirs && !!candidateWallet && candidateWallet.toLowerCase() === theirs.toLowerCase();

  return (
    <div className="rounded-lg border border-gray-200 dark:border-secondary-700 p-4 space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white">{t('arbiterPanel.arbiterSeat')}</h4>
        <p className="text-sm text-gray-600 dark:text-secondary-300 mt-1">
          {state.seated ? (
            <>
              {t('arbiterPanel.seated')} <span className="font-mono text-xs">{state.arbiter}</span>
              {state.canNominate && (
                <span className="block mt-1">{t('arbiterPanel.seatedReplaceable')}</span>
              )}
            </>
          ) : (
            <>
              {t('arbiterPanel.seatEmpty')}
            </>
          )}
        </p>
      </div>

      {/* The arbiter's own seat: step down (§3.3A1c). Two clicks, because it clears the seat
          and drops their standing vote the moment it lands. */}
      {isArbiter && state.seated && (
        <div className="rounded-md border border-gray-200 dark:border-secondary-700 p-3 space-y-2">
          <p className="text-sm text-gray-700 dark:text-secondary-200">{t('arbiterPanel.youHoldTheSeat')}</p>
          <p className="text-xs text-gray-500 dark:text-secondary-400">{t('arbiterPanel.resignExplainer')}</p>
          {!confirmingResign ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => setConfirmingResign(true)}
            >
              {t('arbiterPanel.resign')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => setConfirmingResign(false)}
              >
                {t('disputeManagementModal.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  run(
                    'Resignation',
                    async () => {
                      await resignArbiter(contractAddress);
                      setConfirmingResign(false);
                      // On-chain first, record second - and the record never gates anything.
                      try {
                        await onResigned?.();
                      } catch (e) {
                        console.error('Resignation is on-chain but recording it failed:', e);
                      }
                    },
                    t('arbiterPanel.resigned')
                  )
                }
              >
                {busy === 'Resignation' ? <LoadingSpinner className="w-4 h-4" /> : t('arbiterPanel.resignConfirm')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Nominate — matching names seat that candidate instantly, in the nominating transaction,
          replacing the incumbent if the seat is occupied (§3.3A1b). Parties only: the contract
          refuses a nomination from the arbiter. */}
      {state.canNominate && !isArbiter && (
        <div className="space-y-2">
          <label htmlFor="arbiter-candidate" className="block text-sm font-medium text-gray-700 dark:text-secondary-200">{t('arbiterPanel.nominateAnArbiter')}</label>

          {/*
            ⚠️ SAFETY-CRITICAL, AND THE ONLY PROTECTION THERE IS (§15.1, §3.3B). The arbiter
            registry was dropped, so nothing on-chain validates a candidate beyond "not a party to
            this escrow". Social-engineering resistance is a UI guarantee now, not a contract one:
            if this warning is omitted, nothing else catches it.
          */}
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            <strong>{t('arbiterPanel.namingTheSameAddress')}</strong>{' '}
            {t('arbiterPanel.nominationWarningBody')}
            <div className="mt-2">
              {t('arbiterPanel.decliningIsSafe')}
            </div>
          </div>

          {/*
            What each side has put forward. Naming the same address is the whole mechanism, so
            not showing the other party's choice left the two of them to agree an address
            somewhere else entirely and type it in twice.
          */}
          {theirs && (
            <div className="rounded-md border border-gray-200 dark:border-secondary-700 p-3 text-sm space-y-2">
              <div className="text-gray-700 dark:text-secondary-200">
                {t('arbiterPanel.theyNominated')}{' '}
                <span className="font-mono text-xs break-all">{theirs}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-secondary-400">
                {t('arbiterPanel.matchSeatsThem')}
              </p>
              <p className="text-xs text-gray-500 dark:text-secondary-400">
                {t('arbiterPanel.theirsByEmailHint')}
              </p>
              {/*
                ⚠️ FILLS THE FIELD, DOES NOT NOMINATE. One click straight to a seating is the
                   exact shape of the attack the warning above describes — the other party
                   names their own confederate and this button agrees to it. Prefilling keeps
                   the address in front of the user, and keeps the deliberate press on the
                   Nominate button where it already was.
              */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => setCandidate(theirs)}
              >
                {t('arbiterPanel.useThisAddress')}
              </Button>
            </div>
          )}

          {mine && (
            <div className="text-sm text-gray-600 dark:text-secondary-300">
              {t('arbiterPanel.youNominated')}{' '}
              <span className="font-mono text-xs break-all">{mine}</span>
              {!theirs && (
                <span className="block text-xs text-gray-500 dark:text-secondary-400 mt-0.5">
                  {t('arbiterPanel.waitingOnThem')}
                </span>
              )}
            </div>
          )}

          {/* Viewer not placed on either side: name both rather than imply one is theirs. */}
          {unplaced && (
            <div className="text-sm text-gray-700 dark:text-secondary-200">
              {t('arbiterPanel.alreadyNominated')}{' '}
              {state.nominatedByBuyer && (
                <>buyer: <span className="font-mono text-xs">{state.nominatedByBuyer}</span>{' '}</>
              )}
              {state.nominatedByRecipient && (
                <>recipient: <span className="font-mono text-xs">{state.nominatedByRecipient}</span></>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="arbiter-candidate"
              value={candidate}
              onChange={(e) => setCandidate(e.target.value.trim())}
              placeholder={t('arbiterPanel.candidatePlaceholder')}
              className="flex-1 px-3 py-2 font-mono text-sm border border-gray-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-gray-900 dark:text-white rounded-md"
            />
            <Button
              type="button"
              disabled={!candidateIsValid || busy !== null}
              onClick={() =>
                run(
                  'Nomination',
                  async () => {
                    const wallet = candidateIsEmail ? await resolveArbiterEmail(candidate, { create: true }) : candidate;
                    if (!wallet) throw new Error(t('arbiterPanel.lookupFailed'));
                    await nominateArbiter(contractAddress, wallet);
                    return wallet;
                  },
                  // Only `theirs` can produce a match. Claiming one against our own standing
                  // nomination announces a seating that did not happen.
                  (wallet) =>
                    theirs && wallet.toLowerCase() === theirs.toLowerCase()
                      ? 'Nominations matched — that tiebreaker is now seated.'
                      : candidateIsEmail
                        ? `Nomination recorded for ${candidate} (wallet ${wallet}). It seats them the moment the other party names the same email or address.`
                        : 'Nomination recorded. It seats them the moment the other party names the same address.'
                )
              }
            >
              {busy === 'Nomination' ? <LoadingSpinner className="w-4 h-4" /> : 'Nominate'}
            </Button>
          </div>

          {/* Who the email in the field is, live, and whether that is who the other party named. */}
          {shownPreview && (
            <div aria-live="polite" className="rounded-md bg-gray-50 dark:bg-secondary-800 p-3 text-sm space-y-1">
              {shownPreview.status === 'looking' && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-secondary-300">
                  <LoadingSpinner className="w-3 h-3" /> {t('arbiterPanel.lookingUp', { email: shownPreview.email })}
                </div>
              )}
              {shownPreview.status === 'found' && (
                <div className="text-gray-700 dark:text-secondary-200">
                  {t('arbiterPanel.emailHasWallet', { email: shownPreview.email })}{' '}
                  <span className="font-mono text-xs break-all">{shownPreview.wallet}</span>
                </div>
              )}
              {shownPreview.status === 'new' && (
                <div className="text-gray-700 dark:text-secondary-200">{t('arbiterPanel.emailIsNew', { email: shownPreview.email })}</div>
              )}
              {shownPreview.status === 'error' && (
                <div className="text-red-600 dark:text-red-400">{shownPreview.message}</div>
              )}
            </div>
          )}

          {/* Against the other party's pick: the one comparison that decides whether Nominate seats someone. */}
          {theirs && candidateIsValid && (matchesTheirs ? (
            <p className="text-sm font-medium text-green-700 dark:text-green-400">✓ {t('arbiterPanel.sameAsTheirs')}</p>
          ) : (candidateWallet || shownPreview?.status === 'new') && (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('arbiterPanel.notTheirs')}</p>
          ))}

          <p className="text-xs text-gray-500 dark:text-secondary-400">{t('arbiterPanel.emailNomineeHint')}</p>

          {candidate && !candidateIsValid && (
            <p className="text-xs text-red-600 dark:text-red-400">{t('arbiterPanel.thatIsNotA')}</p>
          )}
        </div>
      )}

      {/* The fallback. Permissionless on-chain, so the platform fires it — it can only seat the Safe. */}
      {state.canSeatDefaultArbiter && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-secondary-200">
            The 72-hour nomination window has passed without agreement. Anyone may now seat the
            platform&apos;s default tiebreaker — a multisig that acts only as a third voter.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              run(
                'Seating',
                async () => {
                  const result = await seatDefaultArbiter(contractAddress);
                  if (!result.success) throw new Error(result.error || 'Seating failed');
                },
                'The default tiebreaker is seated and can now vote.'
              )
            }
          >
            {busy === 'Seating' ? <LoadingSpinner className="w-4 h-4" /> : 'Seat the default tiebreaker'}
          </Button>
        </div>
      )}

      {/* Eviction — the remedy for a seated-but-silent arbiter. It swaps a voter; it moves no funds. */}
      {state.canEvictArbiter && !isArbiter && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-secondary-200">
            This tiebreaker has been silent for 30 days
            {state.lastArbiterActionAt
              ? ` (last active ${formatTimestamp(state.lastArbiterActionAt).date})`
              : ''}
            . You can clear the seat and reopen nominations. This moves no funds and settles
            nothing — it only replaces the third voter.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              run(
                'Eviction',
                () => evictArbiter(contractAddress),
                'The seat is clear and nominations have reopened.'
              )
            }
          >
            {busy === 'Eviction' ? <LoadingSpinner className="w-4 h-4" /> : 'Request a new tiebreaker'}
          </Button>
        </div>
      )}

      {!state.seated && state.nominationDeadline && !state.canSeatDefaultArbiter && (
        <p className="text-xs text-gray-500 dark:text-secondary-400">
          If no one agrees, the default tiebreaker becomes seatable after{' '}
          {formatTimestamp(state.nominationDeadline).date} at{' '}
          {formatTimestamp(state.nominationDeadline).time}.
        </p>
      )}

      {notice && <p className="text-sm text-green-700 dark:text-green-300">{notice}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
