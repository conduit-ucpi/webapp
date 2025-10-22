/**
 * TDD Test: Network validation during DynamicProvider connection
 *
 * PROBLEM: User sees signature requests on "Ethereum Mainnet" during mobile auth
 *
 * ROOT CAUSE:
 * 1. Wallet connects on Ethereum (chainId 1)
 * 2. authenticateBackend() called immediately after connection
 * 3. Signature request shows "Ethereum Mainnet"
 * 4. Network validation only happens later in Web3Service.initialize()
 *
 * SOLUTION: Add network validation in DynamicProvider.setupEthersProvider()
 * - Validate network RIGHT AFTER provider is created
 * - Auto-switch to Base if on wrong network
 * - BEFORE any signatures are requested
 */

import { DynamicProvider } from '@/lib/auth/providers/DynamicProvider';
import { AuthConfig } from '@/lib/auth/types';

describe('DynamicProvider - Network Validation During Auth', () => {
  let provider: DynamicProvider;
  let mockConfig: AuthConfig;
  let mockWallet: any;
  let networkSwitchCalled: boolean;
  let currentChainId: number;

  beforeEach(() => {
    // Start with wallet on Ethereum Mainnet (the problem!)
    currentChainId = 1;
    networkSwitchCalled = false;

    mockConfig = {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'sapphire_devnet',
      chainId: 8453, // Expected: Base Mainnet
      rpcUrl: 'https://mainnet.base.org',
      explorerBaseUrl: 'https://basescan.org',
      dynamicEnvironmentId: 'test-env-id'
    };

    // Mock Dynamic wallet that starts on Ethereum
    mockWallet = {
      address: '0xUser123',
      key: 'metamask',
      connector: {
        name: 'MetaMask',
        getWalletClient: jest.fn().mockResolvedValue({
          // Viem WalletClient structure
          transport: {
            type: 'custom',
            request: jest.fn().mockImplementation(async ({ method, params }: any) => {
              if (method === 'eth_chainId') {
                return `0x${currentChainId.toString(16)}`; // Return current chainId
              }
              if (method === 'wallet_switchEthereumChain') {
                networkSwitchCalled = true;
                currentChainId = parseInt(params[0].chainId, 16); // Switch network
                return null;
              }
              if (method === 'eth_accounts') {
                return ['0xUser123'];
              }
              throw new Error(`Unexpected method: ${method}`);
            })
          },
          account: {
            address: '0xUser123'
          },
          chain: {
            id: currentChainId
          }
        })
      }
    };

    // Mock window.dynamicLogin for tests (add properties to existing window)
    (window as any).dynamicLogin = jest.fn().mockResolvedValue({
      address: '0xUser123',
      wallet: mockWallet,
      user: { email: null, walletAddress: '0xUser123' }
    });
    (window as any).dynamicLogout = jest.fn();
    (window as any).dynamicWallet = mockWallet;

    // Clear singleton
    DynamicProvider.clearInstance();
    provider = DynamicProvider.getInstance(mockConfig);
  });

  afterEach(() => {
    DynamicProvider.clearInstance();
    // Clean up window properties
    delete (window as any).dynamicLogin;
    delete (window as any).dynamicLogout;
    delete (window as any).dynamicWallet;
    delete (window as any).dynamicOAuthResult;
  });

  it('🔴 FAILING TEST: should validate and switch network BEFORE provider is returned', async () => {
    // 1. Wallet starts on Ethereum (chainId 1)
    expect(currentChainId).toBe(1);

    // 2. Connect wallet
    const result = await provider.connect();

    // 3. Connection should succeed
    expect(result.success).toBe(true);
    expect(result.address).toBe('0xUser123');

    // 4. CRITICAL: Network switch should have been attempted
    // This is the failing assertion - network validation not implemented yet!
    expect(networkSwitchCalled).toBe(true);

    // 5. Wallet should now be on Base (chainId 8453)
    expect(currentChainId).toBe(8453);
  });

  it('🔴 FAILING TEST: should validate network for OAuth redirects too', async () => {
    // OAuth redirects skip the modal but still need network validation

    // Mock OAuth result
    (global as any).window.dynamicOAuthResult = {
      address: '0xUser123',
      wallet: mockWallet,
      user: { email: null, walletAddress: '0xUser123' }
    };

    // Wallet on Ethereum
    expect(currentChainId).toBe(1);

    // Connect via OAuth redirect
    const result = await provider.connect();

    expect(result.success).toBe(true);

    // Network should have been validated and switched
    expect(networkSwitchCalled).toBe(true);
    expect(currentChainId).toBe(8453);
  });

  it('🔴 FAILING TEST: should throw clear error if network switch fails', async () => {
    // User rejects network switch

    mockWallet.connector.getWalletClient = jest.fn().mockResolvedValue({
      transport: {
        type: 'custom',
        request: jest.fn().mockImplementation(async ({ method }: any) => {
          if (method === 'eth_chainId') {
            return '0x1'; // Ethereum
          }
          if (method === 'wallet_switchEthereumChain') {
            // User rejects switch
            throw new Error('User rejected the request');
          }
          if (method === 'eth_accounts') {
            return ['0xUser123'];
          }
          throw new Error(`Unexpected method: ${method}`);
        })
      },
      account: { address: '0xUser123' },
      chain: { id: 1 }
    });

    // Connect should fail with clear error about wrong network
    const result = await provider.connect();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network/i);
    expect(result.error).toMatch(/chain 1/i); // Ethereum
    expect(result.error).toMatch(/Base Mainnet/i);
  });

  it('✅ should NOT attempt switch if already on correct network', async () => {
    // Wallet already on Base
    currentChainId = 8453;

    const result = await provider.connect();

    expect(result.success).toBe(true);

    // Should NOT have attempted network switch
    expect(networkSwitchCalled).toBe(false);
    expect(currentChainId).toBe(8453); // Still on Base
  });
});
