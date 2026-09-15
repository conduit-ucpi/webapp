import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { useLpOffers, useRefreshFromChain } from '@/hooks/useMarketplaceData';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { useConfig } from '@/components/auth/ConfigProvider';
import { RpcClient } from '@/lib/rpc/RpcClient';
import { displayCurrency } from '@/utils/currency';
import { formatTimestamp } from '@/utils/datetime';
import { formatDateTimeWithTZ } from '@/utils/validation';
import { useEscrowMaturities, usePayoutAmounts } from '@/hooks/useEscrowReads';
import { annualisedYield, daysUntil, hoursUntil, looksWithdrawable, needsOpening, offerStatusLabel } from '@/utils/marketplace';
import type { OfferView } from '@/types/marketplace';

interface MyOffersListProps {
  lpAddress?: string;
}

/**
 * An LP's own offers (MARKETPLACE_OPENSPEC §15.6d, §15.6f).
 *
 * ⚠️ HOUSEKEEPING IS LAZY, AND NOTHING ON-CHAIN NOTIFIES ANYONE. Expiry, rejection, staleness
 *    after someone else's acceptance, and dispute-triggered withdrawability all become true
 *    silently — expiry emits no event at all, and an acceptance elsewhere emits an event about a
 *    *different* vault. If this screen does not notice and say so, an LP whose capital is
 *    recoverable simply never recovers it.
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

  /**
   * Whether each residual-bearing escrow has actually paid out.
   *
   * ⚠️ THE CONTRACT REFUSES BEFORE THIS. `releaseHoldback` reverts with `EscrowNotSettled`
   *    unless `escrow.isClaimed()`, so offering the control earlier is offering a guaranteed
   *    revert — the user pays gas to be told no. Settlement is escrow state, not a marketplace
   *    event, so no amount of indexing can answer it; it has to be read.
   *
   * Keyed by escrow, since several vaults can point at one. Absent means unknown, which keeps
   * the control disabled rather than guessing it is ready.
   */
  const [settled, setSettled] = useState<Record<string, boolean>>({});

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

  // Escrows behind an ACCEPTED offer that still carries a residual — the only rows whose
  // release control could ever be live.
  const residualEscrowKey = useMemo(
    () =>
      Array.from(
        new Set(
          offers
            .filter((o) => o.status === 'ACCEPTED' && !!o.holdback && o.holdback !== '0' && o.escrowContract)
            .map((o) => o.escrowContract as string)
        )
      )
        .sort()
        .join(','),
    [offers]
  );

  // Maturity is the LP's primary risk metric — the remaining dispute window — and it is not on
  // OfferView, because the book indexes the offer while maturity belongs to the escrow under
  // it. Read for every row, not just the ones with a residual.
  const escrowAddresses = useMemo(
    () =>
      Array.from(new Set(offers.map((o) => o.escrowContract).filter(Boolean) as string[])).sort(),
    [offers]
  );

  const { maturities } = useEscrowMaturities(escrowAddresses, config?.rpcUrl);

  // What the LP collects if the offer is accepted and the escrow settles: the escrow's payout,
  // not its gross. Same figure the explorer and the offer modal price against.
  const { payouts } = usePayoutAmounts(escrowAddresses, config?.rpcUrl);

  useEffect(() => {
    if (!config?.rpcUrl || !residualEscrowKey) return;
    let cancelled = false;
    (async () => {
      const client = new RpcClient(config.rpcUrl);
      const entries = await Promise.all(
        residualEscrowKey.split(',').map(async (escrow) => {
          try {
            return [escrow, (await client.getContractState(escrow)).isClaimed] as const;
          } catch (e) {
            // Unknown, not ready. Leaving it absent keeps the control disabled, which costs
            // the user a wait; assuming settled would cost them a reverted transaction.
            console.warn(`MyOffersList: could not read settlement for ${escrow}:`, e);
            return null;
          }
        })
      );
      if (cancelled) return;
      setSettled(Object.fromEntries(entries.filter(Boolean) as (readonly [string, boolean])[]));
    })();
    return () => {
      cancelled = true;
    };
  }, [config?.rpcUrl, residualEscrowKey]);

  useEffect(() => {
    if (!config?.rpcUrl || !pendingKey) return;
    let cancelled = false;
    (async () => {
      const client = new RpcClient(config.rpcUrl);
      const entries = await Promise.all(
        pendingKey.split(',').map(async (pair) => {
          const [vault, token] = pair.split(':');
          try {
            return [vault, (await client.getVaultDeposit(vault, token)).toString()] as const;
          } catch (e) {
            // An unreadable balance is not evidence of an empty vault — leave it absent so
            // the UI stays silent rather than claiming there is nothing to recover.
            console.warn(`MyOffersList: could not read the deposit in ${vault}:`, e);
            return null;
          }
        })
      );
      if (cancelled) return;
      setDeposits(Object.fromEntries(entries.filter(Boolean) as (readonly [string, string])[]));
    })();
    return () => {
      cancelled = true;
    };
  }, [config?.rpcUrl, pendingKey]);

  const act = async (vault: string, action: () => Promise<unknown>) => {
    setBusyVault(vault);
    setActionError(null);
    try {
      await action();
      await refetch();
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
                deposits[offer.vaultAddress] != null
                  ? { ...offer, depositedAmount: deposits[offer.vaultAddress] }
                  : offer
              }
              tokenSymbol={tokenSymbol}
              escrowSettled={offer.escrowContract ? settled[offer.escrowContract] : undefined}
              maturity={offer.escrowContract ? maturities[offer.escrowContract] : undefined}
              payout={offer.escrowContract ? payouts[offer.escrowContract] : undefined}
              busy={busyVault === offer.vaultAddress}
              onWithdraw={() => act(offer.vaultAddress, () => withdrawOffer(offer.vaultAddress))}
              onOpen={() =>
                act(offer.vaultAddress, async () => {
                  // Unlike the wallet actions, this one reports failure in its result rather
                  // than throwing — so it has to be raised here or `act` would treat a
                  // refused open as a success and quietly re-render the same stuck row.
                  const result = await openFundedOffer(offer.vaultAddress);
                  if (!result.success) {
                    throw new Error(result.error || 'The offer could not be opened.');
                  }
                })
              }
              onRelease={() => act(offer.vaultAddress, () => releaseHoldback(offer.vaultAddress))}
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
  escrowSettled,
  maturity,
  payout,
  busy,
  onWithdraw,
  onRelease,
  onOpen
}: {
  offer: OfferView;
  tokenSymbol: string;
  /** undefined = not read yet. Only `true` unlocks the release. */
  escrowSettled?: boolean;
  /** Unix seconds. undefined = not read; never rendered as an epoch date. */
  maturity?: number;
  /** What the escrow pays at maturity. undefined = not read. */
  payout?: bigint;
  busy: boolean;
  onWithdraw: () => void;
  onRelease: () => void;
  onOpen: () => void;
}) {
  // "Live" means capital is committed to this position and its return is still in play:
  // standing, or accepted and waiting on the escrow. A withdrawn or declined offer has no
  // yield to quote, and quoting one would suggest money is still working.
  const isLive =
    (offer.status === 'OPEN' && !offer.expired) || offer.status === 'ACCEPTED';
  const deposit = BigInt(offer.offerAmount || '0');
  const daysLeft = maturity !== undefined ? daysUntil(maturity) : null;
  const effectiveYield =
    isLive && payout !== undefined && daysLeft !== null
      ? annualisedYield(deposit, payout, daysLeft)
      : null;

  const withdrawable = looksWithdrawable(offer);
  const hasResidual = !!offer.holdback && offer.holdback !== '0';
  // ⚠️ ONLY `true` UNLOCKS IT. `releaseHoldback` reverts with EscrowNotSettled until the escrow
  //    has paid out, so enabling this on an unread state trades a wait for a paid-for revert.
  const releasable = offer.status === 'ACCEPTED' && hasResidual && escrowSettled === true;
  // A deposit that landed while the offer never opened. The money is in the vault and the
  // seller cannot see it — one relayed call fixes it, and no transfer is involved.
  const openable = needsOpening(offer);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {displayCurrency(offer.offerAmount ?? 0, 'microUSDC')} {tokenSymbol}{' '}
            {/*
              Once accepted the money has moved — it left the vault for the seller in the same
              transaction that handed over the cashflow. Still calling it "offered" describes a
              bid that is no longer outstanding, on the one row where the LP is looking for
              confirmation that their capital actually went.
            */}
            {offer.status === 'ACCEPTED' ? 'paid' : 'offered'}
          </div>
          <div className="text-xs font-mono text-gray-400 dark:text-secondary-500 mt-0.5 truncate">
            escrow {offer.escrowContract}
          </div>
          <div className="text-xs text-gray-500 dark:text-secondary-400 mt-1">
            {offer.status === 'OPEN' && !offer.expired && offer.offerExpiry ? (
              <>Standing — lapses in {hoursUntil(offer.offerExpiry)}h</>
            ) : (
              offerStatusLabel(offer)
            )}
            {offer.lastEventAt ? ` · last activity ${formatTimestamp(offer.lastEventAt).date}` : ''}
          </div>
          {/*
            Two different clocks, and confusing them is expensive: the offer LAPSES on one date
            and the cashflow MATURES on another. The lapse is above because it is the one with a
            deadline attached; maturity sits on its own line because it is what the capital is
            committed until. Absent rather than an epoch date when the read failed.
          */}
          {maturity !== undefined && (
            <div className="text-xs text-gray-500 dark:text-secondary-400 mt-0.5">
              Cashflow matures {formatDateTimeWithTZ(maturity)}
            </div>
          )}
          {/*
            The two figures that decide whether this position was worth taking: what it pays
            and what that is as a rate. Only while it is live — see isLive. The yield is simple
            rather than compounded, for the reason annualisedYield gives.
          */}
          {isLive && payout !== undefined && (
            <div className="text-xs text-gray-600 dark:text-secondary-300 mt-1">
              Collects{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {displayCurrency(payout.toString(), 'microUSDC')} {tokenSymbol}
              </span>{' '}
              at maturity
              {effectiveYield !== null && (
                <>
                  {' · '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {effectiveYield.toFixed(1)}%
                  </span>{' '}
                  annualised
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {openable && (
            <Button type="button" size="sm" onClick={onOpen} disabled={busy}>
              {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Open this offer'}
            </Button>
          )}
          {withdrawable && (
            <Button type="button" size="sm" onClick={onWithdraw} disabled={busy}>
              {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Withdraw your capital'}
            </Button>
          )}
          {/*
            `releaseHoldback` IS permissionless (§6.7) — the funder and the live beneficiary are
            where the MONEY goes, not who may call, and the note that used to sit here had that
            backwards. BatchClaimScheduler now sweeps settled reserves on a timer, so a residual
            no longer depends on this button being pressed.

            The button stays because the sweep runs every thirty minutes and an LP looking at a
            settled position should not have to wait for it.
          */}
          {offer.status === 'ACCEPTED' && hasResidual && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRelease}
              disabled={busy || !releasable}
            >
              {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Release the residual'}
            </Button>
          )}
        </div>
      </div>

      {openable && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          Your {displayCurrency(offer.depositedAmount!, 'microUSDC')} {tokenSymbol} arrived, but this
          offer was never opened, so no seller can see it. Opening it costs you nothing and moves
          no money — do not send again.
        </p>
      )}

      {withdrawable && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          {offer.status === 'REJECTED'
            ? 'The seller declined this offer. Your capital sits in your vault until you withdraw it — nothing returns it automatically.'
            : offer.status === 'PENDING'
              ? 'This offer lapsed before it was ever opened, and your deposit is still sitting in the vault. Withdraw to get it back — nothing returns it automatically.'
              : 'This offer has lapsed and can no longer be accepted. Withdraw to get your capital back.'}
        </p>
      )}

      {offer.status === 'ACCEPTED' && hasResidual && (
        <p className="text-xs text-gray-500 dark:text-secondary-400 mt-3">
          You are holding {displayCurrency(offer.holdback!, 'microUSDC')} {tokenSymbol} as a residual.{' '}
          {releasable ? (
            <>
              The escrow has paid out, so releasing now returns the residual to the seller and any
              balance to you. Nobody can do this on your behalf.
            </>
          ) : escrowSettled === false ? (
            <>
              It cannot be released until the escrow pays out — the contract refuses before then,
              so the button stays disabled rather than spending your gas to be turned down.
            </>
          ) : (
            <>
              Checking whether the escrow has paid out. Until that is known the release stays
              disabled, because the contract refuses it before settlement.
            </>
          )}
        </p>
      )}
    </div>
  );
}
