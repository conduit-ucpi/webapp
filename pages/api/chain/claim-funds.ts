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

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/claim-funds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': cookies
      },
      body: JSON.stringify(req.body)
    });

    const responseData = await response.json();
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Claim funds API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}