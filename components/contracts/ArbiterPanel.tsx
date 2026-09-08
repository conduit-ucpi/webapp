import { useState } from 'react';
import { ethers } from 'ethers';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { formatTimestamp } from '@/utils/validation';
import type { ArbiterState } from '@/types/marketplace';

interface ArbiterPanelProps {
  contractAddress: string;
  state: ArbiterState | null;
  loading: boolean;
  onChanged: () => Promise<void> | void;
}

/**
 * The arbiter seat on a sold escrow (MARKETPLACE_OPENSPEC §15.6c, §3.3).
 *
 * These screens exist because a marketplace sale empties the arbiter seat. `transferRecipientFrom`
 * unseats the incumbent in the same transaction as the sale — automatically, not on objection —
 * because in the §8.1a attack the seller *is* the adversary and would otherwise bundle the sale,
 * a dispute and a pre-loaded arbiter's vote into one block. Every path back to a seat then runs
 * through the new recipient.
 *
 * ⚠️ DRIVEN ENTIRELY OFF THE `can*` FLAGS. Show a control when its flag is true; that is the whole
 *    rule. A legacy escrow returns every flag false, so no legacy-specific UI is needed and none
 *    should be written — legacy escrows cannot reach these states at all, since the marketplace
 *    only accepts clones matching the new codehash.
 */
export default function ArbiterPanel({ contractAddress, state, loading, onChanged }: ArbiterPanelProps) {
  const { nominateArbiter, evictArbiter, seatDefaultArbiter } = useMarketplaceActions();
  const [candidate, setCandidate] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !state) {
    return <div className="text-sm text-gray-500 dark:text-secondary-400">Reading the arbiter seat…</div>;
  }

  // Nothing to offer: either not a marketplace-capable escrow, or no action is currently live.
  if (!state || (!state.canNominate && !state.canSeatDefaultArbiter && !state.canEvictArbiter && state.seated)) {
    return state?.seated ? (
      <div className="text-sm text-gray-600 dark:text-secondary-300">
        Arbiter seated: <span className="font-mono text-xs">{state.arbiter}</span>
      </div>
    ) : null;
  }

  const run = async (label: string, action: () => Promise<unknown>, success: string) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await onChanged();
    } catch (e: any) {
      // A nomination racing a seat-default is an ordinary race, not a fault: a late match still
      // wins right up until the fallback transaction actually executes.
      setError(e?.message || `${label} failed. Re-read the state and try again.`);
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  const candidateIsValid = ethers.isAddress(candidate);
  const otherPartyNomination = state.nominatedByBuyer || state.nominatedByRecipient;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-secondary-700 p-4 space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white">Arbiter seat</h4>
        <p className="text-sm text-gray-600 dark:text-secondary-300 mt-1">
          {state.seated ? (
            <>
              Seated: <span className="font-mono text-xs">{state.arbiter}</span>
            </>
          ) : (
            <>
              The seat is empty. This escrow&apos;s cashflow was sold, which unseats the arbiter
              automatically. Buyer and recipient can agree a replacement, or wait for the default
              arbiter.
            </>
          )}
        </p>
      </div>

      {/* Nominate — matching names seat that candidate instantly, in the nominating transaction. */}
      {state.canNominate && (
        <div className="space-y-2">
          <label htmlFor="arbiter-candidate" className="block text-sm font-medium text-gray-700 dark:text-secondary-200">
            Nominate an arbiter
          </label>

          {/*
            ⚠️ SAFETY-CRITICAL, AND THE ONLY PROTECTION THERE IS (§15.1, §3.3B). The arbiter
            registry was dropped, so nothing on-chain validates a candidate beyond "not a party to
            this escrow". Social-engineering resistance is a UI guarantee now, not a contract one:
            if this warning is omitted, nothing else catches it.
          */}
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            <strong>Naming the same address as the other party seats them immediately.</strong> It
            happens in this transaction and cannot be undone. There is no register of approved
            arbiters and no check on who this address belongs to — only that they are not the buyer
            or recipient.
            <div className="mt-2">
              Declining to nominate is always safe: if nobody agrees, the platform&apos;s default
              arbiter takes the seat once the window closes.
            </div>
          </div>

          {otherPartyNomination && (
            <div className="text-sm text-gray-700 dark:text-secondary-200">
              Already nominated —{' '}
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
              placeholder="0x…"
              className="flex-1 px-3 py-2 font-mono text-sm border border-gray-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-gray-900 dark:text-white rounded-md"
            />
            <Button
              type="button"
              disabled={!candidateIsValid || busy !== null}
              onClick={() =>
                run(
                  'Nomination',
                  () => nominateArbiter(contractAddress, candidate),
                  candidate.toLowerCase() === otherPartyNomination?.toLowerCase()
                    ? 'Nominations matched — that arbiter is now seated.'
                    : 'Nomination recorded. It seats them the moment the other party names the same address.'
                )
              }
            >
              {busy === 'Nomination' ? <LoadingSpinner className="w-4 h-4" /> : 'Nominate'}
            </Button>
          </div>

          {candidate && !candidateIsValid && (
            <p className="text-xs text-red-600 dark:text-red-400">That is not a valid wallet address.</p>
          )}
        </div>
      )}

      {/* The fallback. Permissionless on-chain, so the platform fires it — it can only seat the Safe. */}
      {state.canSeatDefaultArbiter && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-secondary-200">
            The 72-hour nomination window has passed without agreement. Anyone may now seat the
            platform&apos;s default arbiter — a multisig that acts only as a third voter.
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
                'The default arbiter is seated and can now vote.'
              )
            }
          >
            {busy === 'Seating' ? <LoadingSpinner className="w-4 h-4" /> : 'Seat the default arbiter'}
          </Button>
        </div>
      )}

      {/* Eviction — the remedy for a seated-but-silent arbiter. It swaps a voter; it moves no funds. */}
      {state.canEvictArbiter && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-secondary-200">
            This arbiter has been silent for 30 days
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
            {busy === 'Eviction' ? <LoadingSpinner className="w-4 h-4" /> : 'Request a new arbiter'}
          </Button>
        </div>
      )}

      {!state.seated && state.nominationDeadline && !state.canSeatDefaultArbiter && (
        <p className="text-xs text-gray-500 dark:text-secondary-400">
          If no one agrees, the default arbiter becomes seatable after{' '}
          {formatTimestamp(state.nominationDeadline).date} at{' '}
          {formatTimestamp(state.nominationDeadline).time}.
        </p>
      )}

      {notice && <p className="text-sm text-green-700 dark:text-green-300">{notice}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
