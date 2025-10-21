/**
 * Test that DynamicProvider works after session auto-restore
 *
 * Bug: When Dynamic auto-restores a session (page reload), the primaryWalletChanged
 * event fires but setupEthersProvider() is never called because there's no active
 * login promise. This leaves cachedEthersProvider as null.
 *
 * Result: Balance loading fails with "Wallet not connected" even though user IS connected.
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

describe('DynamicProvider - Auto-Restore Session', () => {
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

  it('🔴 FAILS - provider not available after session auto-restore', async () => {
    // This reproduces the production bug:
    // 1. User loads page → Dynamic auto-restores session
    // 2. primaryWalletChanged event fires (but no active login promise)
    // 3. setupEthersProvider() is never called
    // 4. Balance loading fails with "Wallet not connected"

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

    // Set up window state as if Dynamic auto-restored session
    (global.window as any).__wagmiConfig = {};
    (global.window as any).dynamicWallet = mockDynamicWallet;

    // Step 1: Provider instance created during page load
    const provider = DynamicProvider.getInstance(mockConfig);
    await provider.initialize();

    // Step 2: User navigates to /wallet and tries to load balances
    // This uses getEthersProviderAsync() which should find dynamicWallet and set up provider
    const ethersProvider = await provider.getEthersProviderAsync();

    // EXPECTED: Provider should be set up from dynamicWallet
    // ACTUAL (bug): Returns null because setupEthersProvider was never called
    expect(ethersProvider).not.toBeNull();
    expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);
  });
});
