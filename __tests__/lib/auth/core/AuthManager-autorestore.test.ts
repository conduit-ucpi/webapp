/**
 * Test that AuthManager properly handles session auto-restore timing
 *
 * Bug Timeline (from production logs):
 * [06:36:53] AuthManager Starting restoreSession...
 * [06:36:53] provider.isConnected() = false (Dynamic not ready yet)
 * [06:36:53] currentProvider = null (not set because provider not connected)
 * [06:36:54] primaryWalletChanged fires (but no active login promise)
 * [06:36:57] Balance loading calls getEthersProvider()
 * [06:36:57] Returns null (because currentProvider is still null)
 * [06:36:57] ERROR: "Wallet not connected"
 *
 * Root Cause:
 * restoreSession() runs before Dynamic finishes auto-restore, so provider.isConnected()
 * returns false. currentProvider is never set. When balance loading happens later,
 * getEthersProvider() returns null.
 */

import { AuthManager } from '@/lib/auth/core/AuthManager';
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
    forceFlush: jest.fn().mockResolvedValue(undefined),
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

describe('AuthManager - Session Auto-Restore Timing Bug', () => {
  let mockConfig: AuthConfig;
  const mockGetWeb3Provider = getWeb3Provider as jest.MockedFunction<typeof getWeb3Provider>;
  const mockGetPublicClient = getPublicClient as jest.MockedFunction<typeof getPublicClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear singleton instances
    (AuthManager as any).instance = null;
    DynamicProvider.clearInstance();

    mockConfig = {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'testnet',
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      explorerBaseUrl: 'https://basescan.org',
      dynamicEnvironmentId: 'test-dynamic-env-id',
    };

    // Mock failures for first two fallbacks
    mockGetWeb3Provider.mockRejectedValue(new Error('Unable to retrieve PublicClient'));
    mockGetPublicClient.mockReturnValue(null);
  });

  it('🔴 FAILS - provider not available when restoreSession runs before Dynamic is ready', async () => {
    // This reproduces the exact production bug timeline:
    //
    // 1. User reloads page
    // 2. AuthManager.initialize() runs
    // 3. restoreSession() runs
    // 4. At this moment, provider.isConnected() = FALSE (Dynamic not ready)
    // 5. currentProvider is NOT set
    // 6. Later, Dynamic finishes auto-restore (primaryWalletChanged fires)
    // 7. Even later, balance loading calls getEthersProvider()
    // 8. Returns NULL because currentProvider was never set
    // 9. ERROR: "Wallet not connected"

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

    // Mock localStorage to have a stored auth token
    const mockGetItem = jest.fn((key: string) => {
      if (key === 'auth-token') return 'fake-jwt-token';
      return null;
    });
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: mockGetItem,
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // Step 1: Create AuthManager and initialize
    const authManager = AuthManager.getInstance();

    // CRITICAL: At this point, DynamicProvider exists but isConnected() returns FALSE
    // because Dynamic SDK hasn't finished auto-restore yet
    // So restoreSession() will NOT set currentProvider!
    await authManager.initialize(mockConfig);

    // Step 2: Simulate Dynamic finishing auto-restore
    // This is what happens AFTER restoreSession() completes
    // In production, this would be when primaryWalletChanged event fires
    (global.window as any).dynamicUser = {
      walletAddress: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
    };
    (global.window as any).dynamicAuthToken = 'fake-dynamic-auth-token';

    // Step 2: Simulate time passing - Dynamic finishes auto-restore
    // In production, primaryWalletChanged event fires but there's no active login promise
    // so nothing happens - currentProvider stays null!

    // Step 3: User navigates to /wallet and tries to load balances
    // This calls getEthersProvider() which should return the provider
    const ethersProvider = await authManager.getEthersProvider();

    // EXPECTED: Should have a provider (either from restoreSession or lazy init)
    // ACTUAL (bug): Returns null because currentProvider was never set
    expect(ethersProvider).not.toBeNull();
    expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);
  });
});
