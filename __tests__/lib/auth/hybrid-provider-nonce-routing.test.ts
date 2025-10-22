/**
 * TDD Test: Nonce queries should NOT trigger wallet interactions on mobile
 *
 * PROBLEM: eth_getTransactionCount routed to wallet provider blocks MetaMask deep link
 *
 * ROOT CAUSE:
 * 1. Before transaction, we query nonce: eth_getTransactionCount
 * 2. HybridProvider routes it to wallet provider (line 59 of hybrid-provider-factory.ts)
 * 3. On mobile, this triggers a wallet interaction
 * 4. Then eth_sendTransaction tries to open MetaMask again → BLOCKED!
 *
 * SOLUTION: Route eth_getTransactionCount to READ provider (Base RPC)
 * - No wallet interaction for nonce queries
 * - eth_sendTransaction can successfully open MetaMask
 * - Nonce is still correct (comes from Base blockchain)
 */

import { createHybridProvider } from '@/lib/auth/providers/hybrid-provider-factory';

describe('HybridProvider - Nonce Routing for Mobile Deep Links', () => {
  let mockReadProvider: any;
  let mockWalletProvider: any;
  let hybridProvider: any;
  let walletInteractionCount: number;

  beforeEach(() => {
    walletInteractionCount = 0;

    // Mock read provider (Base RPC)
    mockReadProvider = {
      send: jest.fn().mockImplementation(async (method: string, params: any[]) => {
        if (method === 'eth_getTransactionCount') {
          // Base RPC returns nonce without wallet interaction
          return '0x5'; // nonce = 5
        }
        if (method === 'eth_chainId') {
          return '0x2105'; // Base Mainnet = 8453
        }
        return null;
      })
    };

    // Mock wallet provider
    mockWalletProvider = {
      request: jest.fn().mockImplementation(async ({ method, params }: any) => {
        if (method === 'eth_getTransactionCount') {
          // ❌ BAD: Wallet interaction for nonce query blocks deep link!
          walletInteractionCount++;
          return '0x5'; // nonce = 5
        }
        if (method === 'eth_sendTransaction') {
          // This is expected - transaction SHOULD go to wallet
          walletInteractionCount++;
          return '0xTransactionHash123';
        }
        if (method === 'eth_accounts') {
          return ['0xUser123'];
        }
        throw new Error(`Unexpected method: ${method}`);
      })
    };

    hybridProvider = createHybridProvider({
      readProvider: mockReadProvider,
      walletProvider: mockWalletProvider,
      chainId: 8453
    });
  });

  it('🔴 FAILING TEST: eth_getTransactionCount should route to READ provider, not wallet', async () => {
    // Query nonce (this happens before every transaction)
    const nonceHex = await hybridProvider.request({
      method: 'eth_getTransactionCount',
      params: ['0xUser123', 'pending']
    });

    // Verify result is correct
    expect(nonceHex).toBe('0x5');

    // CRITICAL: Nonce query should NOT have triggered wallet interaction!
    // Currently FAILS because it's routed to wallet (line 59 of hybrid-provider-factory.ts)
    expect(walletInteractionCount).toBe(0);

    // Verify it was routed to read provider
    expect(mockReadProvider.send).toHaveBeenCalledWith('eth_getTransactionCount', ['0xUser123', 'pending']);
    expect(mockWalletProvider.request).not.toHaveBeenCalled();
  });

  it('🔴 FAILING TEST: Transaction flow should only trigger ONE wallet interaction', async () => {
    // Realistic mobile transaction flow:
    // 1. Query nonce (should NOT open wallet)
    // 2. Send transaction (SHOULD open wallet)

    // Step 1: Query nonce
    await hybridProvider.request({
      method: 'eth_getTransactionCount',
      params: ['0xUser123', 'pending']
    });

    // Step 2: Send transaction
    await hybridProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: '0xUser123',
        to: '0xRecipient',
        value: '0x0',
        data: '0x'
      }]
    });

    // CRITICAL: Only ONE wallet interaction (the transaction)
    // Currently FAILS because nonce query also goes to wallet (2 interactions total)
    expect(walletInteractionCount).toBe(1);
  });

  it('✅ eth_sendTransaction should correctly route to wallet', async () => {
    // Transactions SHOULD go to wallet
    const txHash = await hybridProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: '0xUser123',
        to: '0xRecipient',
        value: '0x0'
      }]
    });

    expect(txHash).toBe('0xTransactionHash123');
    expect(mockWalletProvider.request).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params: expect.any(Array)
    });
    expect(walletInteractionCount).toBe(1);
  });

  it('✅ eth_chainId should route to read provider (not wallet)', async () => {
    // Chain ID queries should go to Base RPC
    const chainIdHex = await hybridProvider.request({
      method: 'eth_chainId',
      params: []
    });

    expect(chainIdHex).toBe('0x2105'); // Base Mainnet
    expect(mockReadProvider.send).toHaveBeenCalledWith('eth_chainId', []);
    expect(walletInteractionCount).toBe(0);
  });
});
