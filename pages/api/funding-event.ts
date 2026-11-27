import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';
import { extractAuthToken } from '@/utils/api-auth';
import { fetchIdentity } from '@/lib/server/coinbaseCdp';

/**
 * A step in adding funds that happens only in the browser, as one log line: Privy's funding window
 * and the routes that pay from another wallet. Without this, Grafana sees none of them.
 *
 * 👤 WHO IT WAS comes from the session, not the body: each line names the signed-in user by their
 *    id and the wallet on their account (masked), as the user service has them. The body's
 *    `wallet` is what the step was about (the buyer's wallet, or a payment's own address), as
 *    the page reported it. A signed-in user may log 600 lines an hour; a request with no session
 *    (the signed-out guide on /buy-token is the one page that sends them) is still logged, as
 *    `user signed-out`, but only 30 an hour from one address.
 *
 * ⚠️ IT PROVES LITTLE. The steps are what a browser reported, never that money moved. That is
 *    Coinbase's or the provider's record, and the chain's. Nothing reads these lines to make a
 *    decision, and nothing should.
 *
 * Every field is checked or cleaned before it reaches the log, so a caller cannot forge log lines,
 * and an address is logged in the masked form the Kotlin services use, so the two can be matched.
 *
 * 📍 WHERE THE VISITOR IS comes from Cloudflare, read here from the request headers, not from the
 *    body. api.stabledrop.me is behind Cloudflare, which stamps `cf-ipcountry` on every request and,
 *    with the "Add visitor location headers" managed transform on, `cf-region-code` (the state or
 *    province, ISO 3166-2) as well. A header the browser cannot set beats a field it can. The body's
 *    `country` (the page's own /cdn-cgi/trace answer, also Cloudflare's) is only the fallback for a
 *    request that did not come through the proxy, such as a direct hit on the origin or localhost.
 */

export const config = {
  api: { bodyParser: { sizeLimit: '2kb' } },
};

const EVENTS = new Set([
  'privy-started',
  'privy-completed',
  'privy-processing',
  'privy-cancelled',
  'privy-failed',
  'transfer-opened',
  'kraken-opened',
  'link-opened',
  'other-wallet-opened',
  // Which way of paying the buyer opened: provider "card" or "crypto".
  'choice-opened',
  // Coinbase's window into the payment or the wallet (route), and the buyer closing it.
  'coinbase-opened',
  'coinbase-closed',
  // A link out to a card service or an exchange in the lists (provider = its name).
  'card-service-opened',
  'exchange-opened',
  // "Check my balance" pressed (detail: what the page then saw), and "I have paid" pressed.
  'balance-checked',
  'paid-pressed',
  // The wallet's balance rose while the page was open: amount is the rise, provider the last option opened.
  'wallet-funded',
  // The page reading the balance by itself every 30s after Privy said "processing" (detail: what it saw).
  'balance-polled',
  // The page looking at the payment's own address on its schedule (wallet: that address; detail: what it saw).
  'address-polled',
  // The help shown when a purchase does not go through (FundingTrouble): which kind was shown
  // (detail: cancelled, failed, stuck, returned), the reason the buyer tapped, and what they did next.
  'trouble-shown',
  'trouble-reason',
  'trouble-action',
]);

/** A provider's name as the page lists it (MoonPay, Crypto.com, Onramp.money) or our own word for one. */
const PROVIDER = /^[A-Za-z0-9][A-Za-z0-9 .()-]{0,39}$/;
const ROUTE = /^(payment|wallet)$/;

/**
 * Past these, the page still gets its 204 and no line is written. A buyer's page logs each of its
 * own balance checks (about 25 on the payment's address over its first seven minutes, two a minute
 * on the wallet while a purchase is under way), and a buyer having trouble reloads: the lines that
 * matter most are the struggling buyer's, so a signed-in user has plenty of room. Per user, and
 * for no session per address, both per hour.
 */
export const allowUser = rateLimiter(600, 60 * 60 * 1000);
export const allowSignedOut = rateLimiter(30, 60 * 60 * 1000);
/**
 * Before the session is looked up at all, per address per hour: far above anything one connection
 * of real buyers sends, so it only stops made-up tokens being used to hammer the user service.
 */
export const allowLookup = rateLimiter(3000, 60 * 60 * 1000);

const matching = (value: unknown, shape: RegExp, fallback: string) =>
  typeof value === 'string' && shape.test(value) ? value : fallback;

/** The first value of a request header, or undefined. */
const header = (req: NextApiRequest, name: string): string | undefined => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const COUNTRY = /^[A-Z]{2}$/;
/** ISO 3166-2 subdivision code: TX, ENG, 75, ... Cloudflare sends it upper-case. */
const REGION = /^[A-Z0-9]{1,3}$/;

/** The provider's words, which may be useful and are not ours: one line, short, and no emails. */
function cleaned(detail: unknown): string {
  if (typeof detail !== 'string') return '""';
  const text = detail
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/[^\s@]+@[^\s@]+/g, '[email]')
    .slice(0, 200);
  return JSON.stringify(text);
}

const masked = (address: string) => `${address.slice(0, 6)}***${address.slice(-4)}`;

/** The signed-in user, by id and masked wallet, as the user service has them; null with no session. */
async function sessionUser(req: NextApiRequest): Promise<{ id: string; wallet: string } | null> {
  const token = extractAuthToken(req);
  if (!token) return null;
  const identity = await fetchIdentity(req, token);
  if (!identity?.userId) return null;
  const wallet = identity.walletAddress && /^0x[0-9a-fA-F]{40}$/.test(identity.walletAddress) ? masked(identity.walletAddress) : 'no-wallet';
  return { id: identity.userId, wallet };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { event, contract, wallet, amount, locale, country, detail, provider, route } = req.body ?? {};
  if (typeof event !== 'string' || !EVENTS.has(event)) {
    return res.status(400).json({ error: 'Unknown funding event' });
  }
  // Answered before the session is looked up: nothing on the page waits on the log.
  res.status(204).end();

  if (!allowLookup(clientAddress(req))) return;
  const user = await sessionUser(req);
  if (user ? !allowUser(user.id) : !allowSignedOut(clientAddress(req))) return;
  const address = matching(wallet, /^0x[0-9a-fA-F]{40}$/, '');
  // Cloudflare's XX means "no country data"; treat it as absent so the body fallback applies.
  const cfCountry = header(req, 'cf-ipcountry');
  const seenCountry = cfCountry && cfCountry !== 'XX' ? cfCountry : country;
  console.log(
    `FUNDING EVENT ${event}: contract ${matching(contract, /^[A-Za-z0-9_-]{1,64}$/, 'none')} ` +
      `user ${user ? `${user.id} (${user.wallet})` : 'signed-out'} ` +
      `wallet ${address ? masked(address) : 'unknown'} ` +
      `amount ${matching(amount, /^\d{1,12}(\.\d{1,18})?$/, 'unknown')} ` +
      `locale ${matching(locale, /^[A-Za-z0-9_-]{1,35}$/, 'unknown')} ` +
      `country ${matching(seenCountry, COUNTRY, 'unknown')} ` +
      `region ${matching(header(req, 'cf-region-code'), REGION, 'unknown')} ` +
      `provider ${JSON.stringify(matching(provider, PROVIDER, 'unknown'))} route ${matching(route, ROUTE, 'unknown')} ` +
      `detail ${cleaned(detail)}`
  );
}
