/**
 * Tests for DynamicProvider - specifically the mobile MetaMask balance reading issue
 *
 * Issue: On mobile MetaMask via WalletConnect, Dynamic's getWeb3Provider() fails to get PublicClient,
 * causing balance reading to fail even though signing works.
 *
 * Solution: Use connector.getWalletClient() as a third fallback (same approach that works for signing)
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
  wrapProviderWithMobileDeepLinks: jest.fn((provider) => provider), // Return provider unchanged
}));

// Mock @dynamic-labs/ethers-v6
jest.mock('@dynamic-labs/ethers-v6', () => ({
  getWeb3Provider: jest.fn(),
}));

// Mock @wagmi/core
jest.mock('@wagmi/core', () => ({
  getPublicClient: jest.fn(),
}));

describe('DynamicProvider - Mobile MetaMask Balance Reading', () => {
  let provider: DynamicProvider;
  let mockConfig: AuthConfig;

  // Get references to the mocked functions
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

    provider = new DynamicProvider(mockConfig);
  });

  describe('Page Refresh Race Condition', () => {
    it('🔴 SHOULD FAIL - demonstrates the page refresh bug where provider is not awaited', async () => {
      // This test demonstrates the BUG that happens on page refresh:
      // 1. Page refreshes, Dynamic SDK auto-restores wallet session
      // 2. window.dynamicWallet exists (persisted session)
      // 3. getEthersProvider() is called (sync) before setupEthersProvider() completes
      // 4. cachedEthersProvider is still null
      // 5. Balance reading fails with "Cannot read property 'getBalance' of null"

      // Mock Dynamic's getWeb3Provider to fail (simulates mobile MetaMask via WalletConnect)
      mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));
      mockGetPublicClient.mockReturnValue(null);

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

      // Set up window.__wagmiConfig and window.dynamicWallet (simulates page refresh)
      (global.window as any).__wagmiConfig = {};
      (global.window as any).dynamicWallet = mockDynamicWallet;

      // DON'T call setupEthersProvider - simulating the race condition
      // where balance reading happens before setup completes

      // Try to get the provider immediately (what happens on page refresh)
      const ethersProviderSync = provider.getEthersProvider();

      // BUG: Provider is null because setup hasn't completed yet
      expect(ethersProviderSync).toBeNull();

      // This would cause: TypeError: Cannot read property 'getBalance' of null
      // when balance reading tries to use the provider
    });

    it('🟢 SHOULD PASS - async version properly awaits provider setup on page refresh', async () => {
      // This test demonstrates the FIX for the page refresh bug:
      // 1. Page refreshes, Dynamic SDK auto-restores wallet session
      // 2. window.dynamicWallet exists (persisted session)
      // 3. getEthersProviderAsync() is called (async)
      // 4. It detects no cached provider, finds window.dynamicWallet
      // 5. It awaits setupEthersProvider() to complete
      // 6. Returns fully initialized provider
      // 7. Balance reading succeeds!

      // Mock Dynamic's getWeb3Provider to fail (simulates mobile MetaMask via WalletConnect)
      mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));
      mockGetPublicClient.mockReturnValue(null);

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

      // Set up window.__wagmiConfig and window.dynamicWallet (simulates page refresh)
      (global.window as any).__wagmiConfig = {};
      (global.window as any).dynamicWallet = mockDynamicWallet;

      // DON'T call setupEthersProvider first - simulating page refresh state
      // where provider needs to be set up from persisted Dynamic wallet

      // Use async version - it should detect missing provider and set it up
      const ethersProviderAsync = await provider.getEthersProviderAsync();

      // FIX: Async version waits for setup to complete
      expect(ethersProviderAsync).not.toBeNull();
      expect(ethersProviderAsync).toBeInstanceOf(ethers.BrowserProvider);

      // Verify getWalletClient was called during setup
      expect(mockConnector.getWalletClient).toHaveBeenCalled();

      // Verify we can get a signer (proves full wallet connection)
      const signer = await ethersProviderAsync?.getSigner();
      expect(signer).toBeDefined();

      // Now verify that cached provider is available for subsequent sync calls
      const cachedProvider = provider.getEthersProvider();
      expect(cachedProvider).not.toBeNull();
      expect(cachedProvider).toBe(ethersProviderAsync); // Same instance
    });
  });

  describe('setupEthersProvider with mobile MetaMask wallet', () => {
    it('should succeed even when Dynamic toolkit and wagmi fallbacks fail (third fallback saves the day!)', async () => {
      // This test demonstrates that even when first two fallbacks fail:
      // 1. Dynamic's getWeb3Provider() fails (PublicClient not ready)
      // 2. Wagmi's getPublicClient() returns null
      // The third fallback using connector.getWalletClient() succeeds!

      // Mock Dynamic's getWeb3Provider to fail (simulates "Unable to retrieve PublicClient")
      mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));

      // Mock wagmi's getPublicClient to return null
      mockGetPublicClient.mockReturnValue(null);

      // Create mock wallet with connector that HAS getWalletClient (like mobile MetaMask)
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

      // Set up window.__wagmiConfig (needed for wagmi fallback)
      (global.window as any).__wagmiConfig = {};

      // Call the private setupEthersProvider method
      await (provider as any).setupEthersProvider(mockDynamicWallet);

      // Check if provider was created
      const ethersProvider = provider.getEthersProvider();

      // With the fix in place, provider should be successfully created via third fallback
      expect(ethersProvider).not.toBeNull();
      expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);

      // Verify that getWalletClient WAS called (third fallback worked!)
      expect(mockConnector.getWalletClient).toHaveBeenCalled();
    });

    it('should succeed when connector.getWalletClient() is used as third fallback (the fix)', async () => {
      // This test will PASS after we implement the fix
      // Same setup as above, but expects the third fallback to work

      // Mock Dynamic's getWeb3Provider to fail
      mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));

      // Mock wagmi's getPublicClient to return null
      mockGetPublicClient.mockReturnValue(null);

      // Create mock EIP-1193 provider (simulates what WalletConnect returns)
      const mockEIP1193Provider = {
        request: jest.fn().mockImplementation(async ({ method }: any) => {
          // Mock essential RPC responses
          if (method === 'eth_chainId') {
            return '0x2105'; // Base mainnet (8453)
          }
          if (method === 'eth_accounts') {
            return ['0xc9D0602A87E55116F633b1A1F95D083Eb115f942'];
          }
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

      // Set up window.__wagmiConfig
      (global.window as any).__wagmiConfig = {};

      // Call setupEthersProvider
      await (provider as any).setupEthersProvider(mockDynamicWallet);

      // Check if provider was created
      const ethersProvider = provider.getEthersProvider();

      // AFTER THE FIX: This should succeed
      expect(ethersProvider).not.toBeNull();
      expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);

      // Verify that connector.getWalletClient() WAS called (third fallback worked)
      expect(mockConnector.getWalletClient).toHaveBeenCalled();
    });

    it('should use connector.provider if getWalletClient is not available', async () => {
      // Test the || fallback: connector.getWalletClient?.() || connector.provider

      mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));
      mockGetPublicClient.mockReturnValue(null);

      const mockEIP1193Provider = {
        request: jest.fn().mockImplementation(async ({ method }: any) => {
          if (method === 'eth_chainId') return '0x2105';
          if (method === 'eth_accounts') return ['0xc9D0602A87E55116F633b1A1F95D083Eb115f942'];
          return null;
        }),
      };

      // Connector WITHOUT getWalletClient, but WITH provider property
      const mockConnector = {
        name: 'MetaMask',
        provider: mockEIP1193Provider,
      };

      const mockDynamicWallet = {
        connector: mockConnector,
        key: 'metamask',
      };

      (global.window as any).__wagmiConfig = {};

      await (provider as any).setupEthersProvider(mockDynamicWallet);

      const ethersProvider = provider.getEthersProvider();

      // Should work using connector.provider
      expect(ethersProvider).not.toBeNull();
      expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);
    });

    it('should NOT use JsonRpcProvider from wagmi PublicClient (broken second fallback)', async () => {
      // BUG REPRODUCTION TEST: This test demonstrates the actual bug in production!
      //
      // Current behavior (v37.2.31):
      // 1. Dynamic's getWeb3Provider() fails ❌
      // 2. Wagmi's getPublicClient() returns PublicClient with transport.url ✅
      // 3. Code creates JsonRpcProvider from the RPC URL ⚠️
      // 4. JsonRpcProvider has NO wallet connection - can't access accounts! ❌
      // 5. Balance reading fails because provider isn't connected to wallet ❌
      //
      // Expected behavior (after fix):
      // - Should skip JsonRpcProvider creation and use connector.getWalletClient() instead

      // Mock Dynamic's getWeb3Provider to fail (first fallback)
      mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));

      // Mock wagmi's getPublicClient to return a PublicClient with transport.url (second fallback)
      const mockPublicClient = {
        transport: {
          url: 'https://mainnet.base.org',
          type: 'http',
        },
        chain: { id: 8453 },
      };
      mockGetPublicClient.mockReturnValue(mockPublicClient as any);

      // Create mock connector with getWalletClient (third fallback should be used)
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

      // Set up window.__wagmiConfig
      (global.window as any).__wagmiConfig = {};

      // Call setupEthersProvider
      await (provider as any).setupEthersProvider(mockDynamicWallet);

      const ethersProvider = provider.getEthersProvider();

      // CURRENT BUG: This creates a JsonRpcProvider (not BrowserProvider)
      // The JsonRpcProvider is NOT connected to the wallet, so:
      // - It can't get accounts
      // - It can't read balances for the connected wallet
      // - It can't sign transactions
      //
      // AFTER FIX: Should use connector.getWalletClient() (third fallback) instead
      // and connector.getWalletClient() SHOULD have been called
      expect(mockConnector.getWalletClient).toHaveBeenCalled();

      // Should be a proper BrowserProvider with wallet connection
      expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);

      // Should be able to get a signer (proves wallet connection)
      const signer = await ethersProvider?.getSigner();
      expect(signer).toBeDefined();
    });
  });
});
