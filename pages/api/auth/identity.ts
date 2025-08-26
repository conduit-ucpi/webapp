import { NextApiRequest, NextApiResponse } from 'next';
import { extractAuthToken } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = extractAuthToken(req);
    
    const headers: Record<string, string> = {
      'Cookie': req.headers.cookie || ''
    };
    
    // Include Authorization header if token is available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers
    });

    res.status(response.status).json(await response.json());
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}