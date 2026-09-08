import { UserIdentity } from '@/lib/server/coinbaseCdp';

/**
 * Server-side rules for the Coinbase offramp (cash out).
 *
 * The offramp is a two-part handshake and this file owns the awkward half.
 * Coinbase's widget only CREATES a sell order; it never pulls the crypto. The app
 * has to read the order back, learn the Coinbase-managed address, and send the
 * tokens itself — inside a 30 minute window that starts when the user clicks
 * "Cash out now".
 */

/** Coinbase expires a sell order 30 minutes after the user confirms it. */
export const OFFRAMP_WINDOW_MS = 30 * 60 * 1000;

/**
 * The id Coinbase files a user's sell orders under.
 *
 * Derived from the server's identity lookup, never from the request body: the
 * same ref is the lookup key for "show me this user's orders", so accepting a
 * client-supplied one would let anyone read anyone else's cash-out history.
 * Coinbase caps it at 50 characters — both branches here are well inside that.
 */
export function partnerUserRefFor(identity: UserIdentity): string | null {
  return identity.userId || identity.walletAddress || null;
}

/** One transaction as Coinbase returns it (snake_case, only the fields we use). */
interface CoinbaseAmount {
  currency?: string;
  value?: string;
}

export interface CoinbaseSellTransaction {
  transaction_id?: string;
  status?: string;
  to_address?: string;
  asset?: string;
  network?: string;
  sell_amount?: CoinbaseAmount;
  created_at?: string;
  /** Set once Coinbase has seen our transfer. Its presence means: already sent. */
  tx_hash?: string;
  /**
   * Where Coinbase pays the proceeds: ACH_BANK_ACCOUNT, PAYPAL, FIAT_WALLET,
   * CRYPTO_ACCOUNT, ... Chosen by the user inside the widget, and worth reading
   * back — a CRYPTO_ACCOUNT order does not sell anything, it just moves tokens
   * into their Coinbase balance, which looks identical to a failed cash-out from
   * the outside.
   */
  payment_method?: string;
  /** Fiat the user receives, when the order actually sells. */
  cashout_total?: CoinbaseAmount;
}

/**
 * Coinbase's status strings, minus the prefix it actually sends.
 *
 * The API reference documents the enum as bare values (CREATED, STARTED, …) but
 * the live API returns them prefixed — `TRANSACTION_STATUS_STARTED`. Comparing
 * against the documented spelling silently matches nothing, which is exactly how
 * this shipped broken: every order was filtered out and the UI reported "no
 * cash-out found" while five real orders sat there.
 */
export function normalizeStatus(status: string | undefined): string {
  if (!status) return '';
  return status.replace(/^TRANSACTION_STATUS_/, '');
}

/**
 * Statuses that mean "Coinbase is waiting for the crypto".
 *
 * Observed rather than assumed: a freshly confirmed order arrives as STARTED and
 * decays to FAILED when nothing is sent inside the window, so STARTED is the
 * live state, not a sign that funds were already seen. CREATED is accepted too —
 * it is in the documented enum and would mean the same thing.
 */
const AWAITING_SEND = new Set(['CREATED', 'STARTED']);

/** What the browser gets: camelCase, and only what the send actually needs. */
export interface PendingOfframpOrder {
  transactionId: string;
  toAddress: string;
  asset: string;
  network: string;
  amount: string;
  currency: string;
  createdAt: string;
  expiresAt: string;
  /** Where the proceeds go. The panel refuses to send into a CRYPTO_ACCOUNT. */
  paymentMethod: string;
  /**
   * The fiat Coinbase will pay out, per the order itself rather than per our
   * form. Matters on a cold-load resume, where the page has no idea what the
   * user chose in a session that has since ended.
   */
  fiatCurrency: string;
}

