import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import MarketplaceCard from '@/components/marketplace/MarketplaceCard';
import {
  useEscrowStates,
  useLpOffers,
  useRefreshFromChain,
  type EscrowState
} from '@/hooks/useMarketplaceData';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { displayCurrencyPrecise } from '@/utils/currency';
import { formatTimestamp } from '@/utils/datetime';
import { hoursUntil, looksWithdrawable, needsOpening, offerStatusLabel } from '@/utils/marketplace';
import type { OfferStatus, OfferView } from '@/types/marketplace';

interface MyOffersListProps {
  lpAddress?: string;
}

/**
 * Statuses in which the LP actually bought the cashflow.
 *
 * ⚠️ RELEASED BELONGS HERE. It is not a separate kind of offer - it is an ACCEPTED one that ran
 *    all the way through: accepted, claimed, holdback returned. Testing for ACCEPTED alone
 *    makes a completed purchase describe itself as a bid still waiting to be taken up, which is
 *    the opposite of what happened to it.
 */
const PURCHASED: ReadonlySet<OfferStatus> = new Set<OfferStatus>(['ACCEPTED', 'RELEASED']);

/**
 * What the contract is doing, in the words an LP holding an offer against it would use.
 *
 * The record's own vocabulary mixes lifecycle stages with record-keeping states, several of
 * which mean nothing to someone who did not create the contract: "OK" and "IN-PROCESS"
 * describe a seller's workflow rather than the cashflow. They are translated rather than
 * shown raw.
 */
function escrowStatusLabel(facts: EscrowState): string {
  switch (facts.state) {
    case 'CLAIMED':
    case 'COMPLETED':
      return 'Claimed';
    case 'DISPUTED':
      return 'Disputed';
    case 'RESOLVED':
      return 'Dispute resolved';
    case 'NEVER_FUNDED':
      return 'Never funded';
    case 'EXPIRED':
      return 'Matured — awaiting claim';
    case 'ACTIVE':
    case 'IN-PROCESS':
      return 'Funded';
    case 'OK':
      // The record's default: nothing has happened to it yet.
      return 'Awaiting funding';
    default:
      // A state the record knows and this UI does not. Showing it raw beats inventing a label
      // or rendering nothing at all.
      return facts.state;
  }
}

function escrowStatusTone(facts: EscrowState): string {
  if (facts.state === 'DISPUTED') return 'text-amber-700 dark:text-amber-300';
  if (facts.state === 'CLAIMED' || facts.state === 'COMPLETED') {
    return 'text-green-700 dark:text-green-400';
  }
  return 'text-gray-500 dark:text-secondary-400';
}

/**
 * An LP's own offers (MARKETPLACE_OPENSPEC §15.6d, §15.6f).
 *
 * ⚠️ HOUSEKEEPING IS LAZY, AND NOTHING ON-CHAIN NOTIFIES ANYONE. Expiry, rejection, staleness
 *    after someone else's acceptance, and dispute-triggered withdrawability all become true
 *    silently — expiry emits no event at all, and an acceptance elsewhere emits an event about a
 *    *different* vault.
 *
 *    A keeper now sweeps the two the index can recognise on its own — lapsed and rejected offers
 *    — so those come back whether or not the LP ever returns. STALENESS IS NOT ONE OF THEM: the
 *    index cannot see it, so a losing offer reads as standing here until it lapses. This screen
 *    prompting is still what makes the difference for anything the sweep cannot select.
 *
 * ⚠️ THIS IS ALSO WHERE "REFRESH FROM CHAIN" BELONGS, and not as a convenience. The staleness
 *    that costs money is a missed ACCEPTANCE: when a seller accepts an offer directly on-chain,
 *    every other offer on that escrow becomes stale and withdrawable at once, and those LPs have
 *    capital they could recover with no way to learn it. Putting the control only on an admin
 *    screen puts it in front of the people who do not lose by staleness.
 */
