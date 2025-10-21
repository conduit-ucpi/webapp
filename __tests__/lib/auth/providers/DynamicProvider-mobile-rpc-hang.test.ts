/**
 * Test that DynamicProvider properly handles RPC calls on mobile MetaMask
 *
 * Bug Timeline (from production logs at 08:57:57):
 * [08:57:57.892Z] DynamicProvider ✅ Returning cached ethers provider
 * [08:57:57.894Z] MobileDeepLink Request intercepted: eth_getBalance
 * [08:57:57.894Z] MobileDeepLink ℹ️  Method "eth_getBalance" does not require user action - no deep link needed
 * ...then nothing - request hangs forever
 *
 * Root Cause:
 * On mobile MetaMask, connector.getWalletClient() returns a Viem WalletClient.
 * When wrapped by mobile deep link wrapper, RPC calls like eth_getBalance hang.
 * The Viem WalletClient's .request() method doesn't properly forward calls.
 *
 * Expected Behavior:
 * RPC calls should complete successfully, not hang indefinitely.
 */

import { DynamicProvider } from '@/lib/auth/providers/DynamicProvider';
import { AuthConfig } from '@/lib/auth/types';
import { ethers } from 'ethers';

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

// Mock deviceDetection to simulate mobile
jest.mock('@/utils/deviceDetection', () => ({
  detectDevice: jest.fn(() => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    os: 'Android',
    browser: 'Chrome',
  })),
}));

// Mock mobileDeepLinkProvider - just pass through
jest.mock('@/utils/mobileDeepLinkProvider', () => ({
  wrapProviderWithMobileDeepLinks: jest.fn((provider) => provider),
}));

describe('DynamicProvider - Mobile RPC Hanging Bug', () => {
  let mockConfig: AuthConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear singleton instance
    DynamicProvider.clearInstance();

    mockConfig = {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'testnet',
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      explorerBaseUrl: 'https://basescan.org',
      dynamicEnvironmentId: 'test-dynamic-env-id',
    };
  });

  it('🟢 PASSES - RPC calls work when using transport from Viem WalletClient', async () => {
    // This reproduces the exact production bug:
    //
    // 1. Mobile MetaMask connects via WalletConnect
    // 2. connector.getWalletClient() returns a Viem WalletClient
    // 3. The WalletClient has a .request() method but it doesn't work for read calls
    // 4. When we wrap it and try to call eth_getBalance, it hangs
    // 5. The balance loading never completes

    // Create a mock Viem WalletClient with working transport
    // The WalletClient's .request() hangs, but transport.request() works
    // This simulates what happens on mobile MetaMask
    const mockTransport = {
      type: 'custom',
      request: jest.fn(async ({ method }: any) => {
        // Transport's .request() works properly for RPC calls
        if (method === 'eth_chainId') return '0x2105'; // Base chain ID
        if (method === 'eth_getBalance') return '0x0'; // 0 balance
        if (method === 'eth_call') return '0x'; // Empty result
        return null;
      }),
    };

    const mockViemWalletClient = {
      account: {
        address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
        type: 'json-rpc',
      },
      chain: { id: 8453, name: 'Base' },
      transport: mockTransport, // This is the actual EIP-1193 provider
      request: jest.fn(async () => {
        // WalletClient's .request() hangs (the bug we're fixing)
        return new Promise(() => {
          // This promise never resolves
        });
      }),
    };

    const mockConnector = {
      name: 'MetaMask',
      getWalletClient: jest.fn().mockResolvedValue(mockViemWalletClient),
      provider: null, // Mobile MetaMask doesn't have injected provider
    };

    const mockDynamicWallet = {
      connector: mockConnector,
      key: 'metamask',
      address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
    };

    // Set up window state
    (global.window as any).__wagmiConfig = {};
    (global.window as any).dynamicWallet = mockDynamicWallet;

    // Initialize DynamicProvider
    const provider = DynamicProvider.getInstance(mockConfig);

    // Get the ethers provider - this should set up using the Viem WalletClient
    const ethersProvider = await provider.getEthersProviderAsync();

    // Verify we got a provider
    expect(ethersProvider).not.toBeNull();
    expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);

    // Now try to make an RPC call - this should complete, not hang
    // In production, this hangs forever
    // We'll use a timeout to detect the hang

    const balancePromise = ethersProvider!.getBalance('0xc9D0602A87E55116F633b1A1F95D083Eb115f942');

    // Race the balance call against a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC call timed out - this is the bug!')), 1000);
    });

    // EXPECTED: Balance call should complete successfully
    // ACTUAL (bug): Balance call hangs, timeout fires
    await expect(Promise.race([balancePromise, timeoutPromise])).resolves.toBeDefined();
  }, 10000); // 10 second test timeout
});
