import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/claim-funds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify(req.body)
    });

    res.status(response.status).json(await response.json());
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}