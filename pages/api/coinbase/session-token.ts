import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import {
  cdpRequest,
  fetchIdentity,
  getCdpCredentials,
  isValidEvmAddress,
} from '@/lib/server/coinbaseCdp';

const COINBASE_PATH = '/onramp/v1/token';

interface SessionTokenRequest {
  address: string;
  blockchain?: string;
  asset?: string;
}

interface CoinbaseTokenResponse {
  token: string;
  channel_id?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const credentials = getCdpCredentials();
  if (!credentials) {
    console.error('Coinbase API credentials not configured');
    return res.status(503).json({ error: 'Coinbase Onramp is not configured on this server' });
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

  const { address, blockchain = 'base', asset = 'USDC' } = (req.body || {}) as SessionTokenRequest;

  if (!isValidEvmAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  /*
   * ⚠️ NO clientIp IS SENT, DELIBERATELY.
   *
   * It is an optional field, and Coinbase's own documented example of this call omits it:
   * addresses and assets, nothing else. Its purpose is to bind the session to one client so a
   * quote cannot be redeemed elsewhere, which sounds like a security gain and is a liability
   * here — we send the address OUR server saw, and Coinbase separately observes the address the
   * browser arrives from. Those two agree only when nothing sits between them. A proxy, a VPN,
   * a corporate gateway or a mobile network that egresses differently makes them disagree, and
   * a mismatch is invisible: the session is simply treated as something other than what it is.
   *
   * We have no need of the binding — the session is already scoped to one destination address
   * and one asset — so the safer choice is to let Coinbase use the connection it can actually
   * see rather than our second-hand account of it.
   */
  try {
    const coinbaseResponse = await cdpRequest({
      credentials,
      method: 'POST',
      path: COINBASE_PATH,
      body: {
        addresses: [{ address, blockchains: [blockchain] }],
        assets: [asset],
      },
    });

    const responseText = await coinbaseResponse.text();

    if (!coinbaseResponse.ok) {
      console.error('Coinbase session-token request failed:', {
        status: coinbaseResponse.status,
        body: responseText.substring(0, 500),
      });
      return res.status(502).json({ error: 'Failed to create Coinbase session token' });
    }

    const data: CoinbaseTokenResponse = JSON.parse(responseText);
    if (!data.token) {
      console.error('Coinbase response missing token field:', responseText.substring(0, 500));
      return res.status(502).json({ error: 'Invalid response from Coinbase' });
    }

    return res.status(200).json({ token: data.token });
  } catch (error) {
    console.error('Session token generation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
