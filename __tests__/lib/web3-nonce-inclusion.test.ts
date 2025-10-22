/**
 * Test: Transaction params MUST include nonce to ensure hash consistency
 *
 * PROBLEM: When we send a transaction without a nonce, MetaMask:
 * 1. Calculates what the nonce should be
 * 2. Returns a hash based on that nonce
 * 3. But then the nonce changes (network state, race conditions)
 * 4. Submits with a different nonce
 * 5. Result: Different transaction hash
 *
 * SOLUTION: Query eth_getTransactionCount BEFORE sending transaction
 * and include the nonce in our transaction params. This ensures the hash
 * MetaMask returns matches the hash it actually submits.
 *
 * EVIDENCE FROM PRODUCTION:
 * - We sent params WITHOUT nonce (see autolog.log 06:34:01.607Z)
 * - MetaMask returned: 0x81feb107ec4730673fcf96689c74ea4ee39720f1536c1f72c915151e262be268
 * - MetaMask submitted: 0x6b7c3963b7d1453deb4952db1ec38f06f0af2cd0fa013c95b0d8b8727cb795b9 (nonce: 35)
 * - Our code polled for 0x81feb107... which doesn't exist on blockchain
 */

import { Web3Service } from '@/lib/web3';

// Mock global fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Web3Service - Nonce Inclusion in Transaction Params', () => {
  let web3Service: Web3Service;
  let mockProvider: any;
  let capturedTxParams: any = null;

  beforeEach(() => {
    // Clear singleton
    Web3Service.clearInstance();

    // Create config
    const config = {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'testnet',
      chainId: 8453, // Base mainnet
      rpcUrl: 'https://base-rpc.example.com',
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractFactoryAddress: '0xFactory123',
      moonPayApiKey: 'test-key',
      minGasWei: '5',
      maxGasPriceGwei: '0.001',
      maxGasCostGwei: '50000',
      gasPriceBuffer: '1.2',
      depositFundsFoundryGas: '100000',
      usdcGrantFoundryGas: '65000',
      basePath: '',
      explorerBaseUrl: 'https://base.blockscout.com',
      serviceLink: 'http://localhost:3000'
    };

    web3Service = Web3Service.getInstance(config);

    // Create a mock provider that captures the transaction params
    const mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0xc9D0602A87E55116F633b1A1F95D083Eb115f942'),
      signTransaction: jest.fn().mockResolvedValue('0xSignedTx'),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0xTxHash123' })
    };

    mockProvider = {
      getSigner: jest.fn().mockResolvedValue(mockSigner),
      getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(8453), name: 'base' }),

      // CRITICAL: Capture transaction params when eth_sendTransaction is called
      send: jest.fn().mockImplementation((method: string, params: any[]) => {
        if (method === 'eth_sendTransaction') {
          // Capture the params for assertion
          capturedTxParams = params[0];
          return Promise.resolve('0xTxHash123');
        }
        if (method === 'eth_getTransactionCount') {
          return Promise.resolve('0x23'); // Nonce 35 (same as production)
        }
        if (method === 'eth_gasPrice') {
          return Promise.resolve('0xF4240'); // 1000000 wei
        }
        if (method === 'eth_estimateGas') {
          return Promise.resolve('0x186A0'); // 100000 gas
        }
        return Promise.reject(new Error(`Unexpected method: ${method}`));
      }),

      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt(1000000),
        maxFeePerGas: BigInt(1000000),
        maxPriorityFeePerGas: BigInt(100000)
      }),

      provider: {
        isMetaMask: true,
        isInjected: true
      },

      _getConnection: jest.fn().mockReturnValue({
        provider: {
          isMetaMask: true,
          isInjected: true
        }
      })
    };

    // Mock fetch for wallet funding
    mockFetch.mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url === '/api/chain/fund-wallet' || (typeof url === 'object' && url.url === '/api/chain/fund-wallet')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            message: 'Wallet funded'
          })
        } as Response);
      }

      return Promise.reject(new Error('Unexpected fetch call'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Web3Service.clearInstance();
    capturedTxParams = null;
  });

  it('🔴 MUST include nonce in transaction params to prevent hash mismatch', async () => {
    // Initialize with provider
    await web3Service.initialize(mockProvider as any);

    // Send a transaction (USDC approval)
    const txParams = {
      to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      data: '0x095ea7b3', // approve function
      value: '0x0'
    };

    await web3Service.fundAndSendTransaction(txParams);

    // CRITICAL ASSERTION: Transaction params MUST include a nonce
    expect(capturedTxParams).toBeDefined();
    expect(capturedTxParams.nonce).toBeDefined();
    expect(capturedTxParams.nonce).toBe('0x23'); // Nonce 35 in hex

    // Also verify the provider was asked for the nonce
    expect(mockProvider.send).toHaveBeenCalledWith('eth_getTransactionCount', expect.anything());
  });

  it('🔴 Should query eth_getTransactionCount before sending transaction', async () => {
    // Initialize with provider
    await web3Service.initialize(mockProvider as any);

    // Send a transaction
    const txParams = {
      to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      data: '0x095ea7b3',
      value: '0x0'
    };

    await web3Service.fundAndSendTransaction(txParams);

    // Verify eth_getTransactionCount was called
    expect(mockProvider.send).toHaveBeenCalledWith(
      'eth_getTransactionCount',
      expect.arrayContaining([
        expect.stringMatching(/^0x[a-fA-F0-9]{40}$/), // address
        'pending' // use pending nonce to account for pending transactions
      ])
    );

    // Verify it was called BEFORE eth_sendTransaction
    const calls = mockProvider.send.mock.calls;
    const nonceCallIndex = calls.findIndex((call: any[]) => call[0] === 'eth_getTransactionCount');
    const sendTxCallIndex = calls.findIndex((call: any[]) => call[0] === 'eth_sendTransaction');

    expect(nonceCallIndex).toBeGreaterThanOrEqual(0);
    expect(sendTxCallIndex).toBeGreaterThan(nonceCallIndex);
  });
});
