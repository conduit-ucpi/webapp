import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard } from '@/lib/server/serviceProxy';
import { clientAddress, rateLimiter } from '@/lib/server/publicFormLimit';

/**
 * Coinbase sent a buyer back to /onramp-return: one log line, the other half of
 * COINBASE ONRAMP STARTED. The page is static, so nothing else records it.
 *
 * ⚠️ PUBLIC, AND IT PROVES LITTLE. Coinbase also comes here after a cancel, and anyone can call this.
 *    A line means "came back or was called", never that anything was bought. Whether money moved
 *    is Coinbase's transaction record and the chain's to say.
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
  const { contract } = req.query;
  const id = typeof contract === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(contract) ? contract : 'none';
  if (allow(clientAddress(req))) {
    console.log(`COINBASE ONRAMP RETURNED: contract ${id}`);
  }
  res.status(204).end();
}
