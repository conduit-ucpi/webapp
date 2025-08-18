import { Contract, PendingContract } from '@/types';

// Sample data from the actual API response
const sampleApiData = [
  {
    "contract": {
      "id": "688a66f364918c7be0657f57",
      "sellerEmail": "charlie@pank.org.uk",
      "buyerEmail": "charliepank@gmail.com",
      "amount": 0.02,
      "currency": "USDC",
      "sellerAddress": "0x20e00e24101D8D7a330bA3A6AAA655d7766e7C1B",
      "expiryTimestamp": 1753913880,
      "chainId": "43113",
      "chainAddress": "0xec3e9f0e4830b7a969e3b92dc5803b2974379b9c",
      "buyerAddress": "0x43cD4eDE85fa5334050325985cfdD9B1Ce58671a",
      "description": "split dispute 2",
      "productName": "s-crow",
      "createdAt": 1753900787830,
      "createdBy": "6887f8dc92d1415cc031d8e0",
      "adminNotes": [
        {
          "id": "63af4e31-2c1b-4901-a51d-98583f7179fd",
          "content": "30/70 buyer/seller",
          "addedBy": "charliepank@gmail.com",
          "addedAt": 1753902077230
        }
      ],
      "state": "OK",
      "ctaType": "CLAIMED",
      "ctaLabel": "Claimed",
      "ctaVariant": "status"
    },
    "status": "CLAIMED",
    "blockchainStatus": "CLAIMED",
    "blockchainFunded": true,
    "blockchainBalance": "20000",
    "blockchainBuyerAddress": "0x43cd4ede85fa5334050325985cfdd9b1ce58671a",
    "blockchainSellerAddress": "0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b",
    "blockchainExpiryTimestamp": 1753913880,
    "blockchainAmount": "20000",
    "blockchainTokenAddress": "0x5425890298aed601595a70AB815c96711a31Bc65",
    "discrepancies": {
      "buyerAddressMismatch": false,
      "sellerAddressMismatch": false,
      "expiryTimestampMismatch": false,
      "amountMismatch": false,
      "contractNotFoundOnBlockchain": false,
      "deployedButNotFunded": false
    },
    "blockchainError": null,
    "blockchainQuerySuccessful": true
  },
  {
    "contract": {
      "id": "688a667964918c7be0657f56",
      "sellerEmail": "charliepank@gmail.com",
      "buyerEmail": "charlie@pank.org.uk",
      "amount": 2,
      "currency": "USDC",
      "sellerAddress": "0x43cD4eDE85fa5334050325985cfdD9B1Ce58671a",
      "expiryTimestamp": 1753912800,
      "chainId": null,
      "chainAddress": null,
      "buyerAddress": null,
      "description": "split dispute test",
      "productName": "s-crow",
      "createdAt": 1753900665988,
      "createdBy": "6886b8f29d04b421cfd8c381",
      "adminNotes": [],
      "state": "OK",
      "ctaType": "ACCEPT_CONTRACT",
      "ctaLabel": "Make Payment",
      "ctaVariant": "action"
    },
    "blockchainStatus": null,
    "blockchainFunded": null,
    "blockchainBalance": null,
    "blockchainBuyerAddress": null,
    "blockchainSellerAddress": null,
    "blockchainExpiryTimestamp": null,
    "blockchainAmount": null,
    "blockchainTokenAddress": null,
    "discrepancies": {
      "buyerAddressMismatch": false,
      "sellerAddressMismatch": false,
      "expiryTimestampMismatch": false,
      "amountMismatch": false,
      "contractNotFoundOnBlockchain": false,
      "deployedButNotFunded": false
    },
    "blockchainError": null,
    "blockchainQuerySuccessful": false
  }
];

// Function to transform API data (extracted from ContractList component)
function transformContractData(contractsData: any[]): { pending: PendingContract[], regular: Contract[] } {
  const pending: PendingContract[] = [];
  const regular: Contract[] = [];
  
  contractsData.forEach((item: any) => {
    if (!item.contract) {
      console.warn('Item missing contract data:', item);
      return;
    }
    
    const contract = item.contract;
    
    // Check if this is a pending contract (no blockchain data)
    if (!contract.chainAddress || !item.blockchainQuerySuccessful) {
      // This is a pending contract
      const pendingContract: PendingContract = {
        id: contract.id,
        sellerEmail: contract.sellerEmail || '',
        buyerEmail: contract.buyerEmail || '',
        amount: contract.amount || 0, // Keep in microUSDC, formatUSDC will convert for display
        currency: contract.currency || 'USDC',
        sellerAddress: contract.sellerAddress || '',
        expiryTimestamp: contract.expiryTimestamp || 0,
        chainId: contract.chainId,
        chainAddress: contract.chainAddress,
        description: contract.description || '',
        createdAt: contract.createdAt?.toString() || '',
        createdBy: contract.createdBy || '',
        state: contract.state || 'OK',
        adminNotes: contract.adminNotes || [],
        ctaType: contract.ctaType,
        ctaLabel: contract.ctaLabel,
        ctaVariant: contract.ctaVariant
      };
      pending.push(pendingContract);
    } else {
      // This is a regular contract with blockchain data
      const regularContract: Contract = {
        contractAddress: contract.chainAddress || '',
        buyerAddress: item.blockchainBuyerAddress || contract.buyerAddress || '',
        sellerAddress: item.blockchainSellerAddress || contract.sellerAddress || '',
        amount: parseFloat(item.blockchainAmount || contract.amount || '0'), // Keep in microUSDC, formatUSDC will convert for display
        expiryTimestamp: item.blockchainExpiryTimestamp || contract.expiryTimestamp || 0,
        description: contract.description || '',
        status: item.status || 'UNKNOWN',
        blockchainStatus: item.blockchainStatus,
        createdAt: contract.createdAt || 0,
        funded: item.blockchainFunded || false,
        buyerEmail: contract.buyerEmail,
        sellerEmail: contract.sellerEmail,
        adminNotes: contract.adminNotes || [],
        blockchainQueryError: item.blockchainError,
        hasDiscrepancy: Object.values(item.discrepancies || {}).some(Boolean),
        discrepancyDetails: Object.entries(item.discrepancies || {})
          .filter(([, value]) => value)
          .map(([key]) => key),
        ctaType: contract.ctaType,
        ctaLabel: contract.ctaLabel,
        ctaVariant: contract.ctaVariant
      };
      regular.push(regularContract);
    }
  });
  
  return { pending, regular };
}