export default function MyOffersList({ lpAddress }: MyOffersListProps) {
  const { config } = useConfig();
  const { data, loading, error, refetch } = useLpOffers(lpAddress);
  const { refresh, refreshing, lastResult, error: refreshError } = useRefreshFromChain(refetch);
  const { withdrawOffer, releaseHoldback, openFundedOffer } = useMarketplaceActions();

  /**
   * What each PENDING vault is actually holding, read straight from the chain.
   *
   * ⚠️ THE INDEX CANNOT ANSWER THIS. Funding is a direct transfer, and a bare ERC20 transfer
   *    emits no marketplace event — so a deposit that arrived without `fund()` opening the
   *    offer is invisible to the event pipeline the rest of this list is built from. Without
   *    this read the LP is never told their capital is parked, and never offered either the
   *    open or the withdrawal. Only PENDING rows are read: every other status already
   *    implies its balance.
   */
  const [deposits, setDeposits] = useState<Record<string, string>>({});


  const [busyVault, setBusyVault] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const offers = data ?? [];

  // Stable key so the effect below re-runs when the PENDING set changes, not on every render.
  const pendingKey = useMemo(
    () =>
      offers
        .filter((o) => o.status === 'PENDING' && o.token)
        .map((o) => `${o.vaultAddress}:${o.token}`)
        .sort()
        .join(','),
    [offers]
  );

  /*
   * The escrows underneath these offers, from resultservice in a single request.
   *
   * This was once a chain read per escrow, which turned a twenty-row list into hundreds of RPC
   * calls. The facts a list needs - what the contract is doing and when it matures - are
   * already held in our own records, and resultservice is the public read view over them.
   * That matters here beyond speed: an LP's offers sit on escrows belonging to other people,
   * so a public view is the correct scope rather than a user's own contract store.
   *
   * Every offer is included, finished ones too: "claimed" is exactly the fact that explains
   * why a completed offer is over, and one batched request costs nothing extra to include it.
   */
  const escrowAddresses = useMemo(
    () => offers.map((o) => o.escrowContract).filter(Boolean) as string[],
    [offers]
  );
  const { escrows: escrowFacts } = useEscrowStates(escrowAddresses);

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;
    (async () => {
      try {
        /* chainservice reads and caches these; the browser never talks to a node. One request
           for the whole PENDING set, not one per vault. */
        const response = await fetch('/api/chain/marketplace/vault-deposits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaults: pendingKey.split(',').map((pair) => {
              const [vaultAddress, tokenAddress] = pair.split(':');
              return { vaultAddress, tokenAddress };
            })
          })
        });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const body = await response.json();
        if (cancelled) return;

        // Keys come back lower-cased; the rows look them up by the address the offer carries.
        const byVault: Record<string, string> = {};
        for (const [vault, amount] of Object.entries(body.deposits ?? {})) {
          byVault[vault as string] = String(amount);
        }
        setDeposits(byVault);
      } catch (e) {
        // An unreadable balance is not evidence of an empty vault — leave it absent so the UI
        // stays silent rather than claiming there is nothing to recover.
        console.warn('MyOffersList: could not read vault deposits:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingKey]);

  /**
   * Run one action against a vault, then make this list describe the world after it.
   *
   * ⚠️ RE-READING THE INDEX ALONE CAN RETURN THE ROW UNCHANGED, which reads as a failed
   *    transaction and invites the LP to send a second one. A page refresh does not help
   *    either, since it re-reads the same unchanged index. So the chain is reconciled first and
   *    the list re-read only after. A reconcile that fails still falls through to a plain
   *    refetch — the action happened either way, and stale-but-shown beats a screen frozen on
   *    pre-action state.
   *
   * `reconcile` is false for the two RELAYED actions whose rows do not depend on an event
   * arriving: the open and the withdrawal. chainservice sends those itself and the row is
   * driven by state it re-reads directly, so a scan would cost its seconds for nothing.
   *
   * ⚠️ IT STAYS TRUE FOR `releaseHoldback`, THOUGH THAT IS RELAYED TOO, and the reason changed.
   *    It used to be the one action sent from the LP's own wallet. Now it is relayed like the
   *    others — but this row stops offering the release only once `HoldbackReleased` is in the
   *    folded event history, and the only thing that puts it there as the transaction lands is
   *    chainservice's inline push. Nothing downstream checks that the push worked, so when it
   *    does not arrive the index still reads ACCEPTED and the button survives a release that
   *    has already paid. Trusting the push here is what left it sitting there.
   */
  const act = async (
    vault: string,
    action: () => Promise<unknown>,
    { reconcile = true }: { reconcile?: boolean } = {}
  ) => {
    setBusyVault(vault);
    setActionError(null);
    try {
      await action();
      if (!reconcile || !(await refresh())) await refetch();
    } catch (e: any) {
      setActionError(e?.message || 'That transaction did not go through.');
    } finally {
      setBusyVault(null);
    }
  };

  if (!lpAddress) {
    return (
      <EmptyState
        title="Connect a wallet"
        description="Your offers are listed against the wallet that made them."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your offers</h2>
          <p className="text-sm text-gray-500 dark:text-secondary-400">
            {lastResult
              ? `Checked against the chain — ${lastResult.eventsFound} event${lastResult.eventsFound === 1 ? '' : 's'} found across ${lastResult.escrowsReconciled} escrow${lastResult.escrowsReconciled === 1 ? '' : 's'}.`
              : 'An offer can become withdrawable without anything telling you. Check for updates if one looks stale.'}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => refresh()} disabled={refreshing}>
          {refreshing ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              Checking…
            </>
          ) : (
            'Check for updates'
          )}
        </Button>
      </div>

      {(error || refreshError || actionError) && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {actionError || refreshError || error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner className="w-8 h-8" />
        </div>
      ) : offers.length === 0 ? (
        <EmptyState
          title="No offers yet"
          description="Offers you make appear here, along with anything you need to act on."
        />
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <OfferRow
              key={offer.vaultAddress}
              offer={
                // Keyed lower-case by the service; the offer's own casing may differ.
                deposits[offer.vaultAddress.toLowerCase()] != null
                  ? { ...offer, depositedAmount: deposits[offer.vaultAddress.toLowerCase()] }
                  : offer
              }
              tokenSymbol={tokenSymbol}
              escrow={offer.escrowContract ? escrowFacts[offer.escrowContract] : undefined}
              busy={busyVault === offer.vaultAddress}
              onWithdraw={() =>
                act(offer.vaultAddress, async () => {
                  // Relayed, like the open below — it reports failure in its result rather than
                  // throwing, so a refusal has to be raised here or `act` would treat it as a
                  // success and re-render the same row still offering the withdrawal.
                  const result = await withdrawOffer(offer.vaultAddress);
                  if (!result.success) {
                    throw new Error(
                      result.error || 'Your capital could not be returned. Try again shortly.'
                    );
                  }
                }, { reconcile: false })
              }
              onOpen={() =>
                act(offer.vaultAddress, async () => {
                  // Unlike the wallet actions, this one reports failure in its result rather
                  // than throwing — so it has to be raised here or `act` would treat a
                  // refused open as a success and quietly re-render the same stuck row.
                  const result = await openFundedOffer(offer.vaultAddress);
                  if (!result.success) {
                    throw new Error(result.error || 'The offer could not be opened.');
                  }
                }, { reconcile: false })
              }
              onRelease={() =>
                // Reconciles, unlike the other two relayed actions — see the note on `act`.
                act(offer.vaultAddress, async () => {
                  // Relayed like the others now, so a refusal arrives in the result rather than
                  // as a throw and has to be raised here.
                  const result = await releaseHoldback(offer.vaultAddress);
                  if (!result.success) {
                    throw new Error(result.error || 'The reserve could not be released.');
                  }
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  tokenSymbol,
  escrow,
  busy,
  onWithdraw,
  onRelease,
  onOpen
}: {
  offer: OfferView;
  tokenSymbol: string;
  /** undefined = we hold no record for this escrow. Never treat that as "no". */
  escrow?: EscrowState;
  busy: boolean;
  onWithdraw: () => void;
  onRelease: () => void;
  onOpen: () => void;
}) {
  const withdrawable = looksWithdrawable(offer);
  // Only an accepted offer has a holdback at all: it is withheld out of the sum the seller
  // receives at acceptance (§8.5a), so before acceptance there is nothing to release.
  const hasHoldback = offer.status === 'ACCEPTED' && !!offer.holdback && offer.holdback !== '0';
  /*
   * ⚠️ THE VAULT'S OWN ANSWER, NOT A CONDITION RESTATED HERE. This used to be derived from the
   *    escrow's state — settled and not mid-dispute — which is a fact about the ESCROW, and an
   *    escrow stays settled after its reserve has been paid out. So a release that had already
   *    happened left every input to this reading "yes", and the button sat there through a page
   *    refresh offering money that was already in the funder's wallet. `OfferVault.isReleasable()`
   *    is the one thing that cannot drift from the contract, because it IS the contract.
   *
   * ⚠️ FALSE COVERS "WE COULD NOT ASK" — an unreadable vault, or one too old to have the
   *    function. Both must leave this disabled: the honest reading of silence is not "go ahead",
   *    and a paid-for revert is what the guess costs.
   */
  const releasable = hasHoldback && offer.releasable;
  // A deposit that landed while the offer never opened. The money is in the vault and the
  // seller cannot see it — one relayed call fixes it, and no transfer is involved.
  const openable = needsOpening(offer);

  return (
    <MarketplaceCard
      /*
        "offered" is a bid still hoping for a yes; "accepted" is money that has changed hands.
        Reading the same word for both makes a settled purchase look like it is still waiting
        on someone.

        The maturity rides in the title because it is the figure an LP scans a list for - it is
        when the capital comes back. It is omitted, rather than guessed at, until the escrow has
        actually been read.
      */
      headline={
        <>
          {displayCurrencyPrecise(offer.offerAmount ?? 0, 'microUSDC')} {tokenSymbol}{' '}
          {PURCHASED.has(offer.status) ? 'accepted' : 'offered'}
          {escrow?.maturity ? ` · matures ${formatTimestamp(escrow.maturity).date}` : ''}
        </>
      }
      identifier={`escrow ${offer.escrowContract}`}
      status={
        <>
          {offer.status === 'OPEN' && !offer.expired && offer.offerExpiry ? (
            <>Standing — lapses in {hoursUntil(offer.offerExpiry)}h</>
          ) : (
            offerStatusLabel(offer)
          )}
          {offer.lastEventAt ? ` · last activity ${formatTimestamp(offer.lastEventAt).date}` : ''}
        </>
      }
      /*
        The escrow underneath, kept visually distinct from the offer's own status above. The two
        answer different questions and can disagree in ways that matter: an offer can read
        "Withdrawn" while its escrow is still live, and "Accepted" while the escrow is disputed.
        Collapsing them into one line would hide exactly that.

        Nothing is rendered until the escrow has been read - an absent entry means unknown, and a
        row that says nothing is better than one asserting "Not funded" about an escrow nobody
        managed to reach.
      */
      footnote={
        escrow && (
          <div className={`text-xs mt-1 ${escrowStatusTone(escrow)}`}>
            Contract: {escrowStatusLabel(escrow)}
          </div>
        )
      }
      actions={
        <>
          {openable && (
            <Button type="button" size="sm" onClick={onOpen} disabled={busy}>
              {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Open this offer'}
            </Button>
          )}
          {/*
            ⚠️ NO WALLET PROMPT BEHIND THIS ONE. `withdraw()` is permissionless and pays only the
            vault's own LP, so the platform relays it: the LP presses this and their capital comes
            back without a signature and without gas. Do not reword it into a "sign to withdraw".
          */}
          {withdrawable && (
            <Button type="button" size="sm" onClick={onWithdraw} disabled={busy}>
              {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Return my capital now'}
            </Button>
          )}
          {/*
            ⚠️ RELAYED, BUT NOT SWEPT. `releaseHoldback` is permissionless (§6.7), so this costs
            no signature and no gas — but no keeper fires it, because selecting candidates needs
            a chain read per sold position. If this prompt is missing, the reserve simply sits in
            the vault, so the detection above is still what gets it paid out.
          */}
          {hasHoldback && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRelease}
              disabled={busy || !releasable}
            >
              {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Release the holdback'}
            </Button>
          )}
        </>
      }
    >
      {openable && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          Your {displayCurrencyPrecise(offer.depositedAmount!, 'microUSDC')} {tokenSymbol} arrived, but this
          offer was never opened, so no seller can see it. Opening it costs you nothing and moves
          no money — do not send again.
        </p>
      )}

      {/*
        ⚠️ THE OLD COPY HERE SAID "NOTHING RETURNS IT AUTOMATICALLY", AND THAT IS NO LONGER TRUE.
        A sweep returns lapsed and rejected offers on the same timer as the batch claim, so the
        button is now about not waiting for it rather than about the money being stranded. Saying
        otherwise would frighten an LP into thinking their capital depends on them noticing.
      */}
      {withdrawable && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          {offer.status === 'REJECTED'
            ? 'The seller declined this offer. Your capital is being returned to your wallet automatically — press the button if you would rather not wait. It costs you nothing and needs no signature.'
            : offer.status === 'PENDING'
              ? 'This offer lapsed before it was ever opened, and your deposit is still sitting in the vault. It is returned to your wallet automatically — press the button if you would rather not wait. It costs you nothing and needs no signature.'
              : 'This offer has lapsed and can no longer be accepted. Your capital is being returned to your wallet automatically — press the button if you would rather not wait. It costs you nothing and needs no signature.'}
        </p>
      )}

      {hasHoldback && (
        <p className="text-xs text-gray-500 dark:text-secondary-400 mt-3">
          You are holding {displayCurrencyPrecise(offer.holdback!, 'microUSDC')} {tokenSymbol} as a
          holdback.{' '}
          {releasable && escrow?.state === 'RESOLVED' ? (
            <>
              This contract was disputed and resolved. The award to the customer comes out of your
              holdback first, and only what is left of it returns to the seller — releasing now
              settles that split. It costs you nothing and needs no signature.
            </>
          ) : releasable ? (
            <>
              The contract was claimed without a dispute, so releasing now returns the holdback to
              the seller. It costs you nothing and needs no signature.
            </>
          ) : escrow?.state === 'DISPUTED' ? (
            <>
              This contract is under dispute. Nothing can be released until that resolves and the
              contract is claimed.
            </>
          ) : escrow ? (
            <>
              It cannot be released until the contract is claimed — the vault refuses before then,
              so the button stays disabled rather than sending a transaction that reverts.
            </>
          ) : (
            <>
              Checking what the contract has done. Until that is known the release stays disabled,
              because the contract refuses it before settlement.
            </>
          )}
        </p>
      )}
    </MarketplaceCard>
  );
}
