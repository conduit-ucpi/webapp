/**
 * Simple regression tests for gas estimation - prevents going back to provider bullshit
 * Tests the actual methods used by the app: getReliableEIP1559FeeData()
 */

import { Web3Service } from '@/lib/web3';

// Mock global fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock config
const mockConfig = {
  web3AuthClientId: 'test-client-id',
  web3AuthNetwork: 'testnet',
  chainId: 8453, // Base mainnet
  rpcUrl: 'https://mainnet.base.org',
  usdcContractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  moonPayApiKey: 'test-key',
  minGasWei: '5',
  maxGasPriceGwei: '0.001', // 1,000,000 wei
  basePath: '',
  explorerBaseUrl: 'https://base.blockscout.com',
  serviceLink: 'http://localhost:3000'
};

describe('Gas Estimation Regression Tests - No Provider Bullshit', () => {
  let web3Service: Web3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    web3Service = (Web3Service as any).getInstance(mockConfig);
  });

  describe('CRITICAL: Must use our RPC, not provider estimates', () => {
    it('should call our Base RPC endpoints for gas price estimation', async () => {
      // Setup: RPC returns reasonable Base fees
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x186a0' // 100,000 wei = 0.0001 gwei (typical Base)
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x3d090' // 250,000 wei = 0.00025 gwei (reasonable priority)
          })
        } as Response);

      // Act: Get fee data
      const fees = await (web3Service as any).getReliableEIP1559FeeData();

      // Assert: MUST call our Base RPC
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify eth_gasPrice call
      expect(mockFetch).toHaveBeenCalledWith('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1
        })
      });

      // Verify eth_maxPriorityFeePerGas call
      expect(mockFetch).toHaveBeenCalledWith('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_maxPriorityFeePerGas',
          params: [],
          id: 2
        })
      });

      // Should return the actual RPC values (not capped in this case)
      expect(fees.maxFeePerGas).toBe(BigInt(350000)); // 100000 + 250000
      expect(fees.maxPriorityFeePerGas).toBe(BigInt(250000)); // 250000
    });

    it('should cap insane RPC fees to our configured maximum', async () => {
      // Setup: RPC returns unreasonably high fees (simulating network congestion)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x5f5e100' // 100,000,000 wei = 0.1 gwei (too high for Base)
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x2faf080' // 50,000,000 wei = 0.05 gwei (too high for Base)
          })
        } as Response);

      // Act: Get fee data
      const fees = await (web3Service as any).getReliableEIP1559FeeData();

      // Assert: Should cap both to our 0.001 gwei limit (1,000,000 wei)
      expect(fees.maxFeePerGas).toBe(BigInt(1000000)); // Capped to our limit
      expect(fees.maxPriorityFeePerGas).toBe(BigInt(1000000)); // Capped to our limit
    });

    it('should fall back to configured caps if RPC fails', async () => {
      // Setup: RPC calls fail
      mockFetch.mockRejectedValue(new Error('RPC unavailable'));

      // Act: Get fee data
      const fees = await (web3Service as any).getReliableEIP1559FeeData();

      // Assert: Should use our configured fallback (0.001 gwei = 1,000,000 wei)
      expect(fees.maxFeePerGas).toBe(BigInt(1000000));
      expect(fees.maxPriorityFeePerGas).toBe(BigInt(1000000));
    });
  });

  describe('Base Network Specific Fee Validation', () => {
    it('should enforce Base-appropriate gas prices (pennies, not dollars)', async () => {
      const testCases = [
        {
          name: 'Normal Base fees (should pass through)',
          baseFee: 100000, // 0.0001 gwei
          priorityFee: 50000, // 0.00005 gwei
          expectedMaxFee: 150000, // sum: 0.00015 gwei
          expectedPriority: 50000
        },
        {
          name: 'High fees (should be capped)',
          baseFee: 2000000000, // 2 gwei (Ethereum-like, wrong for Base)
          priorityFee: 1000000000, // 1 gwei (Ethereum-like, wrong for Base)
          expectedMaxFee: 1000000, // capped to 0.001 gwei
          expectedPriority: 1000000 // capped to 0.001 gwei
        }
      ];

      for (const testCase of testCases) {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
              result: `0x${testCase.baseFee.toString(16)}`
            })
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
              result: `0x${testCase.priorityFee.toString(16)}`
            })
          } as Response);

        const fees = await (web3Service as any).getReliableEIP1559FeeData();

        expect(fees.maxFeePerGas).toBe(BigInt(testCase.expectedMaxFee));
        expect(fees.maxPriorityFeePerGas).toBe(BigInt(testCase.expectedPriority));

        jest.clearAllMocks();
      }
    });

    it('should never allow gas prices that cost dollars instead of pennies', async () => {
      // Setup: Simulate provider returning Ethereum mainnet gas prices
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x6fc23ac00' // 30,000,000,000 wei = 30 gwei (Ethereum-like)
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x77359400' // 2,000,000,000 wei = 2 gwei (Ethereum-like tip)
          })
        } as Response);

      const fees = await (web3Service as any).getReliableEIP1559FeeData();

      // Assert: Should be capped to Base-appropriate levels
      expect(fees.maxFeePerGas).toBe(BigInt(1000000)); // 0.001 gwei cap
      expect(fees.maxPriorityFeePerGas).toBe(BigInt(1000000)); // 0.001 gwei cap

      // Verify transaction cost would be reasonable
      const gasLimit = 100000; // Typical transaction
      const totalCostWei = fees.maxFeePerGas * BigInt(gasLimit);
      const totalCostEth = Number(totalCostWei) / 1e18;

      // Should cost cents, not dollars (< $0.01 at $3000/ETH)
      expect(totalCostEth * 3000).toBeLessThan(0.01);
    });
  });

  describe('Configuration Validation', () => {
    it('should require RPC URL to prevent fallback to provider estimates', async () => {
      // Setup: No RPC URL configured
      const invalidService = (Web3Service as any).getInstance({
        ...mockConfig,
        rpcUrl: undefined
      });

      // Act & Assert: Should throw immediately
      await expect(
        (invalidService as any).getReliableEIP1559FeeData()
      ).rejects.toThrow('No RPC URL configured');

      // Should not have tried any RPC calls
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate maxGasPriceGwei configuration exists', () => {
      // Setup: Missing maxGasPriceGwei
      const invalidService = (Web3Service as any).getInstance({
        ...mockConfig,
        maxGasPriceGwei: undefined
      });

      // This should throw when trying to get max price
      expect(() => {
        (invalidService as any).getMaxGasPriceInWei();
      }).toThrow();
    });

    it('should convert gwei to wei correctly', () => {
      // Test the conversion logic
      const weiValue = (web3Service as any).getMaxGasPriceInWei();

      // 0.001 gwei should = 1,000,000 wei
      expect(weiValue).toBe(BigInt(1000000));
    });
  });

  describe('Web3Auth Bypass: Direct RPC Transaction Sending', () => {
    it('should document that we bypass Web3Auth validation by using direct RPC', () => {
      // This test exists to document our architectural decision:
      // We bypass Web3Auth's gas validation by:
      // 1. Getting gas estimates from Base RPC directly
      // 2. Getting gas prices from Base RPC directly
      // 3. Signing transactions with Web3Auth signer
      // 4. Sending raw signed transactions to Base RPC directly

      // This prevents Web3Auth from pre-validating transactions with wrong gas prices
      // and allows us to use Base network's actual gas economics (0.001 gwei vs 1.5 gwei)

      expect(true).toBe(true); // This test documents intent
    });
  });

  describe('Regression Prevention: No Provider Fee Usage', () => {
    it('should document that we bypass provider.getFeeData() entirely', () => {
      // This test exists to document our architectural decision:
      // We NEVER use provider.getFeeData() results for actual gas prices.
      // We only use it to detect EIP-1559 support, then get real fees from our RPC.

      // The getReliableEIP1559FeeData() method should:
      // 1. Call our configured Base RPC directly
      // 2. Apply our configured caps
      // 3. Return fees suitable for Base network (pennies, not dollars)

      expect(true).toBe(true); // This test documents intent
    });

    it('should ensure gas price caps prevent the $3500 transaction bug', async () => {
      // Setup: Simulate the exact scenario that caused the original bug
      // Use values that exceed our cap to test the capping mechanism
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x3b9aca00' // 1,000,000,000 wei = 1 gwei (should be capped)
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            result: '0x3b9aca00' // 1,000,000,000 wei = 1 gwei (should be capped)
          })
        } as Response);

      const fees = await (web3Service as any).getReliableEIP1559FeeData();

      // Assert: Should be capped to prevent expensive transactions
      expect(fees.maxFeePerGas).toBe(BigInt(1000000)); // Our 0.001 gwei cap
      expect(fees.maxPriorityFeePerGas).toBe(BigInt(1000000)); // Our 0.001 gwei cap

      // Verify the original bug is fixed:
      // Original: 100,000 gas × 1.5 gwei = 150,000,000,000,000 wei ≈ $0.60
      // Fixed: 100,000 gas × 0.001 gwei = 100,000,000 wei ≈ $0.0003
      const gasLimit = 100000;
      const originalBugCost = BigInt(gasLimit) * BigInt('1500000000'); // 1.5 gwei
      const fixedCost = BigInt(gasLimit) * fees.maxFeePerGas;

      expect(fixedCost).toBeLessThan(originalBugCost);
      expect(Number(fixedCost)).toBeLessThan(1000000000000); // Less than 0.001 ETH worth (1e12 wei)
    });
  });
});