import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { cdpRequest, fetchIdentity, getCdpCredentials } from '@/lib/server/coinbaseCdp';
import { partnerUserRefFor } from '@/lib/server/coinbaseOfframp';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';

/**
 * How the buyer's Coinbase card purchases stand, as Coinbase records them: one log line, the
 * outcome half of COINBASE ONRAMP STARTED. Asked when the buyer comes back from Coinbase's window
 * (the return page, or on desktop the popup closing, since Coinbase's redirect often never fires),
 * and when they press "check my balance" after trying Coinbase.
 *
 * ⚠️ FOR THE LOG ONLY. The page is answered 204 whatever Coinbase says: nothing reads this to decide
 *    anything, and the balance on the chain is still what says a payment can go ahead.
 *
 * The partnerUserRef is derived from the session, never the request, as pending.ts's is: the CDP
 * key can read any of our users' purchases, so a caller must not choose whose are looked up.
 */

/** Coinbase caps this at 1000; a buyer has a handful at most. */
const PAGE_SIZE = 10;
/** Older than this is not the purchase the buyer just came back from. */
const RECENT_MS = 24 * 60 * 60 * 1000;

/** Per address per hour. Each call costs a Coinbase request, so tighter than the plain log lines. */
export const allow = rateLimiter(30, 60 * 60 * 1000);

const TRIGGERS = new Set(['returned', 'closed', 'balance-checked']);

interface CoinbaseAmount {
  value?: string;
  currency?: string;
}

/** One buy as Coinbase returns it (snake_case, only the fields logged; all optional). */
export interface CoinbaseBuyTransaction {
  transaction_id?: string;
  status?: string;
  purchase_currency?: string;
  purchase_network?: string;
  purchase_amount?: CoinbaseAmount;
  payment_total?: CoinbaseAmount;
  payment_method?: string;
  tx_hash?: string;
  created_at?: string;
  completed_at?: string;
  failure_reason?: string;
}

const shaped = (value: unknown, pattern: RegExp, fallback: string) =>
  typeof value === 'string' && pattern.test(value) ? value : fallback;

/** The user ref as the log shows it: a wallet (the ref's fallback) masked as the Kotlin services mask one. */
const loggedUser = (ref: string) =>
  /^0x[0-9a-fA-F]{40}$/.test(ref) ? `${ref.slice(0, 6)}***${ref.slice(-4)}` : shaped(ref, /^[A-Za-z0-9_-]{1,64}$/, 'unknown');

/** One of Coinbase's own words, kept to one short line for the log. */
const word = (value: unknown) =>
  typeof value === 'string' ? value.replace(/[^\x20-\x7E]+/g, ' ').slice(0, 120) : undefined;

const amount = (value: CoinbaseAmount | undefined) =>
  value?.value ? `${word(value.value)} ${word(value.currency) ?? ''}`.trim() : undefined;

/** The purchases worth logging: recent ones, newest first, with the status shorn of its prefix. */
export function recentPurchases(transactions: CoinbaseBuyTransaction[], now: number) {
  return transactions
    .filter((tx) => !tx.created_at || now - Date.parse(tx.created_at) < RECENT_MS)
    .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''))
    .map((tx) => ({
      id: word(tx.transaction_id),
      status: word(tx.status)?.replace(/^ONRAMP_TRANSACTION_STATUS_/, ''),
      amount: amount(tx.purchase_amount),
      paid: amount(tx.payment_total),
      network: word(tx.purchase_network),
      method: word(tx.payment_method),
      sent: !!tx.tx_hash,
      failure: word(tx.failure_reason),
      createdAt: word(tx.created_at),
      completedAt: word(tx.completed_at),
    }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.status(204).end();

  const contract = shaped(req.query.contract, /^[A-Za-z0-9_-]{1,64}$/, 'none');
  const trigger = typeof req.query.trigger === 'string' && TRIGGERS.has(req.query.trigger) ? req.query.trigger : 'unknown';
  if (!allow(clientAddress(req))) return;

  const credentials = getCdpCredentials();
  if (!credentials) return;
  let authToken: string;
  try {
    authToken = requireAuth(req);
  } catch {
    console.log(`COINBASE ONRAMP STATUS: contract ${contract} trigger ${trigger} unknown (signed out)`);
    return;
  }
  try {
    const identity = await fetchIdentity(req, authToken);
    const partnerUserRef = identity ? partnerUserRefFor(identity) : null;
    if (!partnerUserRef) {
      console.log(`COINBASE ONRAMP STATUS: contract ${contract} trigger ${trigger} unknown (no session)`);
      return;
    }
    const path = `/onramp/v1/buy/user/${encodeURIComponent(partnerUserRef)}/transactions`;
    const response = await cdpRequest({ credentials, method: 'GET', path, query: { pageSize: String(PAGE_SIZE) } });
    const text = await response.text();
    if (!response.ok) {
      console.error('COINBASE ONRAMP STATUS lookup failed:', { status: response.status, body: text.substring(0, 300) });
      return;
    }
    const purchases = recentPurchases((JSON.parse(text) as { transactions?: CoinbaseBuyTransaction[] }).transactions ?? [], Date.now());
    console.log(
      `COINBASE ONRAMP STATUS: user ${loggedUser(partnerUserRef)} contract ${contract} ` +
        `trigger ${trigger} latest ${purchases[0]?.status ?? 'none'} purchases ${JSON.stringify(purchases)}`
    );
  } catch (error) {
    console.error('COINBASE ONRAMP STATUS lookup failed:', error instanceof Error ? error.message : String(error));
  }
}
