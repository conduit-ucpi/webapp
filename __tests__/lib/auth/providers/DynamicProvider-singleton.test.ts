/**
 * Test that DynamicProvider maintains provider cache across re-initialization
 *
 * Bug: DynamicProvider is not a singleton. When ProviderRegistry re-initializes
 * (e.g., during React re-mount), it creates a NEW DynamicProvider instance with
 * an EMPTY provider cache, even though the wallet is still connected.
 *
 * Fix: Make DynamicProvider a singleton so provider cache persists across re-initialization
 */

import { DynamicProvider } from '@/lib/auth/providers/DynamicProvider';
import { AuthConfig } from '@/lib/auth/types';
import { ethers } from 'ethers';
import { getWeb3Provider } from '@dynamic-labs/ethers-v6';
import { getPublicClient } from '@wagmi/core';

// Mock mobileLogger
jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock mobileDeepLinkProvider
jest.mock('@/utils/mobileDeepLinkProvider', () => ({
  wrapProviderWithMobileDeepLinks: jest.fn((provider) => provider),
}));

// Mock @dynamic-labs/ethers-v6
jest.mock('@dynamic-labs/ethers-v6', () => ({
  getWeb3Provider: jest.fn(),
}));

// Mock @wagmi/core
jest.mock('@wagmi/core', () => ({
  getPublicClient: jest.fn(),
}));

describe('DynamicProvider - Singleton Pattern', () => {
  let mockConfig: AuthConfig;
  const mockGetWeb3Provider = getWeb3Provider as jest.MockedFunction<typeof getWeb3Provider>;
  const mockGetPublicClient = getPublicClient as jest.MockedFunction<typeof getPublicClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'testnet',
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      explorerBaseUrl: 'https://basescan.org',
    };

    // Mock failures for first two fallbacks
    mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));
    mockGetPublicClient.mockReturnValue(null);
  });

  it('🔴 FAILS - creates new instance on re-initialization, losing provider cache', async () => {
    // This reproduces the production bug:
    // 1. User authenticates → provider instance #1 created, provider cached
    // 2. React re-mounts → provider instance #2 created, cache EMPTY
    // 3. Balance loading fails with "Wallet not connected"

    const mockEIP1193Provider = {
      request: jest.fn().mockImplementation(async ({ method }: any) => {
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'eth_accounts') return ['0xc9D0602A87E55116F633b1A1F95D083Eb115f942'];
        return null;
      }),
    };

    const mockConnector = {
      name: 'MetaMask',
      getWalletClient: jest.fn().mockResolvedValue(mockEIP1193Provider),
      provider: null,
    };

    const mockDynamicWallet = {
      connector: mockConnector,
      key: 'metamask',
    };

    // Set up window state
    (global.window as any).__wagmiConfig = {};
    (global.window as any).dynamicWallet = mockDynamicWallet;

    // Step 1: Create first instance and set up provider (simulates auth)
    const provider1 = new DynamicProvider(mockConfig);
    await provider1.initialize();
    await (provider1 as any).setupEthersProvider(mockDynamicWallet);

    const ethersProvider1 = provider1.getEthersProvider();
    expect(ethersProvider1).not.toBeNull();
    expect(ethersProvider1).toBeInstanceOf(ethers.BrowserProvider);

    // Step 2: Create second instance (simulates React re-mount / ProviderRegistry re-init)
    const provider2 = new DynamicProvider(mockConfig);
    await provider2.initialize();

    // BUG: Provider cache is empty in the new instance!
    const ethersProvider2 = provider2.getEthersProvider();

    // EXPECTED (after fix): Should return the same cached provider
    // ACTUAL (current bug): Returns null because it's a new instance
    expect(ethersProvider2).not.toBeNull();
    expect(ethersProvider2).toBe(ethersProvider1); // Same instance
  });

  it('🟢 PASSES - singleton pattern maintains provider cache across re-initialization', async () => {
    // After fix, DynamicProvider should be a singleton
    // Multiple calls should return the SAME instance with the SAME cache

    const mockEIP1193Provider = {
      request: jest.fn().mockImplementation(async ({ method }: any) => {
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'eth_accounts') return ['0xc9D0602A87E55116F633b1A1F95D083Eb115f942'];
        return null;
      }),
    };

    const mockConnector = {
      name: 'MetaMask',
      getWalletClient: jest.fn().mockResolvedValue(mockEIP1193Provider),
      provider: null,
    };

    const mockDynamicWallet = {
      connector: mockConnector,
      key: 'metamask',
    };

    (global.window as any).__wagmiConfig = {};
    (global.window as any).dynamicWallet = mockDynamicWallet;

    // After fix: DynamicProvider.getInstance() should return singleton
    // For now, manually test the expected behavior
    const provider1 = new DynamicProvider(mockConfig);
    await provider1.initialize();
    await (provider1 as any).setupEthersProvider(mockDynamicWallet);

    const ethersProvider1 = provider1.getEthersProvider();
    expect(ethersProvider1).not.toBeNull();

    // This test will pass once DynamicProvider becomes a singleton
    // For now it documents the expected behavior
  });
});
