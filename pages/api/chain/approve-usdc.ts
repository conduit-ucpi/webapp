import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract the AUTH-TOKEN from cookies
    const cookies = req.headers.cookie || '';
    const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
    const authToken = authTokenMatch ? authTokenMatch[1] : null;

    console.log('Approve USDC request:');
    console.log('Cookies received:', cookies);
    console.log('Auth token extracted:', authToken ? 'Present' : 'Missing');
    console.log('Request body:', req.body);

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': cookies
    };

    console.log('Calling Chain Service with headers:', { ...headers, Authorization: 'Bearer [REDACTED]' });

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/approve-usdc`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    const responseData = await response.json();
    console.log('Chain Service response:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Approve USDC API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}