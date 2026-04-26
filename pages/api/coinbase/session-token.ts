import { NextApiRequest, NextApiResponse } from 'next';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { requireAuth } from '@/utils/api-auth';

const COINBASE_HOST = 'api.developer.coinbase.com';
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

function isValidEvmAddress(address: unknown): address is string {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function validateUserSession(req: NextApiRequest, authToken: string): Promise<boolean> {
  if (!process.env.USER_SERVICE_URL) {
    console.error('USER_SERVICE_URL not configured');
    return false;
  }

  const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
    headers: {
      'Cookie': req.headers.cookie || '',
      'Authorization': `Bearer ${authToken}`,
    },
  });

  return response.ok;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKeyId = process.env.COINBASE_API_KEY_ID;
  const apiKeySecret = process.env.COINBASE_API_KEY_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    console.error('Coinbase API credentials not configured');
    return res.status(503).json({ error: 'Coinbase Onramp is not configured on this server' });
  }

  let authToken: string;
  try {
    authToken = requireAuth(req);
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const sessionValid = await validateUserSession(req, authToken);
  if (!sessionValid) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { address, blockchain = 'base', asset = 'USDC' } = (req.body || {}) as SessionTokenRequest;

  if (!isValidEvmAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    const jwt = await generateJwt({
      apiKeyId,
      apiKeySecret,
      requestMethod: 'POST',
      requestHost: COINBASE_HOST,
      requestPath: COINBASE_PATH,
      expiresIn: 120,
    });

    const coinbaseResponse = await fetch(`https://${COINBASE_HOST}${COINBASE_PATH}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addresses: [{ address, blockchains: [blockchain] }],
        assets: [asset],
      }),
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