/**
 * The newest order still waiting on us to send crypto, or null.
 *
 * CREATED and STARTED qualify — both mean Coinbase is waiting on the crypto.
 * SUCCESS, FAILED and EXPIRED are done with. What actually protects against
 * sending twice is tx_hash, not the status: Coinbase leaves an order at STARTED
 * for a while after our transfer lands, so status alone would invite a second
 * payment from anyone who reloaded the page in that gap.
 *
 * Age is checked against the same 30 minute window Coinbase enforces, because an
 * order can sit at CREATED forever after timing out: without this an abandoned
 * order from last week would greet the user on /wallet and send real money into a
 * dead deposit address.
 */
export function selectPendingOrder(
  transactions: CoinbaseSellTransaction[],
  now: number
): PendingOfframpOrder | null {
  const candidates = transactions
    .filter(tx => AWAITING_SEND.has(normalizeStatus(tx.status)))
    // A recorded tx_hash means Coinbase has already seen our transfer. Sending
    // again would be a second, unrefunded payment — the one mistake here that
    // costs the user real money, so it is checked before anything else.
    .filter(tx => !tx.tx_hash)
    .filter(tx => !!tx.to_address && !!tx.created_at && !!tx.sell_amount?.value)
    .map(tx => ({ tx, createdMs: Date.parse(tx.created_at!) }))
    .filter(({ createdMs }) => Number.isFinite(createdMs))
    // Only an upper bound on age. There is deliberately no "not in the future"
    // check: Coinbase's clock and ours can disagree by seconds, and dropping a
    // live order over skew would strand the user with no way to finish.
    .filter(({ createdMs }) => now - createdMs < OFFRAMP_WINDOW_MS)
    .sort((a, b) => b.createdMs - a.createdMs);

  const newest = candidates[0];
  if (!newest) return null;

  const { tx, createdMs } = newest;
  return {
    transactionId: tx.transaction_id || '',
    toAddress: tx.to_address!,
    asset: tx.asset || tx.sell_amount?.currency || '',
    network: tx.network || '',
    amount: tx.sell_amount!.value!,
    currency: tx.sell_amount?.currency || tx.asset || '',
    createdAt: tx.created_at!,
    expiresAt: new Date(createdMs + OFFRAMP_WINDOW_MS).toISOString(),
    paymentMethod: tx.payment_method || '',
    fiatCurrency: tx.cashout_total?.currency || '',
  };
}

/** Shape of GET /onramp/v1/sell/options, trimmed to what we read. */
export interface CoinbaseSellOptions {
  cashout_currencies?: Array<{
    id?: string;
    limits?: Array<{ id?: string; min?: string; max?: string }>;
  }>;
}

/** Where the money ends up, once Coinbase has sold the tokens. */
export interface PayoutRoute {
  /** The value to pass as defaultCashoutMethod. */
  method: string;
  /** True only when the proceeds land in a bank, not a Coinbase balance. */
  reachesBank: boolean;
}

/**
 * The best payout Coinbase offers for a currency, given its available methods.
 *
 * Verified against the live API: US/USD offers FIAT_WALLET and ACH_BANK_ACCOUNT;
 * everywhere else, and every other currency, offers FIAT_WALLET alone. So "cash
 * out to your bank" is a US-only proposition and the UI must not promise it
 * elsewhere — outside the US the money reaches the user's Coinbase cash balance
 * and withdrawing it onward is a separate step they take in Coinbase.
 *
 * CRYPTO_ACCOUNT is never chosen: it performs no sale at all, just moving tokens
 * into the user's Coinbase balance, which is the failure this whole function
 * exists to stop happening by accident.
 */
export function payoutRouteFor(methods: string[]): PayoutRoute | null {
  if (methods.includes('ACH_BANK_ACCOUNT')) {
    return { method: 'ACH_BANK_ACCOUNT', reachesBank: true };
  }
  if (methods.includes('FIAT_WALLET')) {
    return { method: 'FIAT_WALLET', reachesBank: false };
  }
  // Anything left is a route we will not steer a user into unprompted.
  return null;
}
