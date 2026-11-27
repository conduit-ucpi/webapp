import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Put an escrow on file before its address is handed out for a direct transfer, QR or card.
 *
 * A PURE PROXY, like /api/ap2/settle, and taking the same terms. A transfer lands before settle
 * is ever called; recorded first, contractservice's sweep deploys the escrow onto whatever
 * arrives even if nobody calls settle afterwards. The MCP prepare tool calls this before it
 * offers the transfer route.
 *
 * ⚠️ requiresAuth: false, for the reason /settle is: nothing here moves money, and the record
 *    names only the address the terms themselves derive to.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const required = ['seller', 'token', 'amount', 'external_id'];
  const missing = required.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  // Everything but an authorization: reserving never relays anything.
  const { eip3009: _ignored, ...terms } = req.body;
  return proxyToService(req, res, {
    service: 'ap2',
    path: '/reserve',
    method: 'POST',
    body: terms,
    requiresAuth: false
  });
}
