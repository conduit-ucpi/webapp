import type { OfferView, SellableEscrow } from '@/types/marketplace';

/**
 * Small shared rules for the marketplace screens (MARKETPLACE_OPENSPEC §15.6d).
 *
 * These live together because getting one of them subtly wrong on one screen and right on another
 * is how two views of the same offer come to disagree.
 */

/**
 * What an LP deposits, and how that deposit splits, from the two rates they quote.
 *
 * Both rates are shares of the CASHFLOW, and they do different jobs:
 *
 *   discount — the LP's return. They deposit the cashflow less this, and collect the
 *              cashflow in full at maturity, so the discount IS the profit.
 *   residual — a slice of that deposit withheld from the supplier at acceptance and paid to
 *              them at maturity instead. It does not change what the supplier ends up with,
 *              only when they get it and on what condition.
 *
 * So $100 at a 10% discount is $90 deposited; a 10% residual holds $10 of that back, the
 * supplier takes $80 less the fee now and the $10 at maturity, and the LP collects $100.
 *
 * This mirrors the contracts exactly, which is why it needs none of them changed:
 * `offerAmount` is the deposit, `holdback` is the residual, and
 * `netAmount = offerAmount − fee − holdback` is what the supplier sees at acceptance
 * (OfferVaultFactory._quote). `releaseHoldback` pays the residual to the original supplier
 * once the escrow settles clean.
 *
 * Integer arithmetic in base units; basis points keep it exact rather than round-tripping
 * through a float and paying out a dust discrepancy.
 */
export function priceOffer(
  cashflow: bigint,
  discountRate: number,
  residualRate: number
): { offer: bigint; residual: bigint; supplierNow: bigint } {
  const share = (rate: number) => BigInt(Math.round(rate * 100));

  const offer = cashflow > BigInt(0)
    ? (cashflow * (BigInt(10_000) - share(discountRate))) / BigInt(10_000)
    : BigInt(0);
  const residual = cashflow > BigInt(0)
    ? (cashflow * share(residualRate)) / BigInt(10_000)
    : BigInt(0);

  // Before the venue fee, which the client is not told. Can go negative when the residual
  // outruns the deposit — the caller must refuse that rather than clamp it, because the
  // contract reverts on `fee + holdback > offerAmount`.
  return { offer, residual, supplierNow: offer - residual };
}

/**
 * Annualised yield on a position, as a percentage.
 *
 * Simple (not compounded), which is the convention for discounted receivables and the honest
 * one here: compounding assumes the LP can roll straight into another position at the same
 * rate, and on a venue with a handful of escrows that assumption is usually false. A 30-day
 * 11% return shown as a ~250% APY would be an invented number.
 *
 * Note what does NOT appear: the residual. The LP deposits `offer` and collects the whole
 * cashflow at maturity whatever the residual is — it is withheld from the SUPPLIER, not from
 * the LP. So the residual buys protection (it covers the LP's loss first in a dispute,
 * OfferVault.releaseHoldback) and changes the yield not at all. Only the discount does.
 *
 * Null when it cannot be stated rather than shown as zero or infinity: nothing deposited, or
 * a position at or past maturity, where dividing by the remaining days is meaningless.
 */
export function annualisedYield(
  offer: bigint,
  cashflow: bigint,
  daysToMaturity: number
): number | null {
  if (offer <= BigInt(0) || cashflow <= offer) return null;
  if (!Number.isFinite(daysToMaturity) || daysToMaturity <= 0) return null;

  // Ratio in floating point only after the division, so the bigints carry the precision that
  // matters and the float only ever handles a small dimensionless number.
  const periodReturn = Number(cashflow - offer) / Number(offer);
  return periodReturn * (365 / daysToMaturity) * 100;
}

/**
 * What to call the position being traded.
 *
 * The description, and only the description. `productName` is not a name for
 * the thing an LP is buying: it is set from whatever the integration had to
 * hand — ContractCreatePage fills it with `Order #<id>` for plugin orders and
 * leaves it unset otherwise — so titling rows with it gives a book of order
 * numbers rather than a book of goods.
 *
 * Shared because two screens show this title and they must agree: a row in the
 * explorer and the heading of the offer modal opened from that row.
 */
export function escrowTitle(
  // Structural rather than tied to SellableEscrow: the same position shows up as a
  // SellableEscrow in the explorer and a UnifiedContract on /offers, and both must be titled
  // by the same rule. Anything carrying a description qualifies.
  escrow: { description?: string | null },
  fallback = 'Escrow payment'
): string {
  return escrow.description?.trim() || fallback;
}

/** Whole days from now until a unix timestamp, floored at zero. */
export function daysUntil(unixSeconds: number): number {
  const seconds = unixSeconds - Math.floor(Date.now() / 1000);
  return Math.max(0, Math.ceil(seconds / 86_400));
}

/** Hours remaining until a unix timestamp, floored at zero. */
export function hoursUntil(unixSeconds: number): number {
  const seconds = unixSeconds - Math.floor(Date.now() / 1000);
  return Math.max(0, Math.ceil(seconds / 3_600));
}

