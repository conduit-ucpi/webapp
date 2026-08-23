/**
 * The marketplace and arbiter surfaces (MARKETPLACE_OPENSPEC §15.6).
 *
 * These mirror what the two services return. The split behind them is worth keeping in mind
 * while reading: you SEND transactions via chainservice (or your own wallet, funded by it) and
 * you READ state from contractservice. The UI never reads the chain for an offer book, and never
 * asks chainservice for one.
 */

/** Which escrow implementation an address is a clone of. */
export type EscrowCohort = 'MARKETPLACE_CAPABLE' | 'LEGACY' | 'UNKNOWN';

/**
 * The arbiter seat state of one escrow, from `GET /api/chain/contract/{address}/arbiter`.
 *
 * ⚠️ DRIVE THE ARBITER SCREENS OFF THE `can*` FLAGS AND NOTHING ELSE (§15.6c). Show a control
 *    when its flag is true. A legacy escrow returns every flag false, so the correct behaviour
 *    falls out without a special case — do not build legacy-specific UI.
 */
export interface ArbiterState {
  contractAddress: string;
  cohort: EscrowCohort;
  /** null while the seat is empty — a live mid-life state after a sale, not an error. */
  arbiter: string | null;
  seated: boolean;
  /** Whether this escrow has ever been sold, per the ArbiterUnseated event. */
  sold: boolean | null;
  resolvedBuyerPercentage: number | null;
  /** Unix seconds after which `seatDefaultArbiter` becomes callable. */
  nominationDeadline: number | null;
  nominationWindowSeconds: number | null;
  nominatedByBuyer: string | null;
  nominatedByRecipient: string | null;
  /** Matching nominations seat that candidate instantly, in the nominating transaction. */
  nominationsMatch: boolean;
  lastArbiterActionAt: number | null;
  evictableAt: number | null;
  canNominate: boolean;
  canSeatDefaultArbiter: boolean;
  canEvictArbiter: boolean;
  error?: string | null;
}

/**
 * One offer, folded up from its events by contractservice.
 *
 * ⚠️ `PENDING` IS NOT AN OFFER. The vault has been deployed but the LP has not funded it (§5.0).
 *    Never show these in a seller's book: it advertises an offer nobody has committed to.
 *
 * ⚠️ `expired` IS COMPUTED, NOT OBSERVED. An offer lapsing emits no on-chain event, so nothing
 *    will ever arrive to announce it. An OPEN offer with `expired: true` is the LP's cue to
 *    withdraw — and if the UI does not say so, nobody will.
 */
export type OfferStatus = 'PENDING' | 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'RELEASED';

export interface OfferView {
  vaultAddress: string;
  escrowContract: string | null;
  lp: string | null;
  seller: string | null;
  token: string | null;
  /** What the LP deposits, in token units. */
  offerAmount: string | null;
  /**
   * What the vault actually holds right now, in token units — a chain read, not an event.
   *
   * ⚠️ REQUIRED TO MAKE SENSE OF `PENDING`. Funding is a direct transfer, so capital can
   *    arrive without `fund()` opening the offer, and a bare transfer emits NO marketplace
   *    event — nothing in the indexer's event stream witnesses it. Without this field the UI
   *    cannot distinguish a vault nobody funded from one holding an LP's parked deposit, and
   *    so cannot offer either the open or the withdrawal.
   *
   * `null` means the balance was not read, not that it is zero — treat it as unknown and say
   * nothing rather than assert the vault is empty.
   */
  depositedAmount?: string | null;
  /** What the seller receives at acceptance: `offerAmount − fee − holdback` (§8.5a). */
  netAmount: string | null;
  fee: string | null;
  /** Reserve withheld until settlement; it returns to the seller if the cashflow collects in full. */
  holdback: string | null;
  offerExpiry: number | null;
  status: OfferStatus;
  expired: boolean;
  lastEventAt: number;
}

/**
 * A reserve on a position this supplier sold (§6.7).
 *
 * ⚠️ SELLING DOES NOT END THEIR INTEREST, AND EVERY OTHER VIEW ASSUMES IT DOES. `accept()` moves
 *    the recipient role to the LP, so the escrow leaves the seller's list entirely — but they
 *    remain the reserve's funder, and the release pays them. Without this view they never learn.
 */
export type ReserveState = 'LIVE' | 'DISPUTED' | 'SETTLED' | 'RESOLVED' | 'RELEASED' | 'UNKNOWN';

