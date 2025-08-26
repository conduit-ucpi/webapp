import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authToken = requireAuth(req);

    // Expect signed transaction format like deposit-funds
    const { contractAddress, userWalletAddress, signedTransaction } = req.body;
    
    if (!contractAddress || !userWalletAddress || !signedTransaction) {
      return res.status(400).json({ error: 'Missing required fields: contractAddress, userWalletAddress, signedTransaction' });
    }

    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/claim-funds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify({
        contractAddress,
        userWalletAddress,
        signedTransaction
      })
    });

    const responseData = await response.json();
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('Claim funds API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}