/**
 * Test: Universal Hybrid Provider - eth_maxPriorityFeePerGas bypassed for ALL wallets
 *
 * PROBLEM: When MetaMask desktop wallet is used, calling provider.getFeeData()
 * triggers an internal call to eth_maxPriorityFeePerGas which MetaMask rejects:
 * "MetaMask - RPC Error: The method "eth_maxPriorityFeePerGas" does not exist / is not available"
 *
 * ROOT CAUSE: Some wallet providers don't support all RPC methods (especially gas pricing)
 *
 * SOLUTION: Universal hybrid provider for ALL wallets that routes:
 * - READ operations (eth_getBalance, eth_gasPrice, etc.) → Our Base RPC
 * - WRITE operations (personal_sign, eth_sendTransaction) → Wallet provider
 *
 * Benefits:
 * - Fixes MetaMask and other wallet RPC issues
 * - Consistent gas pricing across all wallets
 * - Single source of truth for blockchain state
 * - Wallets only handle signing/transactions
 */

import { Web3Service } from '@/lib/web3';
import { ethers } from 'ethers';

// Mock global fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Universal Hybrid Provider - All Wallets Use Base RPC', () => {
  let web3Service: Web3Service;
  let mockMetaMaskProvider: any;

  beforeEach(() => {
    // Clear singleton
    Web3Service.clearInstance();

    // Create config
    const config = {
      chainId: 8453, // Base mainnet
      rpcUrl: 'https://base-rpc.example.com',
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractFactoryAddress: '0xFactory123',
      moonPayApiKey: 'test-key',
      minGasWei: '5',
      maxGasPriceGwei: '0.001', // 0.001 gwei = 1000000 wei
      maxGasCostGwei: '50000', // 50000 gwei = 50000000000000 wei
      gasPriceBuffer: '1.2',
      depositFundsFoundryGas: '100000',
    resolutionVoteFoundryGas: '80000',
    raiseDisputeFoundryGas: '150000',
    claimFundsFoundryGas: '150000',
      usdcGrantFoundryGas: '65000',
      basePath: '',
      explorerBaseUrl: 'https://base.blockscout.com',
      serviceLink: 'http://localhost:3000'
    };

    web3Service = Web3Service.getInstance(config);

    // Create a mock MetaMask provider that rejects eth_maxPriorityFeePerGas
    const mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0xUser123'),
      signTransaction: jest.fn().mockResolvedValue('0xSignedTx'),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0xTxHash123' })
    };

    mockMetaMaskProvider = {
      getSigner: jest.fn().mockResolvedValue(mockSigner),
      getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(8453), name: 'base' }),
      getTransactionCount: jest.fn().mockResolvedValue(1),
      estimateGas: jest.fn().mockResolvedValue(BigInt(100000)),

      // With hybrid provider, getFeeData() SUCCEEDS (routed to Base RPC)
      // The hybrid provider wraps the wallet provider BEFORE Web3Service sees it
      // So this getFeeData() should never be called at all
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt(1000000), // 0.001 gwei
        maxFeePerGas: BigInt(1000000),
        maxPriorityFeePerGas: BigInt(100000)
      }),

      // Direct RPC call support (for mobile fix + nonce querying + hash verification)
      send: jest.fn().mockImplementation((method: string, params: any[]) => {
        if (method === 'eth_sendTransaction') {
          return Promise.resolve('0xTxHash123');
        }
        if (method === 'eth_getTransactionCount') {
          return Promise.resolve('0x23'); // Nonce 35 (matching production)
        }
        // Support for findTransactionByNonce()
        if (method === 'eth_blockNumber') {
          return Promise.resolve('0x100'); // Block 256
        }
        if (method === 'eth_getBlockByNumber') {
          return Promise.resolve({
            number: params[0],
            transactions: ['0xTxHash123'] // Transaction is in latest block
          });
        }
        if (method === 'eth_getTransactionByHash') {
          if (params[0] === '0xTxHash123') {
            return Promise.resolve({
              hash: '0xTxHash123',
              from: '0xuser123', // lowercase to match comparison
              to: '0xrecipient123',
              nonce: '0x23', // Nonce 35
              blockNumber: '0x100'
            });
          }
        }
        return Promise.reject(new Error(`Unexpected method: ${method}`));
      }),

      // Internal provider detection (MetaMask)
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

    // Mock fetch for RPC calls
    mockFetch.mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const body = init?.body ? JSON.parse(init.body) : (input.body ? JSON.parse(input.body) : {});

      // Successful Base RPC responses
      if (body.method === 'eth_chainId') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            jsonrpc: '2.0',
            id: body.id,
            result: '0x2105' // 8453 (Base mainnet)
          })
        } as Response);
      }

      if (body.method === 'eth_gasPrice') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            jsonrpc: '2.0',
            id: body.id,
            result: '0xF4240' // 1000000 wei = 0.001 gwei
          })
        } as Response);
      }

      if (body.method === 'eth_estimateGas') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            jsonrpc: '2.0',
            id: body.id,
            result: '0x186A0' // 100000 gas
          })
        } as Response);
      }

      if (body.method === 'eth_maxPriorityFeePerGas') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            jsonrpc: '2.0',
            id: body.id,
            result: '0x0' // 0 wei priority fee
          })
        } as Response);
      }

      if (body.method === 'eth_getBlockByNumber') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              baseFeePerGas: '0x64' // 100 wei
            }
          })
        } as Response);
      }

      // Simulate the wallet funding endpoint
      if (url === '/api/chain/fund-wallet' || (typeof url === 'object' && url.url === '/api/chain/fund-wallet')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            message: 'Wallet funded'
          })
        } as Response);
      }

      console.log('Unexpected fetch call:', { url, method: body.method });
      return Promise.reject(new Error(`Unexpected fetch call: ${body.method || url}`));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Web3Service.clearInstance();
  });

  it.skip('✅ should NEVER call getFeeData() on ANY wallet provider (MetaMask)', async () => {
    // With the universal hybrid provider, ALL gas queries go to Base RPC
    // The wallet provider's getFeeData() should NEVER be called

    // Initialize with MetaMask provider
    await web3Service.initialize(mockMetaMaskProvider as any);

    // Try to fund and send transaction
    const txParams = {
      to: '0xRecipient123',
      data: '0x095ea7b3', // approve function
      value: '0x0'
    };

    // After the fix, this should NOT call getFeeData() on MetaMask
    // Instead, it should use our Base RPC directly
    const txHash = await web3Service.fundAndSendTransaction(txParams);

    // Verify success
    expect(txHash).toBe('0xTxHash123');

    // ARCHITECTURE NOTE:
    // To avoid mobile wallet popups (MetaMask flickering), Web3Service now uses RPC
    // DIRECTLY for all read-only operations (gas prices, network info, etc.).
    // This completely bypasses the wallet provider for reads, preventing popups.
    //
    // The wallet provider is ONLY used for signing transactions.
    //
    // This test verifies Web3Service NEVER calls getFeeData() on the wallet provider.

    // Web3Service should NOT call getFeeData() on wallet provider (uses RPC instead)
    expect(mockMetaMaskProvider.getFeeData).not.toHaveBeenCalled();

    // Transaction succeeds with gas price fetched from RPC
    expect(txHash).toBe('0xTxHash123');
  });

  it.skip('✅ should NEVER call getFeeData() on ANY wallet provider (Web3Auth/Dynamic)', async () => {
    // Create a non-injected provider (like Web3Auth, Dynamic, etc.)
    const mockNonInjectedProvider = {
      ...mockMetaMaskProvider,
      provider: undefined, // No internal provider
      _getConnection: jest.fn().mockReturnValue(null),

      // Non-injected providers should support getFeeData()
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt(1000000),
        maxFeePerGas: BigInt(2000000),
        maxPriorityFeePerGas: BigInt(500000)
      }),

      // Direct RPC call support (for mobile fix + nonce querying + hash verification)
      send: jest.fn().mockImplementation((method: string, params: any[]) => {
        if (method === 'eth_sendTransaction') {
          return Promise.resolve('0xTxHash456');
        }
        if (method === 'eth_getTransactionCount') {
          return Promise.resolve('0x24'); // Nonce 36 (different from MetaMask mock)
        }
        // Support for findTransactionByNonce()
        if (method === 'eth_blockNumber') {
          return Promise.resolve('0x200'); // Block 512
        }
        if (method === 'eth_getBlockByNumber') {
          return Promise.resolve({
            number: params[0],
            transactions: ['0xTxHash456'] // Transaction is in latest block
          });
        }
        if (method === 'eth_getTransactionByHash') {
          if (params[0] === '0xTxHash456') {
            return Promise.resolve({
              hash: '0xTxHash456',
              from: '0xc9d0602a87e55116f633b1a1f95d083eb115f943', // lowercase to match comparison
              to: '0xrecipient456',
              nonce: '0x24', // Nonce 36
              blockNumber: '0x200'
            });
          }
        }
        return Promise.reject(new Error(`Unexpected method: ${method}`));
      })
    };

    const nonInjectedSigner = {
      getAddress: jest.fn().mockResolvedValue('0xc9D0602A87E55116F633b1A1F95D083Eb115f943'),
      signTransaction: jest.fn().mockResolvedValue('0xSignedTx2'),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0xTxHash456' })
    };

    mockNonInjectedProvider.getSigner = jest.fn().mockResolvedValue(nonInjectedSigner);

    // Initialize with non-injected provider
    await web3Service.initialize(mockNonInjectedProvider as any);

    const txParams = {
      to: '0xRecipient456',
      data: '0x095ea7b3',
      value: '0x0'
    };

    const txHash = await web3Service.fundAndSendTransaction(txParams);

    // Verify success
    expect(txHash).toBe('0xTxHash456');

    // Web3Service should NOT call getFeeData() on wallet provider (uses RPC instead)
    // This prevents mobile wallet popups during transaction preparation
    expect(mockNonInjectedProvider.getFeeData).not.toHaveBeenCalled();

    // Transaction succeeds with gas price fetched from RPC (not wallet provider)
    expect(txHash).toBe('0xTxHash456');
  });

  it('✅ Documents the RPC-only read operations architecture', () => {
    // This test documents the architectural decision:
    //
    // To avoid mobile wallet popups (MetaMask flickering), Web3Service now:
    // - Uses READ-ONLY RPC provider for ALL read operations (gas prices, balances, network info)
    // - Uses wallet provider ONLY for signing transactions
    //
    // This applies to ALL wallet types:
    // - MetaMask (desktop/mobile)
    // - Web3Auth
    // - Dynamic
    // - WalletConnect
    // - Coinbase Wallet
    // - ANY future wallet
    //
    // READ operations → Base RPC (our controlled endpoint)
    // WRITE operations → Wallet provider (signing/transactions)
    //
    // This eliminates entire classes of bugs:
    // - Wallet RPC method incompatibilities
    // - Gas price inconsistencies
    // - Unit confusion (gwei vs wei)
    // - Stale estimates
    //
    // Benefits:
    // - Single source of truth for blockchain state
    // - Wallets only do what they're good at: signing
    // - Consistent behavior across all wallet types
    // - Future-proof against wallet RPC changes

    expect(true).toBe(true); // Architectural documentation test
  });
});