describe('Contract Data Transformation', () => {
  test('should transform API data correctly', () => {
    const { pending, regular } = transformContractData(sampleApiData);
    
    // Should have 1 regular contract and 1 pending contract
    expect(regular).toHaveLength(1);
    expect(pending).toHaveLength(1);
    
    // Test regular contract transformation
    const regularContract = regular[0];
    expect(regularContract.status).toBe('CLAIMED');
    expect(regularContract.contractAddress).toBe('0xec3e9f0e4830b7a969e3b92dc5803b2974379b9c');
    expect(regularContract.amount).toBe(20000); // Amount stored as microUSDC
    expect(regularContract.buyerEmail).toBe('charliepank@gmail.com');
    expect(regularContract.sellerEmail).toBe('charlie@pank.org.uk');
    expect(regularContract.funded).toBe(true);
    expect(regularContract.hasDiscrepancy).toBe(false);
    expect(regularContract.adminNotes).toHaveLength(1);
    
    // Test pending contract transformation
    const pendingContract = pending[0];
    expect(pendingContract.id).toBe('688a667964918c7be0657f56');
    expect(pendingContract.amount).toBe(2); // Amount stored as microUSDC, formatUSDC handles conversion
    expect(pendingContract.state).toBe('OK');
    expect(pendingContract.sellerEmail).toBe('charliepank@gmail.com');
    expect(pendingContract.buyerEmail).toBe('charlie@pank.org.uk');
    expect(pendingContract.chainAddress).toBeNull();
    
    // Test CTA fields
    expect(regularContract.ctaType).toBe('CLAIMED');
    expect(regularContract.ctaLabel).toBe('Claimed');
    expect(regularContract.ctaVariant).toBe('status');
    
    expect(pendingContract.ctaType).toBe('ACCEPT_CONTRACT');
    expect(pendingContract.ctaLabel).toBe('Make Payment');
    expect(pendingContract.ctaVariant).toBe('action');
  });
  
  test('should handle contracts with missing or null status', () => {
    const testData = [{
      contract: {
        id: "test-id",
        sellerEmail: "seller@test.com",
        buyerEmail: "buyer@test.com",
        amount: 1,
        currency: "USDC",
        sellerAddress: "0x123",
        expiryTimestamp: 1234567890,
        chainId: "43113",
        chainAddress: "0xabc",
        description: "test",
        createdAt: 1234567890,
        createdBy: "test-user",
        state: "OK"
      },
      blockchainStatus: null, // This could cause the toUpperCase error
      blockchainQuerySuccessful: true,
      blockchainFunded: true,
      blockchainAmount: "1000000"
    }];
    
    const { regular } = transformContractData(testData);
    
    expect(regular).toHaveLength(1);
    expect(regular[0].status).toBe('UNKNOWN'); // Should default to UNKNOWN when status is null
  });
  
  test('should handle empty or malformed data gracefully', () => {
    const malformedData = [
      { contract: null }, // Missing contract
      {}, // No contract property
      { contract: { id: "incomplete" } } // Incomplete contract data
    ];
    
    const { pending, regular } = transformContractData(malformedData);
    
    // Should handle malformed data without crashing
    expect(pending).toHaveLength(1); // The incomplete contract should be treated as pending
    expect(regular).toHaveLength(0);
  });
  
  test('should handle contracts without CTA fields for backward compatibility', () => {
    const dataWithoutCTA = [{
      contract: {
        id: "test-id-no-cta",
        sellerEmail: "seller@test.com",
        buyerEmail: "buyer@test.com",
        amount: 1000000,
        currency: "microUSDC",
        sellerAddress: "0x123",
        expiryTimestamp: 1234567890,
        chainId: "43113",
        chainAddress: "0xabc",
        description: "test without CTA",
        createdAt: 1234567890,
        createdBy: "test-user",
        state: "OK"
        // No CTA fields - testing backward compatibility
      },
      blockchainStatus: "ACTIVE",
      blockchainQuerySuccessful: true,
      blockchainFunded: true,
      blockchainAmount: "1000000"
    }];
    
    const { regular } = transformContractData(dataWithoutCTA);
    
    expect(regular).toHaveLength(1);
    expect(regular[0].ctaType).toBeUndefined();
    expect(regular[0].ctaLabel).toBeUndefined();
    expect(regular[0].ctaVariant).toBeUndefined();
  });
});

export { transformContractData, sampleApiData };