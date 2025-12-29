/**
 * TDD Test: waitForTransaction should NOT require wallet provider initialization
 *
 * Problem: Currently, waitForTransaction() checks this.provider and uses this.provider.send(),
 * which requires the wallet provider to be initialized. This causes unnecessary mobile popups
 * when we call getWeb3Service() just to wait for a transaction.
 *
 * Expected: waitForTransaction() should use this.readProvider (RPC-only) instead,
 * which is available immediately when Web3Service is created (no wallet needed).
 *
 * This test will FAIL until we fix waitForTransaction() to use readProvider instead of provider.
 */

import { Web3Service } from '@/lib/web3';
import { Config } from '@/types';

describe('Web3Service.waitForTransaction - NO WALLET PROVIDER REQUIRED', () => {
  it('should wait for transaction using ONLY readProvider (no wallet provider needed)', async () => {
    // Create a config with RPC URL (but no wallet provider)
    const config: Config = {
      rpcUrl: 'https://mainnet.base.org',
      chainId: 8453,
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractFactoryAddress: '0x0000000000000000000000000000000000000000',
      maxGasPriceGwei: '50',
      maxGasCostGwei: '0.01',
      minGasWei: '1000000000',
      gasPriceBuffer: '1.2',
      usdcGrantFoundryGas: '100000',
      depositFundsFoundryGas: '200000',
      basePath: 'https://test.example.com',
      explorerBaseUrl: 'https://basescan.org',
      serviceLink: 'https://test.example.com',
      moonPayApiKey: 'test',
      usdtContractAddress: '0x0000000000000000000000000000000000000001'
    };

    // Create Web3Service instance WITHOUT initializing wallet provider
    // This is the key: readProvider is created immediately, but provider is null
    const web3Service = Web3Service.getInstance(config);

    // Verify that wallet provider is NOT initialized
    expect(web3Service.isServiceInitialized()).toBe(false);
    console.log('✅ [TEST] Web3Service created WITHOUT wallet provider initialization');

    // Mock the RPC response for eth_getTransactionReceipt
    const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const mockReceipt = {
      blockNumber: 12345,
      status: 1, // Success (number, not hex string)
      hash: mockTxHash
    };

    // Mock readProvider's getTransactionReceipt method
    const readProvider = (web3Service as any).readProvider;
    jest.spyOn(readProvider, 'getTransactionReceipt').mockResolvedValue(mockReceipt as any);

    console.log('🔍 [TEST] Calling waitForTransaction WITHOUT wallet provider...');

    // THIS SHOULD WORK: waitForTransaction should use readProvider (RPC-only)
    // It should NOT require wallet provider initialization
    try {
      const receipt = await web3Service.waitForTransaction(mockTxHash, 5000, 'test-contract');

      // Verify receipt was returned
      expect(receipt).toBeTruthy();
      expect(receipt.blockNumber).toBe(12345);
      expect(receipt.status).toBe(1);

      console.log('✅ [TEST] SUCCESS - Transaction wait completed WITHOUT wallet provider!');
      console.log('    This proves waitForTransaction uses readProvider (RPC-only), not wallet provider');

    } catch (error) {
      // This is the FAILING case (current buggy behavior)
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Provider not initialized')) {
        console.log('🔴 [TEST] FAILED as expected - waitForTransaction requires wallet provider');
        console.log('    Error:', errorMessage);
        console.log('    FIX: Change waitForTransaction to use this.readProvider instead of this.provider');

        // Fail the test with clear instructions
        throw new Error(
          'waitForTransaction() should NOT require wallet provider! ' +
          'It should use this.readProvider (RPC-only) instead of this.provider (wallet). ' +
          'Fix: Change lines 1709-1711 and 1761 in lib/web3.ts to use readProvider.'
        );
      }

      // Re-throw unexpected errors
      throw error;
    }

    // Cleanup
    Web3Service.clearInstance();
  });

  it('should use readProvider.getTransactionReceipt, NOT provider.send', async () => {
    // This test verifies the IMPLEMENTATION detail: we should use readProvider methods
    const config: Config = {
      rpcUrl: 'https://mainnet.base.org',
      chainId: 8453,
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractFactoryAddress: '0x0000000000000000000000000000000000000000',
      maxGasPriceGwei: '50',
      maxGasCostGwei: '0.01',
      minGasWei: '1000000000',
      gasPriceBuffer: '1.2',
      usdcGrantFoundryGas: '100000',
      depositFundsFoundryGas: '200000',
      basePath: 'https://test.example.com',
      explorerBaseUrl: 'https://basescan.org',
      serviceLink: 'https://test.example.com',
      moonPayApiKey: 'test',
      usdtContractAddress: '0x0000000000000000000000000000000000000001'
    };

    const web3Service = Web3Service.getInstance(config);

    // Create a spy on the readProvider (which should exist)
    // Note: We need to access the private readProvider for testing
    const readProvider = (web3Service as any).readProvider;
    expect(readProvider).toBeTruthy(); // readProvider should be created immediately
    console.log('✅ [TEST] readProvider exists (created on Web3Service construction)');

    // Mock the readProvider's getTransactionReceipt method
    const getTransactionReceiptSpy = jest.spyOn(readProvider, 'getTransactionReceipt').mockResolvedValue({
      blockNumber: 12345,
      status: 1,
      hash: '0xtest'
    } as any);

    const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    try {
      await web3Service.waitForTransaction(mockTxHash, 5000, 'test-contract');

      // Verify that readProvider.getTransactionReceipt was called
      expect(getTransactionReceiptSpy).toHaveBeenCalled();
      console.log('✅ [TEST] readProvider.getTransactionReceipt() was called (correct!)');

    } catch (error) {
      console.log('🔴 [TEST] FAILED - waitForTransaction threw error before using readProvider');
      throw error;
    }

    // Cleanup
    Web3Service.clearInstance();
  });
});
