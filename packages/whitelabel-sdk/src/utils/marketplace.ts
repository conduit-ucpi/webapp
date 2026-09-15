import type { OfferView, SellableEscrow } from '@/types/marketplace';

/**
 * Small shared rules for the marketplace screens (MARKETPLACE_OPENSPEC §15.6d).
 *
 * These live together because getting one of them subtly wrong on one screen and right on another
 * is how two views of the same offer come to disagree.
 */

/**
 * What an LP actually funds and pays, from the two rates they quote.
 *
 * The rates do different jobs and compound in this order (§5.3, invoice-factoring semantics:
 * "the LP advances part of the agreed price and retains a holdback"):
 *
 *   residual — the share of the cashflow NOT being advanced against
 *   discount — the price paid for the share that IS
 *
 * So 100 at a 10% residual is 90 funded, and a 10% discount on that is 81 deposited. Applying
 * the discount to the gross and taking the residual out of the resulting offer — which is what
 * the modal did — charges the LP for cashflow they are not advancing against, and makes the two
 * percentages read as though they act on the same number.
 *
 * Integer arithmetic in base units. Basis points keep it exact rather than round-tripping
 * through a float and paying out a dust discrepancy, and `residual` is derived by subtraction
 * so the two parts always sum back to the cashflow whatever the rounding did.
 */
export function priceOffer(
  cashflow: bigint,
  discountRate: number,
  residualRate: number
): { funded: bigint; residual: bigint; offer: bigint } {
  const remaining = (rate: number) => BigInt(Math.round((100 - rate) * 100));

  const funded = cashflow > BigInt(0)
    ? (cashflow * remaining(residualRate)) / BigInt(10_000)
    : BigInt(0);
  const offer = funded > BigInt(0)
    ? (funded * remaining(discountRate)) / BigInt(10_000)
    : BigInt(0);

  return { funded, residual: cashflow - funded, offer };
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
  escrow: Pick<SellableEscrow, 'description'>,
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
  return offers.filter((offer) => offer.status === 'OPEN' && !offer.expired);
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
