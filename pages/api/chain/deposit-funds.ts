import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    console.log('Deposit funds request:');
    console.log('Cookies received:', req.headers.cookie || '');
    console.log('Auth token extracted:', authToken ? 'Present' : 'Missing');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    console.log('Calling Chain Service with headers:', { ...headers, Authorization: 'Bearer [REDACTED]' });

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/deposit-funds`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    const responseData = await response.json();
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Deposit funds API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}