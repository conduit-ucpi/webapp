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
  'other-wallet-opened',
]);

/** Past this, the page still gets its 204 and no line is written. Per address per hour. */
export const allow = rateLimiter(120, 60 * 60 * 1000);

const matching = (value: unknown, shape: RegExp, fallback: string) =>
  typeof value === 'string' && shape.test(value) ? value : fallback;

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
    console.log(
      `FUNDING EVENT ${event}: contract ${matching(contract, /^[A-Za-z0-9_-]{1,64}$/, 'none')} ` +
        `wallet ${address ? `${address.slice(0, 6)}***${address.slice(-4)}` : 'unknown'} ` +
        `amount ${matching(amount, /^\d{1,12}(\.\d{1,18})?$/, 'unknown')} ` +
        `locale ${matching(locale, /^[A-Za-z0-9_-]{1,35}$/, 'unknown')} ` +
        `country ${matching(country, /^[A-Z]{2}$/, 'unknown')} detail ${cleaned(detail)}`
    );
  }
  res.status(204).end();
}
