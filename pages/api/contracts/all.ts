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

    console.log('Get all contracts request');
    console.log('Auth token:', authToken ? 'Present' : 'Missing');

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': cookies
    };

    // Fetch both pending and deployed contracts in parallel
    const [pendingResponse, deployedResponse] = await Promise.all([
      fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
        method: 'GET',
        headers
      }),
      fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/deployed`, {
        method: 'GET',
        headers
      })
    ]);

    if (!pendingResponse.ok) {
      console.error('Failed to fetch pending contracts:', pendingResponse.status);
      return res.status(pendingResponse.status).json({ error: 'Failed to fetch pending contracts' });
    }

    if (!deployedResponse.ok) {
      console.error('Failed to fetch deployed contracts:', deployedResponse.status);
      return res.status(deployedResponse.status).json({ error: 'Failed to fetch deployed contracts' });
    }

    const pendingData = await pendingResponse.json();
    const deployedData = await deployedResponse.json();

    console.log('Pending contracts:', pendingData?.length || 0);
    console.log('Deployed contracts:', deployedData?.length || 0);

    // Combine and deduplicate contracts
    const allContracts = [
      ...(Array.isArray(pendingData) ? pendingData.map((contract: any) => ({
        ...contract,
        status: 'PENDING',
        isPending: !contract.chainAddress // Only truly pending if no chainAddress
      })) : []),
      ...(Array.isArray(deployedData) ? deployedData.map((contract: any) => ({
        ...contract,
        isPending: !contract.chainAddress // Only truly pending if no chainAddress
      })) : [])
    ];

    // Deduplicate based on contract ID
    const seen = new Set<string>();
    const deduplicatedContracts = allContracts.filter(contract => {
      const key = contract.id || contract.contractId || contract.chainAddress;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    console.log('Total contracts after deduplication:', deduplicatedContracts.length);

    res.status(200).json(deduplicatedContracts);
  } catch (error) {
    console.error('Get all contracts API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}