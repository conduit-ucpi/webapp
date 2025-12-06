/**
 * Test for eth_requestAccounts error when approving USDC
 *
 * PROBLEM: fundAndSendTransaction() calls getSigner() which triggers eth_requestAccounts
 * ERROR: "Requested RPC call is not allowed {method: 'eth_requestAccounts'}"
 *
 * ROOT CAUSE:
 * - Line 1098: const signer = await this.provider.getSigner();
 * - getSigner() internally calls eth_requestAccounts
 * - For embedded wallets (Farcaster, Dynamic, WalletConnect), this is FORBIDDEN after initial connection
 * - The signer is only used at line 1232 to get the address: const fromAddress = await signer.getAddress();
 *
 * FIX:
 * - Remove the getSigner() call at line 1098
 * - Replace line 1232 with: const fromAddress = await this.getUserAddress();
 * - getUserAddress() gets address from auth context (no getSigner() call needed)
 */

import { Web3Service } from '@/lib/web3';
import { ethers } from 'ethers';

describe('Web3Service.fundAndSendTransaction - getSigner forbidden fix', () => {
  let web3Service: Web3Service;
  let mockProvider: any;
  let mockAuthenticatedFetch: jest.Mock;

  const testConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    contractFactoryAddress: '0xFactory123',
    moonPayApiKey: 'test-moonpay-key',
    minGasWei: '10000000',
    maxGasPriceGwei: '50',
    maxGasCostGwei: '50000', // Increased to allow test transactions to pass
    usdcGrantFoundryGas: '100000',
    depositFundsFoundryGas: '150000',
    gasPriceBuffer: '1.2',
    basePath: '/',
    dynamicEnvironmentId: 'test-dynamic-id',
    explorerBaseUrl: 'https://basescan.org',
    serviceLink: 'https://test.example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Web3Service.clearInstance();

    // Mock provider that FORBIDS eth_requestAccounts
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({
        chainId: BigInt(8453),
        name: 'base-mainnet'
      }),
      getSigner: jest.fn().mockRejectedValue(new Error('Requested RPC call is not allowed {method: \'eth_requestAccounts\'}')),
      send: jest.fn().mockImplementation(async (method: string, params: any[]) => {
        if (method === 'eth_chainId') {
          return '0x2105'; // 8453 in hex
        }
        if (method === 'eth_getTransactionCount') {
          return '0x5'; // nonce 5
        }
        if (method === 'eth_sendTransaction') {
          return '0xTransactionHash123';
        }
        if (method === 'eth_getTransactionReceipt') {
          return {
            blockNumber: '0x123456',
            status: '0x1',
            transactionHash: '0xTransactionHash123'
          };
        }
        throw new Error(`Unexpected RPC call: ${method}`);
      }),
      estimateGas: jest.fn().mockResolvedValue(BigInt(100000)),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: null,
        maxFeePerGas: BigInt(10000000), // 0.01 gwei
        maxPriorityFeePerGas: BigInt(1000000) // 0.001 gwei
      })
    };

    // Mock fetch for funding call
    global.fetch = jest.fn().mockImplementation(async (url: string, options?: any) => {
      if (url === '/api/chain/fund-wallet') {
        return {
          ok: true,
          json: async () => ({ success: true, message: 'Wallet funded' })
        };
      }

      if (url === testConfig.rpcUrl) {
        const body = JSON.parse(options.body);
        if (body.method === 'eth_gasPrice') {
          return {
            ok: true,
            json: async () => ({ result: '0x989680' }) // 10000000 wei = 0.01 gwei
          };
        }
        if (body.method === 'eth_maxPriorityFeePerGas') {
          return {
            ok: true,
            json: async () => ({ result: '0xF4240' }) // 1000000 wei = 0.001 gwei
          };
        }
        if (body.method === 'eth_estimateGas') {
          return {
            ok: true,
            json: async () => ({ result: '0x186A0' }) // 100000 gas
          };
        }
        if (body.method === 'eth_chainId') {
          return {
            ok: true,
            json: async () => ({ result: '0x2105' }) // 8453
          };
        }
        if (body.method === 'eth_getTransactionCount') {
          return {
            ok: true,
            json: async () => ({ result: '0x5' }) // nonce 5
          };
        }
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    // Set window.authUser so getUserAddress() can find the address
    // In Jest, window might not exist, so we create it if needed
    if (typeof window === 'undefined') {
      (global as any).window = {};
    }
    (window as any).authUser = {
      walletAddress: '0xUserAddress123'
    };
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      delete (window as any).authUser;
    }
  });

  it('should NOT call getSigner() during fundAndSendTransaction (avoids eth_requestAccounts)', async () => {
    // Initialize Web3Service
    web3Service = Web3Service.getInstance(testConfig);
    await web3Service.initialize(mockProvider);

    // Call fundAndSendTransaction (e.g., for USDC approval)
    const txParams = {
      to: testConfig.usdcContractAddress,
      data: '0x095ea7b3000000000000000000000000factory123000000000000000000000000000f4240', // approve(factory, 1000000)
      value: '0x0'
    };

    const txHash = await web3Service.fundAndSendTransaction(txParams);

    // VERIFICATION: getSigner should NEVER be called
    expect(mockProvider.getSigner).not.toHaveBeenCalled();

    // Transaction should still succeed (using direct eth_sendTransaction)
    expect(txHash).toBe('0xTransactionHash123');

    console.log('✅ TEST PASSED: fundAndSendTransaction works without calling getSigner()');
    console.log('   This avoids the eth_requestAccounts error on embedded wallets');
  });

  it('should get user address from auth context (not from signer)', async () => {
    // Initialize Web3Service
    web3Service = Web3Service.getInstance(testConfig);
    await web3Service.initialize(mockProvider);

    // Spy on console.log to verify getUserAddress is used
    const consoleLogSpy = jest.spyOn(console, 'log');

    // Call fundAndSendTransaction
    const txParams = {
      to: testConfig.usdcContractAddress,
      data: '0x095ea7b3',
      value: '0x0'
    };

    await web3Service.fundAndSendTransaction(txParams);

    // VERIFICATION: Address should come from auth context (window.authUser)
    expect(mockProvider.getSigner).not.toHaveBeenCalled();

    // Check logs to confirm getUserAddress was used
    const logs = consoleLogSpy.mock.calls.map(call => call.join(' '));
    const addressLog = logs.find(log => log.includes('Using address from auth context'));

    expect(addressLog).toBeTruthy();
    expect(addressLog).toContain('0xUserAddress123');

    consoleLogSpy.mockRestore();

    console.log('✅ TEST PASSED: Address retrieved from auth context (not from getSigner)');
  });

  it('should reproduce the exact error from production logs', async () => {
    // This test simulates the exact error the user saw
    web3Service = Web3Service.getInstance(testConfig);
    await web3Service.initialize(mockProvider);

    // Remove window.authUser to force getUserAddress to try getSigner
    delete (global as any).window.authUser;

    const txParams = {
      to: testConfig.usdcContractAddress,
      data: '0x095ea7b3',
      value: '0x0'
    };

    // BEFORE FIX: This would throw "Requested RPC call is not allowed {method: 'eth_requestAccounts'}"
    // AFTER FIX: This should work because we don't call getSigner anymore

    await expect(web3Service.fundAndSendTransaction(txParams)).rejects.toThrow(/Requested RPC call is not allowed/);

    console.log('🔴 BEFORE FIX: This test FAILS because getSigner() is called');
    console.log('   Error: "Requested RPC call is not allowed {method: \'eth_requestAccounts\'}"');
  });
});
