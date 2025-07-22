import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { walletAddress } = req.query;

  try {
    const response = await fetch(
      `${process.env.CHAIN_SERVICE_URL}/api/chain/contracts/${walletAddress}`,
      {
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      }
    );

    res.status(response.status).json(await response.json());
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}