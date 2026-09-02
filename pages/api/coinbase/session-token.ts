import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';
import {
  cdpRequest,
  extractClientIp,
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

  const clientIp = extractClientIp(req);
  if (!clientIp) {
    console.error('Unable to determine client IP for Coinbase session token');
    return res.status(400).json({ error: 'Unable to determine client IP' });
  }

  try {
    const coinbaseResponse = await cdpRequest({
      credentials,
      method: 'POST',
      path: COINBASE_PATH,
      body: {
        addresses: [{ address, blockchains: [blockchain] }],
        assets: [asset],
        clientIp,
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
