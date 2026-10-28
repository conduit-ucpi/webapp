import { useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import MarketplaceCard from '@/components/marketplace/MarketplaceCard';
import ReserveDetailsModal from '@/components/marketplace/ReserveDetailsModal';
import { useSellerReserves } from '@/hooks/useMarketplaceData';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { usePageT } from '@/config/locales';
import { displayCurrency } from '@/utils/currency';
import { formatTimestamp } from '@/utils/datetime';
import { escrowTitle } from '@/utils/marketplace';
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
 * A keeper does now collect it. contractservice's BatchClaimScheduler sweeps settled reserves
 * every thirty minutes, so a supplier who never opens this page is still paid — which is the
 * outcome that matters, since selling is exactly what stops them visiting. The list remains
 * worth rendering: it is the only place the money is VISIBLE to them, it shows what is still
 * provisional while the escrow runs, and a supplier who wants their reserve now should not have
 * to wait for the next sweep.
 *
 * Renders nothing at all when the supplier has no reserves, which is almost everyone.
 */
export default function ReservesOwedList({ sellerAddress }: ReservesOwedListProps) {
  const { config } = useConfig();
  const t = usePageT();
  const { data, loading, error, refetch } = useSellerReserves(sellerAddress);
  const { releaseHoldback } = useMarketplaceActions();

  const [busyVault, setBusyVault] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ReserveView | null>(null);

  /*
   * Collapsed by default. This section sits above the contract list on the dashboard, and for
   * most suppliers most of the time it is a record rather than a task — the money returns on
   * its own within half an hour of the contract completing. Open by default it would push the
   * contracts down the page to report something nobody has to act on.
   *
   * The count in the header is what makes that safe: collapsed does not mean hidden, because
   * the heading still says how many and whether any can be collected now.
   */
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const reserves = data ?? [];

  const release = async (vaultAddress: string) => {
    setBusyVault(vaultAddress);
    setActionError(null);
    try {
      /*
       * Sent from the supplier's own wallet and throws on failure — it no longer returns a
       * {success, error} envelope, because releaseHoldback moved from a relayed call to a
       * direct send with the rest of the marketplace actions. Nothing to unwrap; a rejection
       * lands in the catch below.
       */
      await releaseHoldback(vaultAddress);
      setViewing(null);
      await refetch();
    } catch (e: any) {
      setActionError(e?.message || t('reserves.actionFailed'));
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
      <p className="text-xs text-gray-500 dark:text-secondary-400">{t('reserves.loadError')}</p>
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

  // Said in the heading so a collapsed section still carries the one fact worth acting on.
  const collectable = ordered.filter((r) => r.releasable).length;

  return (
    <div className="space-y-4">
      {/*
        A real button spanning the header, not a chevron glyph beside it: the whole heading is
        the target, and aria-expanded/aria-controls make the state audible rather than only
        visible.
      */}
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls="reserves-owed-panel"
        className="w-full flex items-start justify-between gap-3 text-left group"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('reserves.title')}
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-secondary-400">
              ({ordered.length})
            </span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-secondary-400">
            {collectable > 0
              ? collectable === 1
                ? t('reserves.readyOne')
                : t('reserves.readyMany', { count: collectable })
              : t('reserves.heldIntro')}
          </p>
        </div>
        <svg
          className={`w-5 h-5 mt-1 flex-shrink-0 text-gray-400 dark:text-secondary-500 transition-transform group-hover:text-gray-600 dark:group-hover:text-secondary-300 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/*
        The error escapes the collapse deliberately. A failed release is the one thing here the
        supplier has to see whether or not they have the section open — and they can only have
        caused it from inside it, so hiding it would make the button appear to do nothing.
      */}
      {actionError && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      <div id="reserves-owed-panel" hidden={!open} className="space-y-3">
        {ordered.map((reserve) => (
          <ReserveRow
            key={reserve.vaultAddress}
            reserve={reserve}
            tokenSymbol={tokenSymbol}
            busy={busyVault === reserve.vaultAddress}
            onRelease={() => release(reserve.vaultAddress)}
            onViewDetails={() => setViewing(reserve)}
          />
        ))}
      </div>

      {/* One modal for whichever reserve is being looked at, rather than one per row. */}
      {viewing && (
        <ReserveDetailsModal
          isOpen
          onClose={() => setViewing(null)}
          reserve={viewing}
          tokenSymbol={tokenSymbol}
          busy={busyVault === viewing.vaultAddress}
          onRelease={() => release(viewing.vaultAddress)}
        />
      )}
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
  onRelease,
  onViewDetails
}: {
  reserve: ReserveView;
  tokenSymbol: string;
  busy: boolean;
  onRelease: () => void;
  onViewDetails: () => void;
}) {
  const t = usePageT();
  const held = `${displayCurrency(reserve.holdback, 'microUSDC')} ${tokenSymbol}`;
  const due = reserve.dueBack ? `${displayCurrency(reserve.dueBack, 'microUSDC')} ${tokenSymbol}` : null;
  const matures = reserve.maturity ? formatTimestamp(reserve.maturity).date : null;

  const headline =
    reserve.state === 'RELEASED'
      ? t('reserves.headline.returned', { amount: due ?? held })
      : reserve.state === 'RESOLVED' || reserve.state === 'SETTLED'
        ? t('reserves.headline.dueBack', { amount: due ?? '' })
        : t('reserves.headline.held', { amount: held });

  return (
    <MarketplaceCard
      headline={
        <>
          {headline}
          {/*
            ⚠️ WHAT THE PAYMENT WAS FOR, not just what it was worth. Selling hands the recipient
               role to the LP, so this escrow has dropped out of the supplier's own contract list
               and this row is the last trace of it. Owed two reserves, they otherwise have only
               two vault addresses to tell them apart — and the amounts can easily match.
          */}
          <div className="text-xs font-normal text-gray-500 dark:text-secondary-400 mt-0.5 truncate">
            {escrowTitle(reserve, t('reserves.paymentYouSold'))}
          </div>
        </>
      }
      identifier={t('reserves.contractIdentifier', {
        address: reserve.escrowContract ?? t('reserves.unknownContract')
      })}
      status={<ReserveStatus reserve={reserve} held={held} due={due} matures={matures} />}
      actions={
        <>
          {/* Offered on every row, including RELEASED ones: "what did I actually get, and
              why that much" is exactly the question a settled row raises. */}
          <Button type="button" size="sm" variant="ghost" onClick={onViewDetails} disabled={busy}>
            {t('reserves.viewDetails')}
          </Button>
          {reserve.releasable && (
            <Button type="button" size="sm" onClick={onRelease} disabled={busy}>
              {busy ? <LoadingSpinner className="w-4 h-4" /> : t('reserves.returnMyReserve')}
            </Button>
          )}
        </>
      }
    >
      {reserve.releasable && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          {reserve.state === 'RESOLVED'
            ? t('reserves.collectResolved', { due: due ?? '', held })
            : t('reserves.collectSettled')}
        </p>
      )}
    </MarketplaceCard>
  );
}

function ReserveStatus({
  reserve,
  held,
  due,
  matures
}: {
  reserve: ReserveView;
  held: string;
  due: string | null;
  matures: string | null;
}) {
  const t = usePageT();
  switch (reserve.state) {
    case 'LIVE':
      return (
        <>
          {matures
            ? t('reserves.state.liveWithDate', { date: matures, held })
            : t('reserves.state.live', { held })}
        </>
      );
    case 'DISPUTED':
      return <>{t('reserves.state.disputed', { held })}</>;
    case 'SETTLED':
      return <>{t('reserves.state.settled', { held })}</>;
    case 'RESOLVED':
      return (
        <>
          {reserve.resolvedBuyerPercentage != null
            ? t('reserves.state.resolvedWithPct', {
                pct: reserve.resolvedBuyerPercentage,
                held,
                due: due ?? ''
              })
            : t('reserves.state.resolved', { held, due: due ?? '' })}
        </>
      );
    case 'RELEASED':
      return <>{t('reserves.state.released')}</>;
    default:
      /*
       * ⚠️ NOT "nothing owed". The contract could not be read, so the reserve's state is
       *    genuinely unknown — saying anything definite here would be inventing it.
       */
      return <>{t('reserves.state.unknown', { held })}</>;
  }
}
