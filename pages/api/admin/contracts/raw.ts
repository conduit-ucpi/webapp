import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/api-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contractId } = req.query;

  if (!contractId) {
    return res.status(400).json({ error: 'Contract ID is required' });
  }

  try {
    const authToken = requireAuth(req);

    // Check if user is authorized admin
    const identityResponse = await fetch(`${process.env.USER_SERVICE_URL}/api/user/identity`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': req.headers.cookie || ''
      }
    });

    if (!identityResponse.ok) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const userData = await identityResponse.json();
    if (userData.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Fetch data from both services separately
    const [contractServiceResponse, chainServiceResponse] = await Promise.allSettled([
      // Contract Service data
      fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${contractId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Cookie': req.headers.cookie || ''
        }
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Contract service error: ${res.status}`);
        return { source: 'contractservice', data: await res.json() };
      }).catch(error => ({ source: 'contractservice', error: error.message })),

      // Chain Service data (if contract has chainAddress)
      (async () => {
        // First get the contract to find its chainAddress
        const contractRes = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/${contractId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Cookie': req.headers.cookie || ''
          }
        });
        
        if (!contractRes.ok) {
          throw new Error('Could not fetch contract for chain address');
        }
        
        const contract = await contractRes.json();
        
        if (!contract.chainAddress) {
          return { source: 'chainservice', data: null, message: 'Contract not deployed to chain' };
        }

        const chainRes = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/contract/${contract.chainAddress}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Cookie': req.headers.cookie || ''
          }
        });

        if (!chainRes.ok) {
          throw new Error(`Chain service error: ${chainRes.status}`);
        }

        return { source: 'chainservice', data: await chainRes.json() };
      })().catch(error => ({ source: 'chainservice', error: error.message }))
    ]);

    const result = {
      contractservice: contractServiceResponse.status === 'fulfilled' 
        ? contractServiceResponse.value 
        : { source: 'contractservice', error: 'Failed to fetch' },
      chainservice: chainServiceResponse.status === 'fulfilled' 
        ? chainServiceResponse.value 
        : { source: 'chainservice', error: 'Failed to fetch' }
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Raw contracts fetch error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}