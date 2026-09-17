import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * Create a non-custodial escrow around a payment, with a dispute window, and attest to it.
 *
 * A PURE PROXY. Every decision lives in ap2service; re-checking anything here would be a
 * second implementation of the thing that decides whether money moves.
 *
 * ⚠️ requiresAuth: false, and no credential of any kind is required — deliberately.
 *
 *    The terms a caller sends ARE the escrow's address: token, buyer, seller, amount, maturity,
 *    arbiter and externalId are the CREATE2 salt. The payer's EIP-3009 signature names that
 *    address as the destination of their own tokens, and ap2service refuses any request whose
 *    terms derive to somewhere else. So a caller who alters any field moves the address and
 *    stops matching the signature — one check covers every input, which is why none of them
 *    need to arrive from a trusted place.
 *
 *    Nothing here can move money that was not already authorised by whoever owns it.
 *
 * ⚠️ What IS ours is gas, on the transfer we relay for a payer who holds none. ap2service runs
 *    a gasless preflight before writing or spending anything — payer balance, authorization
 *    nonce, validity window — so a transfer the chain would reject costs nothing to refuse.
 *    Rate limiting at the edge remains a sensible backstop, not the primary defence.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  // Named so the error says which field, rather than leaving a caller to bisect their payload.
  const required = ['seller', 'token', 'amount', 'external_id'];
  const missing = required.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  // expiry_timestamp is NOT checked here, and its absence is NOT defaulted. ap2service refuses
  // a request that does not say when the dispute window closes, because the difference between
  // "instant, deliberately" and "nobody said" decides whether anyone can get their money back.
  // Filling it in at the edge would destroy exactly that distinction.
  //
  // eip3009 is optional: a caller who funded the escrow address themselves has nothing for us
  // to relay, and requiring it here would refuse a payment that has already been made.
  return proxyToService(req, res, {
    service: 'ap2',
    path: '/settle',
    method: 'POST',
    body: req.body,
    requiresAuth: false
  });
}
