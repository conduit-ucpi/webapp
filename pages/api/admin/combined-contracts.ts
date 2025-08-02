import { NextApiRequest, NextApiResponse } from 'next';

interface AdminContractWithBlockchainStatus {
  id: string;
  chainAddress?: string;
  sellerAddress: string;
  buyerAddress?: string;
  amount: number;
  expiryTimestamp: number;
  description: string;
  createdAt: string;
  buyerEmail?: string;
  sellerEmail?: string;
  adminNotes?: string;
  isPending: boolean;
  
  // Blockchain status information
  blockchainStatus?: {
    status?: 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED';
    funded?: boolean;
    fundedAt?: string;
    disputedAt?: string;
    resolvedAt?: string;
    claimedAt?: string;
    buyerAddress?: string;
    sellerAddress?: string;
  };
  
  // Status and error tracking
  blockchainQuerySuccess: boolean;
  blockchainQueryError?: string;
  hasDiscrepancy: boolean;
  discrepancyDetails?: string[];
}

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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': cookies
    };

    // Fetch all contracts from contract service
    const contractResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
      headers
    });

    if (!contractResponse.ok) {
      throw new Error('Failed to fetch contracts from contract service');
    }

    const contractServiceData = await contractResponse.json();
    
    // Also fetch deployed contracts to get additional metadata
    let deployedContracts: any[] = [];
    try {
      const deployedResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/deployed`, {
        headers
      });
      
      if (deployedResponse.ok) {
        deployedContracts = await deployedResponse.json();
      }
    } catch (error) {
      console.warn('Failed to fetch deployed contracts:', error);
    }

    // Process each contract and fetch blockchain data if available
    const enrichedContracts: AdminContractWithBlockchainStatus[] = await Promise.all(
      (Array.isArray(contractServiceData) ? contractServiceData : []).map(async (contract: any) => {
        // Find corresponding deployed contract data
        const deployedContract = deployedContracts.find((deployed: any) => 
          deployed.id === contract.id || deployed.chainAddress === contract.chainAddress
        );

        // Merge contract service data with deployed contract data
        const mergedContract = {
          ...contract,
          ...(deployedContract && deployedContract)
        };

        const baseContract: AdminContractWithBlockchainStatus = {
          ...mergedContract,
          isPending: !mergedContract.chainAddress,
          blockchainQuerySuccess: false,
          hasDiscrepancy: false
        };

        // If contract has chainAddress, try to fetch blockchain data
        if (mergedContract.chainAddress) {
          try {
            const chainResponse = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/contract/${mergedContract.chainAddress}`, {
              method: 'GET',
              headers
            });

            if (chainResponse.ok) {
              const chainData = await chainResponse.json();
              
              // Derive synthetic RESOLVED status
              let finalStatus = chainData.status;
              if (chainData.status === 'CLAIMED' && mergedContract.adminNotes && mergedContract.adminNotes.length > 0) {
                finalStatus = 'RESOLVED';
              }

              baseContract.blockchainStatus = {
                ...chainData,
                status: finalStatus,
                buyerAddress: chainData.buyerAddress || chainData.buyer,
                sellerAddress: chainData.sellerAddress || chainData.seller
              };
              baseContract.blockchainQuerySuccess = true;

              // Check for discrepancies between MongoDB and blockchain data
              const discrepancies: string[] = [];
              
              // Check seller address discrepancy
              if (mergedContract.sellerAddress && chainData.sellerAddress && 
                  mergedContract.sellerAddress.toLowerCase() !== chainData.sellerAddress.toLowerCase()) {
                discrepancies.push(`Seller address mismatch: DB(${mergedContract.sellerAddress}) vs Chain(${chainData.sellerAddress})`);
              }

              // Check buyer address discrepancy
              if (mergedContract.buyerAddress && chainData.buyerAddress && 
                  mergedContract.buyerAddress.toLowerCase() !== chainData.buyerAddress.toLowerCase()) {
                discrepancies.push(`Buyer address mismatch: DB(${mergedContract.buyerAddress}) vs Chain(${chainData.buyerAddress})`);
              }

              // Check amount discrepancy
              if (mergedContract.amount && chainData.amount && 
                  Math.abs(mergedContract.amount - chainData.amount) > 0.000001) {
                discrepancies.push(`Amount mismatch: DB(${mergedContract.amount}) vs Chain(${chainData.amount})`);
              }

              // Check expiry timestamp discrepancy (allow 1 second tolerance)
              if (mergedContract.expiryTimestamp && chainData.expiryTimestamp && 
                  Math.abs(mergedContract.expiryTimestamp - chainData.expiryTimestamp) > 1) {
                discrepancies.push(`Expiry timestamp mismatch: DB(${mergedContract.expiryTimestamp}) vs Chain(${chainData.expiryTimestamp})`);
              }

              if (discrepancies.length > 0) {
                baseContract.hasDiscrepancy = true;
                baseContract.discrepancyDetails = discrepancies;
              }

            } else {
              baseContract.blockchainQueryError = `Failed to fetch blockchain data: HTTP ${chainResponse.status}`;
              console.warn(`Failed to fetch chain data for contract ${mergedContract.chainAddress}, status: ${chainResponse.status}`);
            }
          } catch (error: any) {
            baseContract.blockchainQueryError = `Blockchain query error: ${error.message}`;
            console.warn(`Error fetching chain data for contract ${mergedContract.chainAddress}:`, error);
          }
        } else {
          // No chain address means it's pending
          baseContract.blockchainQuerySuccess = true; // Not an error state for pending contracts
        }

        return baseContract;
      })
    );

    console.log('Admin: Total contracts after enrichment:', enrichedContracts.length);
    console.log('Admin: Contracts with blockchain query errors:', enrichedContracts.filter(c => c.blockchainQueryError).length);
    console.log('Admin: Contracts with discrepancies:', enrichedContracts.filter(c => c.hasDiscrepancy).length);

    res.status(200).json(enrichedContracts);
  } catch (error) {
    console.error('Admin combined contracts fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}