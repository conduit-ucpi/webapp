import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    console.log('Fund approved contract request:');
    console.log('Auth token extracted:', authToken ? 'Present' : 'Missing');
    console.log('Request body:', req.body);

    const { contractHash } = req.body;

    if (!contractHash) {
      return res.status(400).json({ error: 'Missing required field: contractHash' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    // Add X-API-Key header if available
    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    console.log('Calling Chain Service:', `${process.env.CHAIN_SERVICE_URL}/api/chain/fund-approved-contract`);

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/fund-approved-contract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contractHash
      })
    });

    const responseData = await response.json();
    console.log('Chain Service response status:', response.status);
    console.log('Chain Service response:', responseData);

    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Fund approved contract API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
