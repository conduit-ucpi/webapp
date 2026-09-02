import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import {
  cdpRequest,
  extractClientIp,
  fetchIdentity,
  getCdpCredentials,
  isValidEvmAddress,
} from '@/lib/server/coinbaseCdp';
import { partnerUserRefFor } from '@/lib/server/coinbaseOfframp';

const COINBASE_PATH = '/onramp/v1/token';

interface OfframpSessionRequest {
  address: string;
  network: string;
  asset: string;
}

interface CoinbaseTokenResponse {
  token?: string;
}

/**
 * Mints the session token for a Coinbase cash-out and names the user to Coinbase.
 *
 * Deliberately separate from the onramp's session-token route despite hitting the
 * same CDP endpoint: this one binds the sell address to the signed-in user and
 * returns the partnerUserRef the browser needs to build the widget URL. The onramp
 * has no business doing either.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const credentials = getCdpCredentials();
  if (!credentials) {
    console.error('Coinbase API credentials not configured');
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
    console.error('Identity has neither userId nor walletAddress; cannot reference the sell order');
    return res.status(500).json({ error: 'Unable to identify user for Coinbase' });
  }

  const { address, network, asset } = (req.body || {}) as OfframpSessionRequest;

  if (!isValidEvmAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  if (!network || !asset) {
    return res.status(400).json({ error: 'network and asset are required' });
  }

  // The funds leave this address, so it has to be the signed-in user's wallet
  // rather than whatever the page asked for. A mismatch means the client is
  // confused or someone is trying to set up a sell order against another wallet.
  if (
    !isValidEvmAddress(identity.walletAddress) ||
    identity.walletAddress.toLowerCase() !== address.toLowerCase()
  ) {
    console.error('Offramp session requested for an address that is not the session wallet');
    return res.status(403).json({ error: 'Address does not match the signed-in wallet' });
  }

  const clientIp = extractClientIp(req);
  if (!clientIp) {
    console.error('Unable to determine client IP for Coinbase offramp session');
    return res.status(400).json({ error: 'Unable to determine client IP' });
  }

  try {
    const coinbaseResponse = await cdpRequest({
      credentials,
      method: 'POST',
      path: COINBASE_PATH,
      body: {
        addresses: [{ address, blockchains: [network] }],
        assets: [asset],
        clientIp,
      },
    });

    const responseText = await coinbaseResponse.text();

    if (!coinbaseResponse.ok) {
      console.error('Coinbase offramp session request failed:', {
        status: coinbaseResponse.status,
        body: responseText.substring(0, 500),
      });
      return res.status(502).json({ error: 'Failed to start a Coinbase cash-out' });
    }

    const data: CoinbaseTokenResponse = JSON.parse(responseText);
    if (!data.token) {
      console.error('Coinbase response missing token field:', responseText.substring(0, 500));
      return res.status(502).json({ error: 'Invalid response from Coinbase' });
    }

    return res.status(200).json({ token: data.token, partnerUserRef });
  } catch (error) {
    console.error('Offramp session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
