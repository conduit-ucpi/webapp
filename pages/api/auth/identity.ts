import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userServiceUrl = process.env.USER_SERVICE_URL;
    console.log('USER_SERVICE_URL:', userServiceUrl);
    
    const response = await fetch(`${userServiceUrl}/api/user/identity`, {
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });

    console.log('Identity response status:', response.status);
    const responseData = await response.json();
    console.log('Identity response data:', responseData);
    
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Identity API error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}