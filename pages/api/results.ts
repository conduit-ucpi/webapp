import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'https://stabledrop.me';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    console.log('Report results request');
    console.log('Auth token:', authToken ? 'Present' : 'Missing');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': req.headers.cookie || ''
    };

    if (process.env.X_API_KEY) {
      headers['X-API-Key'] = process.env.X_API_KEY;
    }

    console.log('Calling Report Service:', `${REPORT_SERVICE_URL}/api/results`);

    const response = await fetch(`${REPORT_SERVICE_URL}/api/results`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    const responseData = await response.json();
    console.log('Report Service response status:', response.status);

    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Report results API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
