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

    // Fetch all contracts from the unified contracts endpoint
    const contractsResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
      method: 'GET',
      headers
    });

    if (!contractsResponse.ok) {
      console.error('Failed to fetch contracts:', contractsResponse.status);
      return res.status(contractsResponse.status).json({ error: 'Failed to fetch contracts' });
    }

    const contractsData = await contractsResponse.json();
    console.log('All contracts from service:', contractsData?.length || 0);

    // Set isPending based on whether contract has chainAddress
    const allContracts = Array.isArray(contractsData) ? contractsData.map((contract: any) => ({
      ...contract,
      isPending: !contract.chainAddress // Pending if no chainAddress
    })) : [];

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