export interface ReserveView {
  vaultAddress: string;
  escrowContract: string | null;
  /** The LP holding the position the reserve rides on. */
  lp: string | null;
  token: string | null;
  /** The reserve as agreed at the sale — the ceiling on what can come back. */
  holdback: string;
  state: ReserveState;
  /**
   * What comes back to the supplier, in token units.
   *
   * ⚠️ PROVISIONAL WHILE `LIVE`: the buyer can dispute right up to maturity, so this is the
   *    outcome if nothing further happens, not an amount owed. Say so when rendering it.
   *
   * ⚠️ NULL WHILE `DISPUTED` OR `UNKNOWN`, and no figure may be substituted. The split turns on
   *    votes that have not matched, or on an escrow nobody could read — a number would be a
   *    guess about the supplier's money.
   */
  dueBack: string | null;
  /** Whether the vault would accept a release now. Advisory — the vault re-checks. */
  releasable: boolean;
  /** When the contract matures, i.e. when the dispute window closes. */
  maturity: number | null;
  /** The buyer's share of a resolved dispute, 0-100. Null when never disputed. */
  resolvedBuyerPercentage: number | null;
  lastEventAt: number;
}

export interface OfferBookResponse {
  escrowContract: string;
  offers: OfferView[];
  /** When this escrow was last checked against the chain — "no offers" vs "none as of an hour ago". */
  lastReconciledAt: number | null;
}

/** An escrow an LP could bid on. Discovery only — the chain gates whether an offer may be made. */
export interface SellableEscrow {
  escrowContract: string;
  contractId: string | null;
  /** Current recipient, read from the chain. After a sale this is the LP who bought it. */
  seller: string | null;
  buyer: string | null;
  token: string | null;
  amount: string | null;
  /** Unix seconds. Time to maturity is the LP's primary risk metric — it is the remaining dispute window. */
  maturity: number;
  description: string | null;
  productName: string | null;
  currencySymbol: string;
  openOffers: number;
  previouslySold: boolean;
  /** A reserve that travels with the position: the next buyer becomes its beneficiary (§5.3). */
  existingHoldback: string | null;
  existingHoldbackFunder: string | null;
}

export interface SellableEscrowsResponse {
  escrows: SellableEscrow[];
  candidatesConsidered: number;
  /** Escrows whose chain state could not be read. Non-zero means incomplete, not empty. */
  unreadable: number;
}

export interface MarketplaceRefreshResponse {
  success: boolean;
  escrowsReconciled: number;
  eventsFound: number;
  error?: string | null;
}

export interface CreateOfferResponse {
  success: boolean;
  /** The vault the LP must then fund from their own wallet. Creation moved no money. */
  vaultAddress?: string | null;
  transactionHash?: string | null;
  error?: string | null;
  /**
   * Whether the resulting events reached contractservice's durable store.
   *
   * ⚠️ `false` DOES NOT MEAN THE ACTION FAILED — it landed on-chain regardless. It means the
   *    offer will not appear in any offer book until a refresh covers its block. Say that,
   *    rather than inviting a retry: retrying makes a second offer and commits more capital.
   */
  indexed?: boolean;
}

/**
 * An offer chainservice reports as standing right now.
 *
 * ⚠️ THIS IS THE FRESHER ANSWER, and deliberately a different source from the offer book.
 *    chainservice deploys the vault and relays `fund()`, so it knows both transitions the
 *    moment they happen and serves them from its own cache — no block scan, no waiting for a
 *    reconcile to carry them into contractservice. The book remains the record of what has
 *    HAPPENED (accepted, withdrawn, settled); this is the answer to what is standing NOW.
 */
export interface LiveOffer {
  vaultAddress: string;
  escrowContract: string;
  lp: string;
  seller: string;
  token: string;
  /** PENDING (deployed, unfunded) or OPEN (funded and standing). */
  status: 'PENDING' | 'OPEN';
  offerAmount: string;
  netAmount: string;
  fee: string;
  holdback: string;
  offerExpiry: number;
}

/**
 * ⚠️ AN ESCROW ABSENT FROM `offers` IS UNKNOWN, NEVER "NO OFFERS" — it is in `unreadable`.
 *    Telling a seller nobody has bid, when the truth is that nothing could be read, is the
 *    one error this shape exists to prevent.
 */
export interface LiveOffersResponse {
  offers: Record<string, LiveOffer[]>;
  unreadable: string[];
}
