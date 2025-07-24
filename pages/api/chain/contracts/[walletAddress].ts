import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { walletAddress } = req.query;

  try {
    const chainServiceUrl = `${process.env.CHAIN_SERVICE_URL}/api/chain/contracts/${walletAddress}`;
    console.log('Fetching contracts from:', chainServiceUrl);
    console.log('With cookies:', req.headers.cookie || 'None');

    const response = await fetch(chainServiceUrl, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('Chain service response status:', response.status);
    console.log('Chain service response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chain service error:', errorText);
      return res.status(response.status).json({ 
        error: `Chain service error: ${response.status}`,
        details: errorText
      });
    }

    const responseText = await response.text();
    console.log('Chain service response body:', responseText.substring(0, 200));

    try {
      const data = JSON.parse(responseText);
      res.status(200).json(data);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      res.status(500).json({ 
        error: 'Invalid JSON response from chain service',
        response: responseText.substring(0, 200)
      });
    }
  } catch (error) {
    console.error('Contracts API error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}