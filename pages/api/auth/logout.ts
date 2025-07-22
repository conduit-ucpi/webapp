import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL}/api/user/logout`, {
      method: 'POST',
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      res.setHeader('Set-Cookie', cookies);
    }

    res.status(response.status).json(await response.json());
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}