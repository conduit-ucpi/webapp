/**
 * Tests for HybridProvider routing logic
 *
 * CRITICAL: These tests verify correct routing of RPC methods:
 * - READ operations (eth_chainId, eth_getTransactionReceipt, etc.) → Base RPC
 * - WRITE operations (eth_sendTransaction, personal_sign, etc.) → Wallet provider
 * - NONCE queries (eth_getTransactionCount) → Wallet provider (for hash consistency)
 *
 * NOTE: eth_getTransactionCount routes to wallet provider (not Base RPC) to ensure
 * the nonce comes from the same source that validates it. This happens BEFORE app-switch
 * when the wallet provider still works. After app-switch, we only poll receipts.
 */

import { createHybridProvider } from '@/lib/auth/providers/hybrid-provider-factory';

describe('HybridProvider - Routing Logic', () => {
  describe('eth_chainId routing', () => {
    it('should route eth_chainId to READ provider, NOT wallet provider (mobile fix)', async () => {
      // Mock wallet provider that would hang/fail (simulates broken state after app-switch)
      const mockWalletProvider = {
        request: jest.fn(() => {
          throw new Error('Wallet provider is broken after app-switch - should not be called for eth_chainId!');
        })
      };

      // Mock read provider that works reliably
      const mockReadProvider = {
        send: jest.fn((method: string) => {
          if (method === 'eth_chainId') {
            return Promise.resolve('0x14a34'); // Base Sepolia chainId
          }
          return Promise.reject(new Error(`Unexpected method: ${method}`));
        })
      };

      // Create hybrid provider
      const hybrid = createHybridProvider({
        walletProvider: mockWalletProvider,
        readProvider: mockReadProvider,
        chainId: 84532
      });

      // Call eth_chainId - should route to READ provider
      const result = await hybrid.request({ method: 'eth_chainId', params: [] });

      // Verify it used the read provider (Base RPC)
      expect(mockReadProvider.send).toHaveBeenCalledWith('eth_chainId', []);

      // Verify it did NOT use the wallet provider (which is broken)
      expect(mockWalletProvider.request).not.toHaveBeenCalled();

      // Verify we got the correct result
      expect(result).toBe('0x14a34');

      console.log('✅ eth_chainId correctly routed to read provider (mobile fix working)');
    });
  });

  describe('eth_getTransactionCount routing', () => {
    it('should route eth_getTransactionCount to WALLET provider for nonce hash consistency', async () => {
      // NONCE FIX: eth_getTransactionCount now routes to WALLET provider (not read provider)
      // This ensures nonce comes from same source that validates it (the wallet).
      // Query happens BEFORE app-switch when wallet provider works fine.
      // After app-switch, we only poll eth_getTransactionReceipt (routed to Base RPC), never nonce.

      // Mock read provider - should NOT be called for nonce queries
      const mockReadProvider = {
        send: jest.fn(() => {
          throw new Error('Read provider should not be called for eth_getTransactionCount!');
        })
      };

      // Mock wallet provider - SHOULD handle nonce queries (before app-switch)
      const mockWalletProvider = {
        request: jest.fn((args: any) => {
          if (args.method === 'eth_getTransactionCount') {
            return Promise.resolve('0x5'); // nonce = 5 from wallet's perspective
          }
          return Promise.reject(new Error(`Unexpected method: ${args.method}`));
        })
      };

      // Create hybrid provider
      const hybrid = createHybridProvider({
        walletProvider: mockWalletProvider,
        readProvider: mockReadProvider,
        chainId: 84532
      });

      // Call eth_getTransactionCount - should route to WALLET provider
      const result = await hybrid.request({
        method: 'eth_getTransactionCount',
        params: ['0xUserAddress', 'latest']
      });

      // Verify it used the wallet provider (for nonce consistency)
      expect(mockWalletProvider.request).toHaveBeenCalledWith({
        method: 'eth_getTransactionCount',
        params: ['0xUserAddress', 'latest']
      });

      // Verify it did NOT use the read provider
      expect(mockReadProvider.send).not.toHaveBeenCalled();

      // Verify we got the correct result (from wallet's nonce view)
      expect(result).toBe('0x5');

      console.log('✅ eth_getTransactionCount correctly routed to wallet provider (nonce hash fix)');
    });
  });

  describe('eth_sendTransaction routing', () => {
    it('should route eth_sendTransaction to WALLET provider, NOT read provider', async () => {
      // Mock read provider - should NOT be called for write operations
      const mockReadProvider = {
        send: jest.fn(() => {
          throw new Error('Read provider should not be called for eth_sendTransaction!');
        })
      };

      // Mock wallet provider - SHOULD handle signing/transactions
      const mockWalletProvider = {
        request: jest.fn((args: any) => {
          if (args.method === 'eth_sendTransaction') {
            return Promise.resolve('0xTransactionHash');
          }
          return Promise.reject(new Error(`Unexpected method: ${args.method}`));
        })
      };

      // Create hybrid provider
      const hybrid = createHybridProvider({
        walletProvider: mockWalletProvider,
        readProvider: mockReadProvider,
        chainId: 84532
      });

      // Call eth_sendTransaction - should route to WALLET provider
      const result = await hybrid.request({
        method: 'eth_sendTransaction',
        params: [{ to: '0xRecipient', value: '0x0' }]
      });

      // Verify it used the wallet provider (for signing)
      expect(mockWalletProvider.request).toHaveBeenCalledWith({
        method: 'eth_sendTransaction',
        params: [{ to: '0xRecipient', value: '0x0' }]
      });

      // Verify it did NOT use the read provider
      expect(mockReadProvider.send).not.toHaveBeenCalled();

      // Verify we got the correct result
      expect(result).toBe('0xTransactionHash');

      console.log('✅ eth_sendTransaction correctly routed to wallet provider');
    });
  });
});
