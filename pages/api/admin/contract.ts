import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract the AUTH-TOKEN from cookies
    const cookies = req.headers.cookie || '';
    const authTokenMatch = cookies.match(/AUTH-TOKEN=([^;]+)/);
    const authToken = authTokenMatch ? authTokenMatch[1] : null;

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is authorized admin by calling identity endpoint
    const identityResponse = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': cookies
      }
    });

    if (!identityResponse.ok) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const userData = await identityResponse.json();
    if (userData.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { contractAddress } = req.query;
    
    if (!contractAddress || typeof contractAddress !== 'string') {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    // Validate address format (basic check)
    if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid contract address format' });
    }

    // Fetch contract details from chain service
    const chainResponse = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/contract/${contractAddress}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': cookies
      }
    });

    if (!chainResponse.ok) {
      if (chainResponse.status === 404) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      throw new Error('Failed to fetch contract from chain service');
    }

    const chainData = await chainResponse.json();
    
    // Try to get additional metadata from contract service
    let contractMetadata = null;
    try {
      const metadataResponse = await fetch(`${process.env.USER_SERVICE_URL}/api/contracts/deployed`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Cookie': cookies
        }
      });
      
      if (metadataResponse.ok) {
        const deployedContracts = await metadataResponse.json();
        contractMetadata = deployedContracts.find((contract: any) => 
          contract.chainAddress?.toLowerCase() === contractAddress.toLowerCase()
        );
      }
    } catch (error) {
      console.warn('Failed to fetch contract metadata:', error);
    }

    // Merge chain data with metadata if available
    const contractData = {
      ...chainData,
      ...(contractMetadata && {
        buyerEmail: contractMetadata.buyerEmail,
        sellerEmail: contractMetadata.sellerEmail,
        description: contractMetadata.description
      })
    };

    res.status(200).json(contractData);
  } catch (error) {
    console.error('Admin contract lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}