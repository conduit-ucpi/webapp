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

    // Fetch all contracts from contract service
    const contractResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': cookies
      }
    });

    if (!contractResponse.ok) {
      throw new Error('Failed to fetch contracts from contract service');
    }

    const contractServiceData = await contractResponse.json();
    
    // Also fetch deployed contracts to get additional metadata
    let deployedContracts: any[] = [];
    try {
      const deployedResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/deployed`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Cookie': cookies
        }
      });
      
      if (deployedResponse.ok) {
        deployedContracts = await deployedResponse.json();
      }
    } catch (error) {
      console.warn('Failed to fetch deployed contracts:', error);
    }

    // Enrich contract data with chain service data for contracts that have addresses
    const enrichedContracts = await Promise.all(
      contractServiceData.map(async (contract: any) => {
        let chainData = null;
        
        // If contract has a chain address, fetch additional data from chain service
        if (contract.chainAddress) {
          try {
            const chainResponse = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/contract/${contract.chainAddress}`, {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Cookie': cookies
              }
            });
            
            if (chainResponse.ok) {
              chainData = await chainResponse.json();
            }
          } catch (error) {
            console.warn(`Failed to fetch chain data for contract ${contract.chainAddress}:`, error);
          }
        }
        
        // Find corresponding deployed contract data
        const deployedContract = deployedContracts.find((deployed: any) => 
          deployed.id === contract.id || deployed.chainAddress === contract.chainAddress
        );

        // Merge all data sources
        return {
          // Base contract service data
          ...contract,
          // Override with deployed contract data if available
          ...(deployedContract && deployedContract),
          // Override with chain data if available
          ...(chainData && {
            status: chainData.status,
            funded: chainData.funded,
            fundedAt: chainData.fundedAt,
            disputedAt: chainData.disputedAt,
            resolvedAt: chainData.resolvedAt,
            claimedAt: chainData.claimedAt,
            // Keep addresses from chain data as authoritative
            buyerAddress: chainData.buyerAddress || chainData.buyer,
            sellerAddress: chainData.sellerAddress || chainData.seller,
          })
        };
      })
    );

    res.status(200).json(enrichedContracts);
  } catch (error) {
    console.error('Admin contracts fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}