/**
 * Test to demonstrate the mobile MetaMask bug fix
 *
 * This test demonstrates that the NEW implementation (manual polling via readProvider)
 * works even when the wallet provider's waitForTransaction() method is broken.
 *
 * On mobile, after app-switching (Browser -> MetaMask -> Browser), the wallet provider's
 * internal state breaks. This causes provider.waitForTransaction() to hang forever,
 * but the read-only RPC provider (readProvider) still works because it doesn't depend
 * on the wallet provider's internal state.
 */

import { Web3Service } from '@/lib/web3';

describe('Web3Service - Mobile Provider Polling Bug', () => {
  it('should successfully wait for transaction even when provider.waitForTransaction is broken', async () => {
    // Create a mock provider that simulates the mobile bug:
    // - waitForTransaction() hangs forever (simulates broken provider after app-switch)
    // - send('eth_getTransactionReceipt') works correctly (RPC calls still function)
    const mockBrokenProvider = {
      // Simulate broken provider - waitForTransaction hangs forever
      waitForTransaction: jest.fn(() => {
        console.log('🔴 [TEST] provider.waitForTransaction() called - will hang forever (simulates mobile bug)');
        return new Promise(() => {
          // Never resolves - this is the bug!
        });
      }),

      // But direct RPC calls via send() work fine
      send: jest.fn((method: string, params: any[]) => {
        if (method === 'eth_getTransactionReceipt') {
          console.log('🟢 [TEST] provider.send(eth_getTransactionReceipt) called - returns receipt successfully');
          // Return a successful transaction receipt
          return Promise.resolve({
            blockNumber: '0x3039',
            status: '0x1',
            transactionHash: params[0]
          });
        }
        return Promise.resolve(null);
      }),

      // Add other required provider methods as no-ops
      getNetwork: jest.fn().mockResolvedValue({ chainId: 84532 }),
      getSigner: jest.fn(),
    } as any;

    // Create a mock readProvider (RPC-only provider that always works)
    const mockReadProvider = {
      getTransactionReceipt: jest.fn((txHash: string) => {
        console.log('🟢 [TEST] readProvider.getTransactionReceipt() called - returns receipt successfully');
        // Return a successful transaction receipt (numbers, not hex strings)
        return Promise.resolve({
          blockNumber: 12345,
          status: 1,
          hash: txHash
        });
      })
    } as any;

    // Get Web3Service instance and inject the broken provider + working readProvider
    // Note: We can't use getInstance() easily in tests because it requires full initialization
    // Instead, we'll create a minimal test instance by accessing the private constructor via reflection
    const Web3ServiceClass = Web3Service as any;
    const web3Service = Object.create(Web3ServiceClass.prototype);
    web3Service.provider = mockBrokenProvider;
    web3Service.readProvider = mockReadProvider;

    // Call waitForTransaction with a short timeout (5 seconds for fast test)
    const txHash = '0xTestTransactionHash';
    const receipt = await web3Service.waitForTransaction(txHash, 5000, 'test-contract');

    // With the NEW implementation (manual polling via readProvider), this should succeed
    // because it uses readProvider.getTransactionReceipt() instead of provider.waitForTransaction()
    expect(receipt).not.toBeNull();
    expect(receipt.status).toBe(1);
    expect(receipt.hash).toBe(txHash);

    // Verify that readProvider.getTransactionReceipt was called (new implementation)
    expect(mockReadProvider.getTransactionReceipt).toHaveBeenCalledWith(txHash);

    // The broken provider should NOT be used for transaction receipt polling
    // (If it were, the test would hang forever)
    expect(mockBrokenProvider.waitForTransaction).not.toHaveBeenCalled();
    expect(mockBrokenProvider.send).not.toHaveBeenCalled();

    console.log('✅ [TEST] Transaction confirmation succeeded using readProvider (RPC-only, no wallet access)');
  });
});
