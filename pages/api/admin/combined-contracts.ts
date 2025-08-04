import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

    // Check if user is authorized admin by calling identity endpoint
    const identityResponse = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': cookies
      }
    });

    if (!identityResponse.ok) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const userData = await identityResponse.json();
    if (userData.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': cookies
    };

    // Fetch all contracts from the unified endpoint (admin uses same endpoint as regular users)
    const contractResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/combined-contracts`, {
      headers
    });

    if (!contractResponse.ok) {
      throw new Error('Failed to fetch contracts from contract service');
    }

    const contractsData = await contractResponse.json();
    console.log('Admin: All contracts from service:', contractsData?.length || 0);

    // Contract service now handles all data combination - simply return the response
    console.log('Admin: Returning contracts directly from contract service (no enrichment/deduplication needed)');

    res.status(200).json(contractsData);
  } catch (error) {
    console.error('Admin combined contracts fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}