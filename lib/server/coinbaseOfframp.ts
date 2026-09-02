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
}

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
}

/**
 * The newest order still waiting on us to send crypto, or null.
 *
 * Only CREATED qualifies. STARTED means Coinbase has already seen funds arrive,
 * and sending again on top of it would be a second, unpaid transfer — the exact
 * mistake a naive "not finished yet" filter makes. SUCCESS, FAILED and EXPIRED
 * are all done with.
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
    .filter(tx => tx.status === 'CREATED')
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
  };
}
