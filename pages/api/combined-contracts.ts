import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Get combined contracts request');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Cookie header:', req.headers.cookie);
    console.log('Authorization header:', req.headers.authorization);
    
    const authToken = requireAuth(req);

    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    console.log('About to make request to CONTRACT_SERVICE_URL:', process.env.CONTRACT_SERVICE_URL);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    // Fetch all contracts from the unified contracts endpoint
    const contractsResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/combined-contracts`, {
      method: 'GET',
      headers
    });

    if (!contractsResponse.ok) {
      console.error('Failed to fetch contracts:', contractsResponse.status);
      return res.status(contractsResponse.status).json({ error: 'Failed to fetch contracts' });
    }

    const contractsData = await contractsResponse.json();
    console.log('All contracts from service:', contractsData?.length || 0);

    // Contract service now handles all data combination - simply return the response
    console.log('Returning contracts directly from contract service (no enrichment/deduplication needed)');

    res.status(200).json(contractsData);
  } catch (error) {
    console.error('Get combined contracts API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}