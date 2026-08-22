import { NextApiRequest, NextApiResponse } from 'next';
import { methodGuard, proxyToService } from '@/lib/server/serviceProxy';

/**
 * What a set of offer vaults are holding (MARKETPLACE_OPENSPEC §15.6d).
 *
 * ⚠️ NO INDEX CAN ANSWER THIS, AND THE BROWSER MUST NOT READ IT ITSELF. Funding an offer is a
 *    plain ERC20 transfer, which emits no marketplace event — so a deposit that arrived without
 *    `fund()` opening the offer is invisible to contractservice's event index, and the balance
 *    is the only witness that an LP's capital is sitting there. chainservice reads it and
 *    caches it, so a list of twenty offers costs one request rather than twenty RPC calls from
 *    every browser showing the page.
 *
 * A vault whose balance could not be read comes back ABSENT, never zero. Absence means unknown,
 * and the difference matters: telling an LP their capital is not there is the one thing this
 * read exists to avoid getting wrong.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  await proxyToService(req, res, {
    service: 'chain',
    path: '/api/chain/marketplace/vault-deposits',
    method: 'POST',
    body: req.body
  });
}
