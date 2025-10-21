/**
 * Test that DynamicProvider uses PublicClient for reads, not WalletClient
 *
 * Root Cause (from production logs at 09:53:38 + Viem docs):
 * - connector.getWalletClient() returns Viem WalletClient with custom transport (WalletConnect)
 * - WalletConnect providers DO NOT support public/node RPC methods
 * - Methods like eth_getBalance, eth_call HANG because WalletConnect doesn't respond
 * - Only supports: eth_accounts, eth_chainId, personal_sign (wallet-specific methods)
 *
 * From Viem GitHub Discussion #920:
 * "Wallet Client doesn't support public actions because wallet providers (like WalletConnect)
 *  may not provide 'node'/'public' RPC methods like eth_call, eth_getBalance, eth_getLogs, etc."
 *
 * The Fix:
 * - Use PublicClient with http() transport for READ operations (getBalance, call, etc.)
 * - Use WalletClient with custom() transport for WRITE operations (signing, sending)
 * - This is the recommended Viem pattern for WalletConnect
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

// Mock the HybridProvider to verify it's being used
let mockHybridProvider: any = null;

jest.mock('@/lib/auth/providers/hybrid-provider-factory', () => {
  const original = jest.requireActual('@/lib/auth/providers/hybrid-provider-factory');
  return {
    ...original,
    createHybridProvider: jest.fn((config) => {
      // Create a simple mock that routes correctly
      mockHybridProvider = {
        request: jest.fn(async ({ method, params }: any) => {
          // Simulate routing: read methods succeed, write methods use wallet
          const readMethods = ['eth_getBalance', 'eth_call', 'eth_blockNumber'];
          const walletMethods = ['eth_chainId', 'eth_accounts', 'personal_sign'];

          if (readMethods.includes(method)) {
            // Simulated HTTP RPC response
            if (method === 'eth_getBalance') return '0x0';
            if (method === 'eth_call') return '0x';
            return null;
          } else if (walletMethods.includes(method)) {
            // Route to wallet provider
            return config.walletProvider.request({ method, params });
          }
          return null;
        }),
        on: jest.fn(),
        removeListener: jest.fn(),
      };
      return mockHybridProvider;
    }),
  };
});

describe('DynamicProvider - WalletConnect Read Operations', () => {
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

  it('🟢 PASSES - Hybrid provider routes reads to HTTP, writes to WalletConnect', async () => {
    // This reproduces the exact production issue:
    //
    // 1. Mobile MetaMask connects via WalletConnect
    // 2. connector.getWalletClient() returns Viem WalletClient with custom transport
    // 3. WalletConnect custom transport ONLY supports wallet-specific methods:
    //    - eth_accounts ✅
    //    - eth_chainId ✅
    //    - personal_sign ✅
    // 4. Does NOT support public/node RPC methods:
    //    - eth_getBalance ❌ (hangs)
    //    - eth_call ❌ (hangs)
    // 5. These methods hang because WalletConnect simply doesn't respond

    // Create a mock Viem WalletClient with custom transport that simulates WalletConnect behavior
    const mockCustomTransport = {
      type: 'custom',
      request: jest.fn(async ({ method }: any) => {
        // WalletConnect ONLY supports these methods:
        if (method === 'eth_chainId') return '0x2105'; // Base chain ID
        if (method === 'eth_accounts') return ['0xc9D0602A87E55116F633b1A1F95D083Eb115f942'];

        // WalletConnect does NOT support these methods - they hang
        if (method === 'eth_getBalance') {
          // Simulate hanging - never resolves
          return new Promise(() => {});
        }
        if (method === 'eth_call') {
          // Simulate hanging - never resolves
          return new Promise(() => {});
        }

        return null;
      }),
    };

    const mockViemWalletClient = {
      account: {
        address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
        type: 'json-rpc',
      },
      chain: { id: 8453, name: 'Base' },
      transport: mockCustomTransport,
      request: jest.fn(async () => new Promise(() => {})), // WalletClient.request also hangs
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

    // Get the ethers provider - this currently uses the custom transport directly
    const ethersProvider = await provider.getEthersProviderAsync();

    // Verify we got a provider
    expect(ethersProvider).not.toBeNull();
    expect(ethersProvider).toBeInstanceOf(ethers.BrowserProvider);

    // Now try to make an RPC call - this should complete, not hang
    // Currently this hangs because we're using WalletConnect transport for reads

    const balancePromise = ethersProvider!.getBalance('0xc9D0602A87E55116F633b1A1F95D083Eb115f942');

    // Race the balance call against a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC call timed out - WalletConnect does not support eth_getBalance!')), 1000);
    });

    // EXPECTED: Balance call should complete successfully using hybrid provider
    // The hybrid provider routes eth_getBalance to HTTP RPC, not WalletConnect
    // ACTUAL (with fix): Balance call completes successfully via HTTP provider
    await expect(Promise.race([balancePromise, timeoutPromise])).resolves.toBeDefined();
  }, 10000); // 10 second test timeout
});
