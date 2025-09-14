import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Claim funds as gas payer request:');
    console.log('Request body:', req.body);

    const { contractAddress } = req.body;
    
    if (!contractAddress) {
      return res.status(400).json({ error: 'Missing required field: contractAddress' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add X-API-Key header if available
    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    console.log('Calling Chain Service (no auth required):', `${process.env.CHAIN_SERVICE_URL}/api/chain/claim-funds-as-gas-payer`);

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/claim-funds-as-gas-payer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contractAddress
      })
    });

    const responseData = await response.json();
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Claim funds as gas payer API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}