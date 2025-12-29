/**
 * Tests for Web3Service network verification caching
 *
 * Ensures that network switching prompts are not shown repeatedly during
 * multi-transaction flows (e.g., approve + deposit during contract creation)
 */

import { Web3Service } from '@/lib/web3';
import { Config } from '@/types';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    BrowserProvider: jest.fn(),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn(),
    })),
    Contract: jest.fn(),
    formatUnits: jest.fn((value) => value),
    parseUnits: jest.fn((value) => value),
  },
}));

describe('Web3Service - Network Verification Caching', () => {
  let mockConfig: Config;
  let mockProvider: any;
  let networkCheckCount: number;

  beforeEach(() => {
    // Clear singleton
    Web3Service.clearInstance();

    // Reset counter
    networkCheckCount = 0;

    mockConfig = {
      chainId: 8453, // Base mainnet
      rpcUrl: 'https://mainnet.base.org',
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractFactoryAddress: '0xFactory',
      moonPayApiKey: 'test-key',
      explorerBaseUrl: 'https://basescan.org',
      minGasWei: '5',
      maxGasPriceGwei: '100',
      maxGasCostGwei: '0.01',
      gasPriceBuffer: '1.2',
      usdcGrantFoundryGas: '100000',
      depositFundsFoundryGas: '150000',
      basePath: 'https://test.example.com',
      tokenSymbol: 'USDC',
      defaultTokenSymbol: 'USDC',
      walletConnectProjectId: 'test-wc-project',
      serviceLink: 'https://test.example.com'
    };

    // Mock provider that tracks network check calls
    mockProvider = {
      getNetwork: jest.fn(async () => {
        networkCheckCount++;
        console.log(`[TEST] getNetwork called (count: ${networkCheckCount})`);
        return {
          chainId: BigInt(8453), // Base mainnet - correct network
          name: 'base'
        };
      }),
      getSigner: jest.fn(() => ({
        getAddress: jest.fn().mockResolvedValue('0xUserAddress'),
        sendTransaction: jest.fn().mockResolvedValue({
          hash: '0xTxHash',
          wait: jest.fn().mockResolvedValue({ status: 1 })
        })
      })),
      _getProvider: jest.fn().mockReturnValue({
        request: jest.fn() // For network switching if needed
      }),
      send: jest.fn(),
      getTransactionReceipt: jest.fn()
    };
  });

  afterEach(() => {
    Web3Service.clearInstance();
  });

  it('should verify network on first transaction', async () => {
    const web3Service = Web3Service.getInstance(mockConfig);
    await web3Service.initialize(mockProvider);

    // First transaction should check network
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xContract',
        data: '0x123',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Transaction might fail due to incomplete mocking, but we're testing network check
    }

    // Should have checked network once
    expect(networkCheckCount).toBeGreaterThanOrEqual(1);
  });

  it('should NOT re-check network on subsequent transactions (uses cache)', async () => {
    const web3Service = Web3Service.getInstance(mockConfig);
    await web3Service.initialize(mockProvider);

    // First transaction
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xContract1',
        data: '0x123',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Ignore transaction errors
    }

    const checksAfterFirstTx = networkCheckCount;
    expect(checksAfterFirstTx).toBeGreaterThanOrEqual(1);

    // Second transaction immediately after (within cache window)
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xContract2',
        data: '0x456',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Ignore transaction errors
    }

    // Should NOT have made additional network checks (cache hit)
    expect(networkCheckCount).toBe(checksAfterFirstTx);
    console.log('[TEST] ✅ Network cache prevented redundant check');
  });

  it('should re-check network after cache invalidation', async () => {
    const web3Service = Web3Service.getInstance(mockConfig);
    await web3Service.initialize(mockProvider);

    // First transaction
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xContract1',
        data: '0x123',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Ignore transaction errors
    }

    const checksAfterFirstTx = networkCheckCount;

    // Invalidate cache (simulating error recovery)
    web3Service.invalidateNetworkCache();

    // Next transaction should check network again
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xContract2',
        data: '0x456',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Ignore transaction errors
    }

    // Should have made another network check
    expect(networkCheckCount).toBeGreaterThan(checksAfterFirstTx);
    console.log('[TEST] ✅ Cache invalidation forced network re-check');
  });

  it('should cache network verification across multiple transactions in contract creation flow', async () => {
    // This simulates the real-world scenario: approve USDC → deposit funds
    const web3Service = Web3Service.getInstance(mockConfig);
    await web3Service.initialize(mockProvider);

    // Transaction 1: Approve USDC
    try {
      await web3Service.fundAndSendTransaction({
        to: mockConfig.usdcContractAddress!,
        data: '0xAPPROVE_DATA',
        gasLimit: BigInt(50000)
      });
    } catch (error) {
      // Ignore
    }

    const checksAfterApprove = networkCheckCount;
    expect(checksAfterApprove).toBeGreaterThanOrEqual(1);

    // Transaction 2: Deposit funds (immediately after approval)
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xEscrowContract',
        data: '0xDEPOSIT_DATA',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Ignore
    }

    // Should NOT have checked network again (cache hit)
    expect(networkCheckCount).toBe(checksAfterApprove);
    console.log('[TEST] ✅ Multi-transaction flow used cached network verification');
  });

  it('should clear network cache on logout', async () => {
    const web3Service = Web3Service.getInstance(mockConfig);
    await web3Service.initialize(mockProvider);

    // Perform transaction to populate cache
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xContract',
        data: '0x123',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Ignore
    }

    const checksBeforeClear = networkCheckCount;

    // Simulate logout
    web3Service.clearState();

    // Re-initialize (simulating new login)
    await web3Service.initialize(mockProvider);

    // Next transaction should check network again (cache was cleared)
    try {
      await web3Service.fundAndSendTransaction({
        to: '0xContract2',
        data: '0x456',
        gasLimit: BigInt(100000)
      });
    } catch (error) {
      // Ignore
    }

    // Should have made another network check
    expect(networkCheckCount).toBeGreaterThan(checksBeforeClear);
    console.log('[TEST] ✅ Logout cleared network cache');
  });
});
