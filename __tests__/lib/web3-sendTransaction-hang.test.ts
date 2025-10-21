/**
 * Test that demonstrates the mobile bug where signer.sendTransaction() hangs
 * even though eth_sendTransaction RPC call completes successfully.
 *
 * PRODUCTION BUG:
 * - User approves transaction in MetaMask mobile
 * - eth_sendTransaction completes successfully and returns tx hash
 * - But signer.sendTransaction() promise never resolves
 * - Code hangs at line 1067 of lib/web3.ts
 * - UI shows "Step 2: Approving USDC transfer..." forever
 *
 * This test should FAIL until we fix the underlying issue.
 */

import { Web3Service } from '@/lib/web3';

describe('Web3Service - signer.sendTransaction() hang bug', () => {
  it('should return transaction hash immediately even if signer.sendTransaction hangs', async () => {
    // Create a mock provider that simulates the mobile bug:
    // - eth_sendTransaction RPC call works and returns tx hash
    // - But the signer.sendTransaction() Promise never resolves

    const mockTxHash = '0xabcdef1234567890';

    const mockBrokenProvider = {
      // RPC methods work fine
      send: jest.fn((method: string, params: any[]) => {
        if (method === 'eth_sendTransaction') {
          console.log('✅ [TEST] eth_sendTransaction RPC call completed - returning hash');
          return Promise.resolve(mockTxHash); // RPC call succeeds
        }
        if (method === 'eth_chainId') {
          return Promise.resolve('0x14a34');
        }
        if (method === 'eth_getTransactionCount') {
          return Promise.resolve('0x1');
        }
        return Promise.resolve(null);
      }),

      // But getSigner().sendTransaction() hangs forever (the actual bug)
      getSigner: jest.fn(() => ({
        sendTransaction: jest.fn(() => {
          console.log('🔴 [TEST] signer.sendTransaction() called - will hang forever (simulating mobile bug)');
          // Return a promise that never resolves - this is the bug!
          return new Promise(() => {
            // Never resolves - hangs forever
          });
        }),
        getAddress: jest.fn().mockResolvedValue('0xUserAddress')
      })),

      getNetwork: jest.fn().mockResolvedValue({ chainId: 84532 }),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt(1000000), // 0.001 gwei
        maxFeePerGas: BigInt(2000000),
        maxPriorityFeePerGas: BigInt(1000000)
      })
    };

    // Create Web3Service instance with broken provider
    // Use reflection pattern from other tests to bypass initialization
    const Web3ServiceClass = Web3Service as any;
    const web3Service = Object.create(Web3ServiceClass.prototype);
    web3Service.provider = mockBrokenProvider;
    web3Service.config = {
      chainId: 84532,
      rpcUrl: 'http://localhost:8545',
      usdcContractAddress: '0xUSDC',
      maxGasPriceGwei: '10000',  // High enough to pass validation
      maxGasCostGwei: '100000',  // High enough to pass validation
      gasPriceBuffer: '1.5',
      usdcGrantFoundryGas: '100000',
      depositFundsFoundryGas: '150000'
    };

    // Mock the fund-wallet API call
    global.fetch = jest.fn((url) => {
      if (url === '/api/chain/fund-wallet') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'Funded' })
        } as Response);
      }
      return Promise.reject(new Error('Unexpected fetch call'));
    }) as jest.Mock;

    // Call fundAndSendTransaction
    // This SHOULD return the transaction hash immediately
    // But currently it hangs forever (the bug)
    const txHashPromise = web3Service.fundAndSendTransaction({
      to: '0xContract',
      data: '0x095ea7b3', // approve function
      value: '0x0'
    });

    // Expect it to return the transaction hash
    // This will FAIL (timeout) because of the bug - signer.sendTransaction() hangs
    // After fixing, this will PASS - it will return the hash immediately
    const result = await txHashPromise;

    expect(result).toBe(mockTxHash);
    console.log('✅ [TEST] Transaction hash returned successfully - BUG IS FIXED!');
  }, 5000); // 5 second jest timeout
});
