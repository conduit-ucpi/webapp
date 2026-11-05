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
 */

export const config = {
  api: { bodyParser: false },
};

/** Past this, the page still gets its 204 and no line is written. Per address per hour. */
export const allow = rateLimiter(120, 60 * 60 * 1000);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const { id } = req.query;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: 'A contract id is required' });
  }
  if (allow(clientAddress(req))) {
    console.log(`PAYMENT LINK OPENED: contract ${id}`);
  }
  res.status(204).end();
}
