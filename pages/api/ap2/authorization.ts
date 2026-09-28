import { NextApiRequest, NextApiResponse } from 'next';

import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The EIP-3009 authorization a payer signs to fund an escrow, complete and ready for a wallet.
 *
 * A PURE PROXY, like /api/ap2/parties/resolve. ap2service reads the token's EIP-712 domain off
 * the chain (through chainservice) and adds a validity window and a fresh nonce, so neither the
 * MCP tools nor the /pay page assembles a domain of its own.
 *
 * ⚠️ requiresAuth: false, for the same reason /settle is. Nothing here signs or moves anything:
 *    the payer's own wallet signs, and /settle refuses the signature unless its destination is
 *    the address the escrow's terms derive to.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  const { token_address, payer, to, value, valid_for_seconds } = req.body ?? {};
  const missing = Object.entries({ token_address, payer, to, value })
    .filter(([, v]) => v === undefined || v === null)
    .map(([k]) => k);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  return proxyToService(req, res, {
    service: 'ap2',
    path: '/authorization',
    method: 'POST',
    body: { token_address, payer, to, value, valid_for_seconds },
    requiresAuth: false
  });
}
