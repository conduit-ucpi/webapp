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

    // Fetch pending contracts from contract service
    const contractResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': cookies
      }
    });

    if (!contractResponse.ok) {
      throw new Error('Failed to fetch pending contracts');
    }

    const pendingContracts = await contractResponse.json();
    
    // Find the pending contract that matches the deployed contract address
    const pendingContract = pendingContracts.find((contract: any) => 
      contract.chainAddress?.toLowerCase() === contractAddress.toLowerCase()
    );

    if (!pendingContract) {
      return res.status(404).json({ error: 'Pending contract not found for this address' });
    }

    res.status(200).json(pendingContract);
  } catch (error) {
    console.error('Admin pending contract lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}