import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';

/**
 * A step in adding funds that happens only in the browser, as one log line: Privy's funding window
 * and the routes that pay from another wallet. Without this, Grafana sees none of them.
 *
 * ⚠️ PUBLIC, AND IT PROVES LITTLE. Anyone can call this and claim anything, so a line says what a
 *    browser reported, never that money moved. That is Coinbase's or the provider's record, and
 *    the chain's. Nothing reads these lines to make a decision, and nothing should.
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
  'privy-cancelled',
  'privy-failed',
  'transfer-opened',
  'kraken-opened',
  'link-opened',
  'other-wallet-opened',
]);

/** Past this, the page still gets its 204 and no line is written. Per address per hour. */
export const allow = rateLimiter(120, 60 * 60 * 1000);

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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { event, contract, wallet, amount, locale, country, detail } = req.body ?? {};
  if (typeof event !== 'string' || !EVENTS.has(event)) {
    return res.status(400).json({ error: 'Unknown funding event' });
  }
  if (allow(clientAddress(req))) {
    const address = matching(wallet, /^0x[0-9a-fA-F]{40}$/, '');
    // Cloudflare's XX means "no country data"; treat it as absent so the body fallback applies.
    const cfCountry = header(req, 'cf-ipcountry');
    const seenCountry = cfCountry && cfCountry !== 'XX' ? cfCountry : country;
    console.log(
      `FUNDING EVENT ${event}: contract ${matching(contract, /^[A-Za-z0-9_-]{1,64}$/, 'none')} ` +
        `wallet ${address ? `${address.slice(0, 6)}***${address.slice(-4)}` : 'unknown'} ` +
        `amount ${matching(amount, /^\d{1,12}(\.\d{1,18})?$/, 'unknown')} ` +
        `locale ${matching(locale, /^[A-Za-z0-9_-]{1,35}$/, 'unknown')} ` +
        `country ${matching(seenCountry, COUNTRY, 'unknown')} ` +
        `region ${matching(header(req, 'cf-region-code'), REGION, 'unknown')} detail ${cleaned(detail)}`
    );
  }
  res.status(204).end();
}
