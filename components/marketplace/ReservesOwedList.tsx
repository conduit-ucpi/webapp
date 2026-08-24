import { useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import MarketplaceCard from '@/components/marketplace/MarketplaceCard';
import { useSellerReserves, useRefreshFromChain } from '@/hooks/useMarketplaceData';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { displayCurrencyPrecise } from '@/utils/currency';
import { formatTimestamp } from '@/utils/datetime';
import { timeToMaturity } from '@/utils/marketplace';
import type { ReserveView } from '@/types/marketplace';

interface ReservesOwedListProps {
  /** The supplier's wallet — the `seller` recorded when they sold the payment. */
  sellerAddress?: string;
}

/**
 * Reserves owed to a supplier on payments they sold early (MARKETPLACE_OPENSPEC §6.7, §15.6d).
 *
 * ⚠️ THIS IS THE ONLY PLACE THE MONEY IS VISIBLE TO THEM. Selling hands the recipient role to
 *    the LP, so the contract drops out of the supplier's own list and they stop being
 *    `escrow.recipient()` — every other view in the product treats the sale as the end of their
 *    involvement. It isn't: the reserve was withheld from *their* proceeds, and the release pays
 *    it back to them. Before this list existed the reserve was returned only when the LP
 *    happened to press release on their own screen, which is exactly the case where the LP has
 *    no reason to bother — the money at stake is the supplier's.
 *
 * ⚠️ AND NO KEEPER COLLECTS IT. `releaseHoldback` is permissionless and relayed, so pressing the
 *    button costs nothing and needs no signature — but nothing fires it unprompted, because
 *    finding candidates means a chain read per sold position. If this list is not rendered, the
 *    reserve sits in the vault indefinitely.
 *
 * Renders nothing at all when the supplier has no reserves, which is almost everyone.
 */
export default function ReservesOwedList({ sellerAddress }: ReservesOwedListProps) {
  const { config } = useConfig();
  const { data, loading, error, refetch } = useSellerReserves(sellerAddress);
  const { refresh } = useRefreshFromChain(refetch);
  const { releaseHoldback } = useMarketplaceActions();

  const [busyVault, setBusyVault] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const reserves = data ?? [];

  const release = async (vaultAddress: string) => {
    setBusyVault(vaultAddress);
    setActionError(null);
    try {
      const result = await releaseHoldback(vaultAddress);
      if (!result.success) {
        throw new Error(result.error || 'The reserve could not be released.');
      }
      /*
       * ⚠️ RECONCILE FIRST, NEVER A BARE REFETCH. This row stops offering the release only once
       *    `HoldbackReleased` is in the folded event history — that is the whole of what turns
       *    `releasable` off. chainservice pushes the receipt's events as the transaction lands,
       *    but nothing downstream depends on that push having worked, and when it does not
       *    arrive the index still reads ACCEPTED. A refetch then returns the identical row,
       *    still inviting a release that has already happened and already paid.
       *
       *    This was the assumption that broke: a release can succeed on-chain and leave the
       *    button sitting there through a page refresh, because both are reading an index the
       *    event never reached. Scanning the chain is the only thing that closes the row
       *    without the push.
       *
       *    A reconcile that fails still falls through to a plain refetch — the money moved
       *    either way, and stale-but-shown beats a screen frozen on pre-action state.
       */
      if (!(await refresh())) await refetch();
    } catch (e: any) {
      setActionError(e?.message || 'That did not go through.');
    } finally {
      setBusyVault(null);
    }
  };

  if (!sellerAddress) return null;

  /*
   * ⚠️ SILENT WHILE UNKNOWN, NEVER OPTIMISTIC. An empty answer and an unloaded one look the same
   *    to a reader, so nothing renders until the list is actually known to be non-empty — a
   *    "no reserves owed" heading on a failed request would be a claim we cannot support.
   */
  if (error) {
    return (
      <p className="text-xs text-gray-500 dark:text-secondary-400">
        Couldn&apos;t check whether any reserve is owed to you on payments you sold. This does not
        affect the money — try again shortly.
      </p>
    );
  }
  if (loading && !data) return null;
  if (reserves.length === 0) return null;

  /*
   * Collectable first. This list is mostly a record, and the rows that need a decision must not
   * be buried under settled history — a supplier scanning it should meet the money they can take
   * today before anything else.
   */
  const ordered = [...reserves].sort((a, b) => {
    if (a.releasable !== b.releasable) return a.releasable ? -1 : 1;
    if ((a.state === 'RELEASED') !== (b.state === 'RELEASED')) return a.state === 'RELEASED' ? 1 : -1;
    return b.lastEventAt - a.lastEventAt;
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Reserves on payments you sold
        </h2>
        <p className="text-sm text-gray-500 dark:text-secondary-400">
          You were paid for these when you sold them. A reserve was held back from that price, and
          it is the only part still outstanding: it returns once the customer&apos;s contract
          reaches its payout date, less anything a dispute awards them.
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      <div className="space-y-3">
        {ordered.map((reserve) => (
          <ReserveRow
            key={reserve.vaultAddress}
            reserve={reserve}
            tokenSymbol={tokenSymbol}
            busy={busyVault === reserve.vaultAddress}
            onRelease={() => release(reserve.vaultAddress)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One reserve, in the state the contract says it is in.
 *
 * ⚠️ TWO STATES CARRY NO FIGURE, AND NONE MAY BE SUBSTITUTED. While a dispute is open the split
 *    turns on votes that have not matched yet; when the escrow could not be read we know nothing
 *    at all. Showing the full reserve in either case would be a promise the contract may refuse.
 *
 * ⚠️ AND `LIVE` IS PROVISIONAL, WHICH THE COPY HAS TO SAY. The customer can still dispute right
 *    up to maturity, and their award comes out of this reserve first — so the figure is what
 *    returns if nothing further happens, not an amount owed.
 */
function ReserveRow({
  reserve,
  tokenSymbol,
  busy,
  onRelease
}: {
  reserve: ReserveView;
  tokenSymbol: string;
  busy: boolean;
  onRelease: () => void;
}) {
  const held = `${displayCurrencyPrecise(reserve.holdback, 'microUSDC')} ${tokenSymbol}`;
  const due = reserve.dueBack ? `${displayCurrencyPrecise(reserve.dueBack, 'microUSDC')} ${tokenSymbol}` : null;
  /*
   * Date AND time. A reserve's payout date is the gate on collecting it, and these routinely
   * fall due within the hour — "Aug 24, 2026" on a contract maturing in forty minutes tells a
   * supplier nothing about whether to wait or come back tomorrow.
   */
  const matures = reserve.maturity
    ? `${formatTimestamp(reserve.maturity).date} at ${formatTimestamp(reserve.maturity).time}`
    : null;
  const maturesIn = reserve.maturity ? timeToMaturity(reserve.maturity) : null;

  const headline =
    reserve.state === 'RELEASED'
      ? `${due ?? held} returned to you`
      : reserve.state === 'RESOLVED' || reserve.state === 'SETTLED'
        ? `${due} due back to you`
        : `${held} held back`;

  return (
    <MarketplaceCard
      headline={headline}
      identifier={`contract ${reserve.escrowContract ?? 'unknown'}`}
      status={<ReserveStatus reserve={reserve} held={held} due={due} matures={matures} maturesIn={maturesIn} />}
      actions={
        reserve.releasable && (
          <Button type="button" size="sm" onClick={onRelease} disabled={busy}>
            {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Return my reserve'}
          </Button>
        )
      }
    >
      {reserve.releasable && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          {reserve.state === 'RESOLVED' ? (
            <>
              This contract was disputed and resolved. The customer&apos;s award came out of the
              reserve first, so {due} of the {held} comes back to you. Nobody returns it
              automatically — press the button. It costs you nothing and needs no signature.
            </>
          ) : (
            <>
              The contract completed without a dispute, so the whole reserve comes back to you.
              Nobody returns it automatically — press the button. It costs you nothing and needs no
              signature.
            </>
          )}
        </p>
      )}
    </MarketplaceCard>
  );
}

function ReserveStatus({
  reserve,
  held,
  due,
  matures,
  maturesIn
}: {
  reserve: ReserveView;
  held: string;
  due: string | null;
  /** Absolute payout date AND time — the gate on collecting the reserve. */
  matures: string | null;
  /** The same moment expressed as a distance ("40 minutes"), since many fall due within the hour. */
  maturesIn: string | null;
}) {
  switch (reserve.state) {
    case 'LIVE':
      return (
        <>
          Nothing to collect yet{maturesIn ? ` — the payout date is ${maturesIn} away` : ''}
          {matures ? `, on ${matures}` : ''}, and the reserve only returns after that. You get the
          full {held} unless the customer disputes before then; their award would come out of this
          reserve first.
        </>
      );
    case 'DISPUTED':
      return (
        <>
          This contract is under dispute. Anything awarded to the customer comes out of this
          reserve first, so how much returns to you is not known until it resolves — up to {held}.
        </>
      );
    case 'SETTLED':
      /*
       * ⚠️ ONLY PROMISE COLLECTION WHEN THE VAULT CONFIRMED IT. `releasable` false here does NOT
       *    mean "not yet": the vault said no, or could not be asked at all. By far the most
       *    common reason is that the reserve has ALREADY been returned — the platform sweeps
       *    them, and the HoldbackReleased event may simply not have reached the index yet.
       *    Telling a supplier that money is "yours to collect" when it is most likely already
       *    in their wallet, beside no button to collect it with, is the confusing pair.
       */
      return reserve.releasable ? (
        <>
          Reached its payout date with no dispute, so the whole reserve survives. You were paid
          the rest of the price when you sold it; this {held} is the remainder, and it is yours
          to collect.
        </>
      ) : (
        <>
          Reached its payout date with no dispute, so the whole {held} reserve survives — it is
          the only part of the price still outstanding, the rest having been paid to you at the
          sale. It has most likely been returned to your wallet already; we could not reach the
          vault to confirm, so there is nothing to press here.
        </>
      );
    case 'RESOLVED':
      return (
        <>
          Disputed and resolved
          {reserve.resolvedBuyerPercentage != null
            ? ` — ${reserve.resolvedBuyerPercentage}% of the payment went to the customer`
            : ''}
          . That award came out of the {held} reserve first, so {due} of it survives
          {due === held ? '' : ' — a partial return, not the whole reserve'}. You were paid the
          rest of the price at the sale; this is the remainder.
          {!reserve.releasable && (
            <>
              {' '}It has most likely been returned to your wallet already; we could not reach the
              vault to confirm.
            </>
          )}
        </>
      );
    case 'RELEASED':
      return <>Settled and paid out. Nothing further to do.</>;
    default:
      /*
       * ⚠️ NOT "nothing owed". The contract could not be read, so the reserve's state is
       *    genuinely unknown — saying anything definite here would be inventing it.
       */
      return (
        <>
          {held} is held against this contract. Its current state could not be read, so what comes
          back to you is not known right now.
        </>
      );
  }
}
