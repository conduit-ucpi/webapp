import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import { cdpRequest, fetchIdentity, getCdpCredentials } from '@/lib/server/coinbaseCdp';
import { payoutRouteFor, CoinbaseSellOptions } from '@/lib/server/coinbaseOfframp';

/**
 * What Coinbase will actually pay out, for this user's country.
 *
 * Worth a round trip rather than a hard-coded table, because the answer is not
 * what you would guess: outside the US, Coinbase offers no bank payout at all —
 * only FIAT_WALLET, its own cash balance. Presetting ACH_BANK_ACCOUNT for a UK
 * user would ask Coinbase for something it does not sell.
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

  const country = typeof req.query.country === 'string' ? req.query.country.toUpperCase() : '';
  const subdivision =
    typeof req.query.subdivision === 'string' ? req.query.subdivision.toUpperCase() : '';

  if (!/^[A-Z]{2}$/.test(country)) {
    return res.status(400).json({ error: 'A two-letter country code is required' });
  }

  try {
    const query: Record<string, string> = { country };
    // Required for the US, where payout methods vary by state.
    if (subdivision) query.subdivision = subdivision;

    const coinbaseResponse = await cdpRequest({
      credentials,
      method: 'GET',
      path: '/onramp/v1/sell/options',
      query,
    });

    const responseText = await coinbaseResponse.text();

    if (!coinbaseResponse.ok) {
      console.error('Coinbase sell-options request failed:', {
        status: coinbaseResponse.status,
        country,
        subdivision,
        body: responseText.substring(0, 300),
      });
      return res.status(502).json({ error: 'Could not read Coinbase cash-out options' });
    }

    const data: CoinbaseSellOptions = JSON.parse(responseText);

    const currencies = (data.cashout_currencies || []).map(currency => {
      const methods = (currency.limits || []).map(l => l.id).filter(Boolean) as string[];
      return {
        code: currency.id,
        methods,
        route: payoutRouteFor(methods),
      };
    });

    return res.status(200).json({ country, subdivision: subdivision || null, currencies });
  } catch (error) {
    console.error('Offramp options error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
