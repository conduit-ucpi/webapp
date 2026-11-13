import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';

/**
 * Someone opened the /contract-pay link for this request: one log line, so Grafana can answer "did
 * anybody ever try to pay this?", including for visitors who never sign in.
 *
 * ⚠️ PUBLIC, AND IT PROVES LITTLE. Anyone can call this with any id, and it does not check the
 *    contract exists, so a line means "the page was opened or this was called", never that a
 *    payment was attempted. That is safe because all it does is write a line: it reads nothing,
 *    stores nothing and answers the same 204 for every valid id, so it cannot be used to test
 *    whether a contract exists. A made-up id's line only ever matches a search for that id.
 *
 * The id's shape is checked before it reaches the log, so a caller cannot forge log lines.
 *
 * The line also says what opened it: the browser's User-Agent, and whether the page was inside a
 * frame (a partner's site). Added 13 Nov 2026 to find out why a tester was asked to sign in on
 * every link: an in-app browser (WhatsApp, Instagram) and a partner's frame both forget a login,
 * and nothing else in the logs says which a visitor was in. Both are the caller's word, cleaned
 * the same way as the id: printable ASCII only, and cut short.
 */

export const config = {
  api: { bodyParser: false },
};

/** Past this, the page still gets its 204 and no line is written. Per address per hour. */
export const allow = rateLimiter(120, 60 * 60 * 1000);

/** A header as it may go in a log line: no control characters or quotes, and not long. */
function loggable(value: string | string[] | undefined): string {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return 'unknown';
  return text.replace(/[^\x20-\x7E]|"/g, '?').slice(0, 240);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { id } = req.query;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'A contract id is required' });
  }
  if (allow(clientAddress(req))) {
    const { framed } = req.query;
    const where = framed === '1' ? 'yes' : framed === '0' ? 'no' : 'unknown';
    console.log(`PAYMENT LINK OPENED: contract ${id} framed ${where} agent "${loggable(req.headers['user-agent'])}"`);
  }
  res.status(204).end();
}
