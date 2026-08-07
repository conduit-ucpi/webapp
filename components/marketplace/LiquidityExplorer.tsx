import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import StatsCard from '@/components/ui/StatsCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import MakeOfferModal from '@/components/marketplace/MakeOfferModal';
import { useSellableEscrows } from '@/hooks/useMarketplaceData';
import { useConfig } from '@/components/auth/ConfigProvider';
import { displayCurrency } from '@/utils/currency';
import { formatTimestamp } from '@/utils/datetime';
import { daysUntil } from '@/utils/marketplace';
import type { SellableEscrow } from '@/types/marketplace';

interface LiquidityExplorerProps {
  /** The connected wallet — the LP who would be making the offers. */
  walletAddress?: string;
}

const MATURITY_FILTERS = [7, 30, 60, 90];

/**
 * The escrows open to offers (MARKETPLACE_OPENSPEC §15.6d, §15.3).
 *
 * ⚠️ WHAT IS LISTED HERE IS A CURATION DECISION, and it is the chokepoint for the §8.1a
 *    self-dealt-escrow residual. The contracts stay permissionless — anyone may create an escrow
 *    and anyone may bid on it — but the venue need not list everything. The contract's protections
 *    bound the damage from a self-dealt escrow; curation is what avoids the encounter. Tells worth
 *    screening: buyer and seller wallets funded from a common source, freshly created parties,
 *    listing immediately after funding.
 *
 * ⚠️ AND IT IS DISPLAY ONLY (§15.3a rule 1). Appearing here means an escrow looked sellable when
 *    the list was built. `createOffer` re-checks the codehash and the composite state on-chain,
 *    and it is the only thing that decides.
 */
export default function LiquidityExplorer({ walletAddress }: LiquidityExplorerProps) {
  const { config } = useConfig();
  const [maxDays, setMaxDays] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [bidding, setBidding] = useState<SellableEscrow | null>(null);

  const { data, loading, error, refetch } = useSellableEscrows(maxDays);
  const tokenSymbol = config?.tokenSymbol || 'USDC';

  const escrows = data?.escrows ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return escrows;
    return escrows.filter(
      (e) =>
        e.escrowContract.toLowerCase().includes(needle) ||
        (e.description || '').toLowerCase().includes(needle) ||
        (e.productName || '').toLowerCase().includes(needle)
    );
  }, [escrows, search]);

  const totals = useMemo(() => {
    const locked = escrows.reduce((sum, e) => sum + BigInt(e.amount || '0'), BigInt(0));
    const avgDays = escrows.length
      ? Math.round(escrows.reduce((sum, e) => sum + daysUntil(e.maturity), 0) / escrows.length)
      : 0;
    return { locked, avgDays };
  }, [escrows]);

  /**
   * An LP may not be the escrow's buyer — the vault rejects it, because the buyer controls
   * whether the LP is ever paid. Better to disable the control than to let them sign a revert.
   */
  const isOwnEscrow = (escrow: SellableEscrow) =>
    !!walletAddress &&
    (escrow.buyer?.toLowerCase() === walletAddress.toLowerCase() ||
      escrow.seller?.toLowerCase() === walletAddress.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatsCard
          title="Payments open to offers"
          value={loading && !data ? '—' : escrows.length}
          sub={data?.unreadable ? `${data.unreadable} could not be read` : 'Verified against the chain'}
        />
        <StatsCard
          title="Total locked"
          value={`${displayCurrency(totals.locked.toString(), 'microUSDC')}`}
          sub={`${tokenSymbol} across the listed escrows`}
        />
        <StatsCard
          title="Average maturity"
          value={totals.avgDays ? `${totals.avgDays} days` : '—'}
          sub="Time to maturity is your risk window"
        />
      </div>

      {/*
        `unreadable` is not cosmetic: it is the difference between "nothing is for sale" and
        "we could not see what is for sale". Both look like an empty list otherwise.
      */}
      {!!data?.unreadable && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          {data.unreadable} escrow{data.unreadable === 1 ? '' : 's'} could not be read from the
          chain and {data.unreadable === 1 ? 'is' : 'are'} not shown. This list is incomplete, not
          empty.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-secondary-300 mr-1">Matures within</span>
        <button
          type="button"
          onClick={() => setMaxDays(null)}
          className={`text-xs rounded-full border px-3 py-1 transition-colors ${
            maxDays === null
              ? 'bg-secondary-100 dark:bg-secondary-700 border-secondary-400 dark:border-secondary-500 text-secondary-900 dark:text-white'
              : 'border-secondary-300 dark:border-secondary-600 text-secondary-600 dark:text-secondary-300'
          }`}
        >
          Any
        </button>
        {MATURITY_FILTERS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setMaxDays(days)}
            className={`text-xs rounded-full border px-3 py-1 transition-colors ${
              maxDays === days
                ? 'bg-secondary-100 dark:bg-secondary-700 border-secondary-400 dark:border-secondary-500 text-secondary-900 dark:text-white'
                : 'border-secondary-300 dark:border-secondary-600 text-secondary-600 dark:text-secondary-300'
            }`}
          >
            {days} days
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Contract address or description"
          className="sm:ml-auto w-full sm:w-64 px-3 py-1.5 text-sm border border-gray-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-gray-900 dark:text-white rounded-md"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner className="w-8 h-8" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No payments are open to offers"
          description={
            search
              ? 'Nothing matches that search. Clear it to see everything currently listed.'
              : 'Escrows appear here once they are funded and still short of maturity. Check back, or widen the maturity filter.'
          }
        />
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-secondary-700 overflow-hidden bg-white dark:bg-secondary-800">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-gray-500 dark:text-secondary-400 bg-gray-50 dark:bg-secondary-900/60 border-b border-gray-200 dark:border-secondary-700">
            <div className="col-span-5">Payment</div>
            <div className="col-span-2">Collects</div>
            <div className="col-span-2">Matures</div>
            <div className="col-span-1">Offers</div>
            <div className="col-span-2" />
          </div>

          {visible.map((escrow) => {
            const days = daysUntil(escrow.maturity);
            const own = isOwnEscrow(escrow);

            return (
              <div
                key={escrow.escrowContract}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center px-4 py-3 border-b border-gray-200 dark:border-secondary-700 last:border-b-0"
              >
                <div className="md:col-span-5">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {escrow.productName || escrow.description || 'Escrow payment'}
                  </div>
                  <div className="text-xs font-mono text-gray-400 dark:text-secondary-500 mt-0.5">
                    {escrow.escrowContract}
                  </div>
                  {escrow.previouslySold && (
                    <span className="inline-block mt-1 text-[11px] rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5">
                      Previously sold — carries a reserve
                    </span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {displayCurrency(escrow.amount ?? 0, 'microUSDC')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-secondary-400">{escrow.currencySymbol}</div>
                </div>

                <div className="md:col-span-2">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {formatTimestamp(escrow.maturity).date}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-secondary-400">
                    {days} {days === 1 ? 'day' : 'days'}
                  </div>
                </div>

                <div className="md:col-span-1 text-sm text-gray-700 dark:text-secondary-200">
                  {escrow.openOffers}
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={own || !walletAddress}
                    onClick={() => setBidding(escrow)}
                  >
                    {own ? 'Your escrow' : 'Make offer'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bidding && walletAddress && (
        <MakeOfferModal
          escrow={bidding}
          lpAddress={walletAddress}
          onClose={() => setBidding(null)}
          onOfferMade={async () => {
            await refetch();
          }}
        />
      )}
    </div>
  );
}
