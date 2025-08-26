import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contractAddress } = req.query;

  if (!contractAddress || typeof contractAddress !== 'string') {
    return res.status(400).json({ error: 'Contract address is required' });
  }

  try {
    const authToken = requireAuth(req);
    
    const chainServiceUrl = `${process.env.CHAIN_SERVICE_URL}/api/chain/contract/${contractAddress}`;
    console.log('Fetching contract from:', chainServiceUrl);

    const response = await fetch(chainServiceUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': req.headers.cookie || '',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('Chain service response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chain service error:', errorText);
      return res.status(response.status).json({ 
        error: `Chain service error: ${response.status}`,
        details: errorText
      });
    }

    const responseText = await response.text();
    console.log('Chain service response body:', responseText.substring(0, 1000));

    try {
      const data = JSON.parse(responseText);
      
      // Map the response to match our frontend interface
      if (data) {
        const contract = {
          ...data,
          buyerAddress: data.buyer || data.buyerAddress,
          sellerAddress: data.seller || data.sellerAddress
        };
        
        res.status(200).json(contract);
      } else {
        res.status(404).json({ error: 'Contract not found' });
      }
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      res.status(500).json({ 
        error: 'Invalid JSON response from chain service',
        response: responseText.substring(0, 1000)
      });
    }
  } catch (error) {
    console.error('Chain contract API error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}