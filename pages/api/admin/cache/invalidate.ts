import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contractAddress, reason } = req.body;

    if (!contractAddress) {
      return res.status(400).json({ error: 'contractAddress is required' });
    }

    const chainServiceUrl = process.env.CHAIN_SERVICE_URL || 'http://localhost:8978';
    
    // Forward the request to the chain service
    const response = await fetch(`${chainServiceUrl}/api/admin/cache/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies for authentication
        ...(req.headers.cookie && { Cookie: req.headers.cookie }),
      },
      body: JSON.stringify({
        contractAddress,
        reason: reason || 'Force refresh after manual state change',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Cache invalidation failed:', error);
      return res.status(response.status).json({ error: 'Cache invalidation failed' });
    }

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}