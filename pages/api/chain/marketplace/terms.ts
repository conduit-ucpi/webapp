import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * The venue's standing terms, as the factory holds them (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ `defaultOfferDurationSeconds` IS WHAT STOPS A GUARANTEED REVERT. The factory refuses an
 *    offer that would outlive the cashflow it bids on — `block.timestamp + duration >= maturity`
 *    reverts with OfferExpiryExceedsEscrowMaturity — so an escrow maturing sooner than this
 *    window cannot be bid on at all. Without the figure a UI can only discover that by taking
 *    the LP's signature and spending their gas to be refused.
 *
 * Read rather than hardcoded: it is settable on-chain, so a copy in the client would rot the
 * first time it changed, and rot silently in the direction of failed transactions.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'GET')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/terms'
  });
}
