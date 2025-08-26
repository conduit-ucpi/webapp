import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    console.log('Get deployed contracts request');
    console.log('Auth token:', authToken ? 'Present' : 'Missing');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    console.log('Calling Contract Service:', `${process.env.CONTRACT_SERVICE_URL}/api/contracts/deployed`);

    const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/deployed`, {
      method: 'GET',
      headers
    });

    const responseData = await response.json();
    console.log('Contract Service deployed contracts response:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Get deployed contracts API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}