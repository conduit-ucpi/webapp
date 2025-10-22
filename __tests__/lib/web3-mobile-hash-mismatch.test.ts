/**
 * TDD Test for Mobile Transaction Hash Mismatch Bug
 *
 * Problem: On mobile, signer.sendTransaction() returns a hash that doesn't match
 * the actual transaction submitted by MetaMask.
 *
 * Evidence from production (v38.1.5):
 * - App received hash: 0xd676b974bef5f2a5615273c0d25c6f2a2111f1ff181d09a1651cd78f553dde57
 * - MetaMask actual hash: 0x6b7c3963b7d1453deb4952db1ec38f06f0af2cd0fa013c95b0d8b8727cb795b9
 * - Both hashes exist on Base, but belong to DIFFERENT transactions
 * - App polls forever for wrong hash while real transaction is already confirmed
 *
 * Solution: After sendTransaction returns, verify the hash by querying blockchain
 * for recent transactions from user's address filtered by nonce.
 */

import { ethers } from 'ethers';
import { Web3Service } from '@/lib/web3';

describe('Mobile Transaction Hash Mismatch', () => {
  let web3Service: Web3Service;
  let mockProvider: any;
  let mockSigner: any;

  const USER_ADDRESS = '0xc9d0602a87e55116f633b1a1f95d083eb115f942';
  const WRONG_HASH = '0xd676b974bef5f2a5615273c0d25c6f2a2111f1ff181d09a1651cd78f553dde57'; // Hash for different transaction
  const CORRECT_HASH = '0x6b7c3963b7d1453deb4952db1ec38f06f0af2cd0fa013c95b0d8b8727cb795b9'; // Actual transaction hash
  const TRANSACTION_NONCE = 35;

  beforeEach(() => {
    // Mock fetch for fund-wallet API call
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Wallet funded successfully' }),
    } as Response);

    // Create mock provider that simulates mobile behavior
    mockProvider = {
      request: jest.fn(),
      send: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    // Create mock signer
    mockSigner = {
      getAddress: jest.fn().mockResolvedValue(USER_ADDRESS),
      estimateGas: jest.fn().mockResolvedValue(BigInt(67474)),
    };

    // Mock provider.getSigner to return our mock signer
    mockProvider.getSigner = jest.fn().mockResolvedValue(mockSigner);

    // Mock provider methods
    mockProvider.request = jest.fn().mockImplementation(async (args: { method: string; params?: any[] }) => {
      if (args.method === 'eth_sendTransaction') {
        // BUG: Returns WRONG hash (simulates mobile bug)
        return WRONG_HASH;
      }
      return null;
    });

    mockProvider.send.mockImplementation((method: string, params: any[]) => {
      if (method === 'eth_getTransactionCount') {
        // Return the nonce that will be used for THIS transaction
        // eth_getTransactionCount with "pending" returns the NEXT nonce to use
        return Promise.resolve(`0x${TRANSACTION_NONCE.toString(16)}`);
      }
      if (method === 'eth_blockNumber') {
        // Return current block number
        return Promise.resolve('0x236cc00');
      }
      if (method === 'eth_getBlockByNumber') {
        // Return recent block with transactions
        return Promise.resolve({
          number: params[0], // Block number from params
          transactions: [CORRECT_HASH], // User's actual transaction
        });
      }
      if (method === 'eth_getTransactionByHash') {
        if (params[0] === CORRECT_HASH) {
          // Return the REAL transaction (user's USDC approval)
          return Promise.resolve({
            hash: CORRECT_HASH,
            from: USER_ADDRESS,
            to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
            nonce: `0x${TRANSACTION_NONCE.toString(16)}`,
            blockNumber: '0x236cc00',
          });
        }
        if (params[0] === WRONG_HASH) {
          // Return the WRONG transaction (different user)
          return Promise.resolve({
            hash: WRONG_HASH,
            from: '0x1936cad0b758ad8f83ca392ac9138ff2b4ab0b05', // Different user!
            to: '0x5d2efbffa33026b95acad4a21bc1c925f39a93cd',
            nonce: '0x188', // Different nonce!
            blockNumber: '0x23717a2',
          });
        }
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    // Create Web3Service with mock provider
    const mockConfig = {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'sapphire_devnet',
      rpcUrl: 'https://mainnet.base.org',
      chainId: 8453,
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractFactoryAddress: '0xFactory123',
      moonPayApiKey: 'test-key',
      minGasWei: '5',
      maxGasPriceGwei: '100',
      maxGasCostGwei: '10000000', // 10 million gwei = 0.01 ETH (high limit for testing)
      usdcGrantFoundryGas: '100000',
      depositFundsFoundryGas: '200000',
      gasPriceBuffer: '1.1',
      basePath: '/',
      explorerBaseUrl: 'https://basescan.org',
      serviceLink: 'https://test.conduit-ucpi.com',
    };

    Web3Service.clearInstance();
    web3Service = Web3Service.getInstance(mockConfig);
    (web3Service as any).provider = mockProvider;
    (web3Service as any).isInitialized = true;
  });

  afterEach(() => {
    Web3Service.clearInstance();
    jest.clearAllMocks();
    delete (global as any).fetch;
  });

  it('should detect and correct hash mismatch by querying blockchain for actual transaction', async () => {
    // This test demonstrates the bug and the fix
    //
    // Bug behavior:
    // 1. User sends USDC approval transaction on mobile MetaMask
    // 2. signer.sendTransaction() returns hash 0xd676b... (WRONG)
    // 3. MetaMask actually submits transaction with hash 0x6b7c... (CORRECT)
    // 4. App polls for 0xd676b... forever
    // 5. Real transaction 0x6b7c... is already confirmed but app doesn't know
    //
    // Fix behavior:
    // 1. After sendTransaction returns (potentially wrong) hash
    // 2. Query blockchain for recent transactions from user's address
    // 3. Filter by the nonce we used for this transaction
    // 4. Find the transaction matching our address + nonce
    // 5. Extract the REAL hash from that transaction
    // 6. Use REAL hash for polling (will find transaction immediately)

    const tx = {
      to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      data: '0x095ea7b3000000000000000000000000ff9759667dd4c5d9be80027788ae90d465cae8ab00000000000000000000000000000000000000000000000000000000000003e8',
      value: BigInt(0),
      gasLimit: BigInt(67474),
      maxFeePerGas: BigInt(11189020),
      maxPriorityFeePerGas: BigInt(1000000),
    };

    // Send transaction - will return WRONG hash
    const returnedHash = await (web3Service as any).fundAndSendTransaction(tx);

    // BEFORE FIX: This would return the wrong hash
    // expect(returnedHash).toBe(WRONG_HASH); // ❌ Wrong hash, will poll forever

    // AFTER FIX: Should verify and correct the hash
    expect(returnedHash).toBe(CORRECT_HASH); // ✅ Correct hash, polling will succeed

    // Verify that blockchain was queried to find real transaction
    expect(mockProvider.send).toHaveBeenCalledWith('eth_blockNumber', []);
    expect(mockProvider.send).toHaveBeenCalledWith('eth_getTransactionByHash', [CORRECT_HASH]);
  });

  it('should fall back to returned hash if verification fails', async () => {
    // If we can't verify the hash (RPC errors, no matching transaction, etc.),
    // fall back to the hash returned by eth_sendTransaction
    //
    // This ensures the fix doesn't break existing working cases

    // Mock eth_sendTransaction to return wrong hash
    mockProvider.request = jest.fn().mockImplementation(async (args: { method: string; params?: any[] }) => {
      if (args.method === 'eth_sendTransaction') {
        return WRONG_HASH;
      }
      return null;
    });

    // Mock nonce query to succeed, but verification queries to fail
    mockProvider.send.mockImplementation((method: string, params: any[]) => {
      if (method === 'eth_getTransactionCount') {
        // Allow nonce query to succeed - return the nonce to use for this transaction
        return Promise.resolve(`0x${TRANSACTION_NONCE.toString(16)}`);
      }
      if (method === 'eth_blockNumber') {
        // Allow block number query to succeed
        return Promise.resolve('0x236cc00');
      }
      // All other queries fail (verification will fail)
      return Promise.reject(new Error('RPC error'));
    });

    const tx = {
      to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      data: '0x095ea7b3...',
      value: BigInt(0),
      gasLimit: BigInt(67474),
    };

    const returnedHash = await (web3Service as any).fundAndSendTransaction(tx);

    // Should return the hash from sendTransaction (even if wrong) as fallback
    expect(returnedHash).toBe(WRONG_HASH);
  });
});
