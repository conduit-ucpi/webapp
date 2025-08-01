import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { buyerPercentage, sellerPercentage, resolutionNote, chainAddress, buyerEmail, sellerEmail } = req.body;

  // Validate percentages
  if (typeof buyerPercentage !== 'number' || typeof sellerPercentage !== 'number') {
    return res.status(400).json({ error: 'Buyer and seller percentages must be numbers' });
  }

  if (buyerPercentage + sellerPercentage !== 100) {
    return res.status(400).json({ error: 'Buyer and seller percentages must add up to 100%' });
  }

  if (buyerPercentage < 0 || sellerPercentage < 0 || buyerPercentage > 100 || sellerPercentage > 100) {
    return res.status(400).json({ error: 'Percentages must be between 0 and 100' });
  }

  // Validate chainAddress is provided
  if (!chainAddress || typeof chainAddress !== 'string') {
    return res.status(400).json({ error: 'Chain address is required' });
  }

  try {
    // Call the chain service to resolve the dispute using the provided chain address
    const response = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/admin/contracts/${chainAddress}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
      },
      body: JSON.stringify({
        buyerPercentage,
        sellerPercentage,
        resolutionNote,
        buyerEmail,
        sellerEmail
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chain service error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: response.status === 404 ? 'Contract not found on chain' : 'Failed to resolve dispute' 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}