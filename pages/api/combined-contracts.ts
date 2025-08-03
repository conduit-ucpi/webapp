import { NextApiRequest, NextApiResponse } from 'next';

interface ContractWithBlockchainStatus {
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

    console.log('Get combined contracts request');
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
    const contractsResponse = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/combined-contracts`, {
      method: 'GET',
      headers
    });

    if (!contractsResponse.ok) {
      console.error('Failed to fetch contracts:', contractsResponse.status);
      return res.status(contractsResponse.status).json({ error: 'Failed to fetch contracts' });
    }

    const contractsData = await contractsResponse.json();
    console.log('All contracts from service:', contractsData?.length || 0);

    // Process each contract and fetch blockchain data if available
    const enrichedContracts: ContractWithBlockchainStatus[] = await Promise.all(
      (Array.isArray(contractsData) ? contractsData : []).map(async (contract: any) => {
        const baseContract: ContractWithBlockchainStatus = {
          ...contract,
          isPending: !contract.chainAddress,
          blockchainQuerySuccess: false,
          hasDiscrepancy: false
        };

        // If contract has chainAddress, try to fetch blockchain data
        if (contract.chainAddress) {
          try {
            const chainResponse = await fetch(`${process.env.CHAIN_SERVICE_URL}/api/chain/contract/${contract.chainAddress}`, {
              method: 'GET',
              headers
            });

            if (chainResponse.ok) {
              const chainData = await chainResponse.json();
              
              // Derive synthetic RESOLVED status
              let finalStatus = chainData.status;
              if (chainData.status === 'CLAIMED' && contract.adminNotes && contract.adminNotes.length > 0) {
                finalStatus = 'RESOLVED';
              }

              baseContract.blockchainStatus = {
                ...chainData,
                status: finalStatus
              };
              baseContract.blockchainQuerySuccess = true;

              // Check for discrepancies between MongoDB and blockchain data
              const discrepancies: string[] = [];
              
              // Check seller address discrepancy
              if (contract.sellerAddress && chainData.sellerAddress && 
                  contract.sellerAddress.toLowerCase() !== chainData.sellerAddress.toLowerCase()) {
                discrepancies.push(`Seller address mismatch: DB(${contract.sellerAddress}) vs Chain(${chainData.sellerAddress})`);
              }

              // Check buyer address discrepancy
              if (contract.buyerAddress && chainData.buyerAddress && 
                  contract.buyerAddress.toLowerCase() !== chainData.buyerAddress.toLowerCase()) {
                discrepancies.push(`Buyer address mismatch: DB(${contract.buyerAddress}) vs Chain(${chainData.buyerAddress})`);
              }

              // Check amount discrepancy
              if (contract.amount && chainData.amount && 
                  Math.abs(contract.amount - chainData.amount) > 0.000001) {
                discrepancies.push(`Amount mismatch: DB(${contract.amount}) vs Chain(${chainData.amount})`);
              }

              // Check expiry timestamp discrepancy (allow 1 second tolerance)
              if (contract.expiryTimestamp && chainData.expiryTimestamp && 
                  Math.abs(contract.expiryTimestamp - chainData.expiryTimestamp) > 1) {
                discrepancies.push(`Expiry timestamp mismatch: DB(${contract.expiryTimestamp}) vs Chain(${chainData.expiryTimestamp})`);
              }

              if (discrepancies.length > 0) {
                baseContract.hasDiscrepancy = true;
                baseContract.discrepancyDetails = discrepancies;
              }

            } else {
              baseContract.blockchainQueryError = `Failed to fetch blockchain data: HTTP ${chainResponse.status}`;
              console.warn(`Failed to fetch chain data for contract ${contract.chainAddress}, status: ${chainResponse.status}`);
            }
          } catch (error: any) {
            baseContract.blockchainQueryError = `Blockchain query error: ${error.message}`;
            console.warn(`Error fetching chain data for contract ${contract.chainAddress}:`, error);
          }
        } else {
          // No chain address means it's pending
          baseContract.blockchainQuerySuccess = true; // Not an error state for pending contracts
        }

        return baseContract;
      })
    );

    // Deduplicate based on contract ID
    const seen = new Set<string>();
    const deduplicatedContracts = enrichedContracts.filter(contract => {
      const key = contract.id || contract.chainAddress || '';
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    console.log('Total contracts after enrichment and deduplication:', deduplicatedContracts.length);
    console.log('Contracts with blockchain query errors:', deduplicatedContracts.filter(c => c.blockchainQueryError).length);
    console.log('Contracts with discrepancies:', deduplicatedContracts.filter(c => c.hasDiscrepancy).length);

    res.status(200).json(deduplicatedContracts);
  } catch (error) {
    console.error('Get combined contracts API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}