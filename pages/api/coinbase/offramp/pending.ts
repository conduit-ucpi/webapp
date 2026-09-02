import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { cdpRequest, fetchIdentity, getCdpCredentials } from '@/lib/server/coinbaseCdp';
import {
  CoinbaseSellTransaction,
  partnerUserRefFor,
  selectPendingOrder,
} from '@/lib/server/coinbaseOfframp';

/** Enough history to find the live order without paging; Coinbase caps this at 1000. */
const PAGE_SIZE = 20;

interface CoinbaseSellTransactionsResponse {
  transactions?: CoinbaseSellTransaction[];
}

/**
 * "Does this user owe Coinbase a send right now?"
 *
 * The answer has to come from Coinbase rather than from anything we stored,
 * because the order is created inside their widget — we never see it happen. It
 * is also why this is polled on return and on a cold page load: an order the user
 * abandoned mid-flow is invisible to us until we ask.
 *
 * The partnerUserRef is derived from the session, never read from the query
 * string. That is the whole access control on this route: the CDP key can read
 * ANY of our users' sell orders, so the only thing stopping one user enumerating
 * another's is that they cannot choose whose ref gets looked up.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const credentials = getCdpCredentials();
  if (!credentials) {
    return res.status(503).json({ error: 'Coinbase cash-out is not configured on this server' });
  }

  let authToken: string;
  try {
    authToken = requireAuth(req);
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const identity = await fetchIdentity(req, authToken);
  if (!identity) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const partnerUserRef = partnerUserRefFor(identity);
  if (!partnerUserRef) {
    return res.status(500).json({ error: 'Unable to identify user for Coinbase' });
  }

  try {
    const coinbaseResponse = await cdpRequest({
      credentials,
      method: 'GET',
      path: `/onramp/v1/sell/user/${encodeURIComponent(partnerUserRef)}/transactions`,
      query: { pageSize: String(PAGE_SIZE) },
    });

    const responseText = await coinbaseResponse.text();

    if (!coinbaseResponse.ok) {
      // Verified against the live CDP API: a ref that has never cashed out comes
      // back 200 with an empty list, so 404 here means the route itself is wrong
      // — a deploy-time mistake, not a user with no history. Reported as such.
      if (coinbaseResponse.status === 404) {
        console.error('Coinbase sell-transactions route returned 404 — check the API path');
      }
      console.error('Coinbase sell-transactions request failed:', {
        status: coinbaseResponse.status,
        body: responseText.substring(0, 500),
      });
      return res.status(502).json({ error: 'Could not check your Coinbase cash-out' });
    }

    const data: CoinbaseSellTransactionsResponse = JSON.parse(responseText);
    const pending = selectPendingOrder(data.transactions || [], Date.now());

    return res.status(200).json({ pending });
  } catch (error) {
    console.error('Offramp pending lookup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