/**
 * Offers a seller should actually be shown.
 *
 * ⚠️ `PENDING` IS NOT AN OFFER (§5.0). `createOffer` deploys an empty vault and only the LP's
 *    `fund()` puts capital in it, so showing PENDING vaults in a book would advertise offers
 *    nobody has committed to. A lapsed offer is likewise not standing — the contract will refuse
 *    it, so presenting it as acceptable sets the seller up for a revert.
 */
export function acceptableOffers(offers: OfferView[]): OfferView[] {
  // ⚠️ A SOLD ESCROW OFFERS NOTHING, whatever the losing offers' own status says. Accepting one
  //    offer moves the recipient, and `accept()` checks `recipientNonce()` against the one it
  //    recorded — so every other vault on that escrow now reverts `OfferStale`. Their own event
  //    streams never learn this (nothing on-chain names the loser), so without the escrow's
  //    answer the seller is shown an Accept that costs gas and achieves nothing.
  return offers.filter((offer) => offer.status === 'OPEN' && !offer.expired && !offer.escrowSold);
}

/**
 * Whether an LP can now recover their capital from this vault.
 *
 * ⚠️ NOTHING ON-CHAIN ANNOUNCES ANY OF THESE CONDITIONS (§6.4, §15.2). Expiry is a time
 *    condition the contract evaluates lazily; rejection and someone else's acceptance emit events
 *    about a *different* vault. Withdrawability is therefore something the UI must notice and say
 *    out loud — an LP who is never told simply never withdraws, and their capital sits idle.
 *
 * This is advisory, as every off-chain read is: the vault re-checks on `withdraw()`.
 */
export function looksWithdrawable(offer: OfferView): boolean {
  if (offer.status === 'REJECTED') return true;
  // Losing to another offer is the "staleness after someone else's acceptance" above, and an
  // OPEN offer is withdrawable the moment the sale lands: the vault's own isWithdrawable()
  // reports it via `escrow.recipientNonce() != sellerNonce`. Without this the LP waits out
  // offerExpiry for capital the vault would return today, on an offer that can never be
  // accepted again.
  //
  // ⚠️ OPEN ONLY, to match the vault. Its PENDING branch is `expired && balance > 0` and does
  //    not consult the sale at all, so a PENDING vault on a sold escrow is NOT withdrawable
  //    yet — prompting one would send the LP into a `NothingToWithdraw` revert they pay for.
  if (offer.status === 'OPEN' && offer.escrowSold) return true;
  // A PENDING vault can hold money: funding is a direct transfer, so capital arrives before
  // `fund()` opens the offer — and if that second step never lands, it sits there. The
  // contract lets the LP recover it (partial deposits included) once the offer lapses, but
  // nothing announces that, and omitting it here is what makes the money invisible.
  if (offer.status === 'PENDING') return offer.expired && offerHoldsDeposit(offer);
  return offer.status === 'OPEN' && offer.expired;
}

/**
 * Whether this vault appears to be holding the LP's capital without a live offer.
 *
 * Deliberately conservative: with no balance reading available it says no, because telling
 * an LP to recover a deposit from an empty vault sends them to a transaction that reverts.
 */
export function offerHoldsDeposit(offer: OfferView): boolean {
  return offer.depositedAmount != null && BigInt(offer.depositedAmount) > BigInt(0);
}

/**
 * A deposit landed but the offer never opened — the LP should press "open", not pay again.
 *
 * ⚠️ NOTHING ANNOUNCES THIS EITHER. It is the gap between the two halves of funding, and an
 *    LP who closed the tab mid-flow has no other way to discover their money is parked.
 */
export function needsOpening(offer: OfferView): boolean {
  return offer.status === 'PENDING' && !offer.expired && offerHoldsDeposit(offer);
}

/** Human label for an offer's state, from the LP's point of view. */
export function offerStatusLabel(offer: OfferView): string {
  // Losing to another bid, before lapsing: both end in a withdrawal, but they are different
  // things to be told, and "Standing" beside a withdraw button reads as a bug in the page.
  if (offer.status === 'OPEN' && offer.escrowSold) return 'Not taken — withdraw';
  if (offer.status === 'OPEN' && offer.expired) return 'Lapsed — withdraw';
  switch (offer.status) {
    case 'PENDING':
      // "Not funded" would read the same whether the LP sent nothing or sent everything and
      // the open failed — opposite situations needing opposite actions.
      if (offerHoldsDeposit(offer)) {
        return offer.expired ? 'Deposit parked — withdraw' : 'Deposit received — open it';
      }
      return 'Not funded';
    case 'OPEN':
      return 'Standing';
    case 'ACCEPTED':
      return 'Accepted';
    case 'REJECTED':
      return 'Declined — withdraw';
    case 'WITHDRAWN':
      return 'Withdrawn';
    case 'RELEASED':
      return 'Residual released';
    default:
      return offer.status;
  }
}

/** Formats "last checked against the chain" so a UI can distinguish none from none-lately. */
export function reconciledLabel(lastReconciledAt: number | null | undefined): string {
  if (!lastReconciledAt) return 'Never checked against the chain';
  const minutes = Math.floor((Date.now() / 1000 - lastReconciledAt) / 60);
  if (minutes < 1) return 'Checked against the chain just now';
  if (minutes < 60) return `Checked against the chain ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Checked against the chain ${hours}h ago`;
  return `Checked against the chain ${Math.floor(hours / 24)}d ago`;
}
