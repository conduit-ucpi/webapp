/**
 * AuthManager.restoreSession() must not proactively clear the backend
 * AUTH-TOKEN cookie on cold load.
 *
 * The bug (from production logs):
 *   1. Cold load of /dashboard.
 *   2. AuthManager.initialize() runs, calls restoreSession().
 *   3. WalletConnect/AppKit hasn't finished its async session restore yet,
 *      so provider.isConnected() returns false during this synchronous pass.
 *   4. restoreSession hits the "No frontend provider connected" branch and
 *      proactively POSTs /api/auth/siwe/signout — wiping the user's
 *      AUTH-TOKEN cookie even though they had a valid backend session.
 *   5. AppKit auto-reconnects ~milliseconds later. Provider now reports
 *      connected, but the backend session has been killed.
 *   6. The dashboard's first protected fetch returns 401, forcing the user
 *      to re-sign with SIWE.
 *
 * Fix: do NOT proactively clear the backend cookie. Lazy auth already
 * handles the inverse (wallet connected, no backend session) on the next
 * 401, so the symmetric case doesn't need eager cleanup. This race causes
 * far more pain than the orphan it was trying to clean up.
 */

// Inline mock for the mobileLogger so test output stays clean.
jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the ProviderRegistry so we control which providers are "connected".
const mockGetAllProviders = jest.fn();
const mockGetBestProvider = jest.fn();
const mockGetProvider = jest.fn();
const mockRegistryInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/auth/core/ProviderRegistry', () => ({
  ProviderRegistry: jest.fn().mockImplementation(() => ({
    initialize: mockRegistryInitialize,
    getAllProviders: mockGetAllProviders,
    getBestProvider: mockGetBestProvider,
    getProvider: mockGetProvider,
  })),
}));

// TokenManager — return no token so restoreSession follows the
// "no stored backend auth" branch where the orphan-clear lives.
jest.mock('@/lib/auth/core/TokenManager', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockReturnValue(null),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  })),
}));

import { AuthManager } from '@/lib/auth/core/AuthManager';

const config = {
  chainId: 8453,
  rpcUrl: 'https://example',
  explorerBaseUrl: 'https://example/explorer',
  walletConnectProjectId: 'test',
} as any;

// Helper to reset the AuthManager singleton between tests so each test
// gets a fresh instance with fresh internal state.
function resetSingleton() {
  // @ts-expect-error -- private static field, reset for testing.
  AuthManager.instance = undefined;
}

describe('AuthManager.restoreSession orphan-clear behavior', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    resetSingleton();
    mockGetAllProviders.mockReset();
    mockGetBestProvider.mockReset();
    mockGetProvider.mockReset();
    mockRegistryInitialize.mockClear();

    // Default: no providers report connected. Tests can override.
    mockGetAllProviders.mockReturnValue([]);

    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('does NOT call /api/auth/siwe/signout when provider is not yet connected on cold load (the cold-load race fix)', async () => {
    // Simulate cold load: provider exists but isConnected() returns false
    // during this synchronous pass (AppKit hasn't auto-restored yet).
    const fakeProvider = {
      isConnected: jest.fn().mockReturnValue(false),
      getAddress: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('walletconnect'),
      getCapabilities: jest.fn().mockReturnValue({}),
      getEthersProviderAsync: jest.fn().mockResolvedValue({}),
    };
    mockGetAllProviders.mockReturnValue([fakeProvider]);

    // Backend has a valid session (would be cleared by the buggy logic).
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/auth/siwe/session')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ address: '0xb9c90dbede265181' }),
        });
      }
      if (url.includes('/api/auth/siwe/signout')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    // Wait for any fire-and-forget promises kicked off inside restoreSession
    // to settle (the buggy implementation's signout call is fire-and-forget).
    await new Promise((r) => setTimeout(r, 50));

    const signoutCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/auth/siwe/signout')
    );
    expect(signoutCalls).toHaveLength(0);
  });

  it('does NOT call /api/auth/siwe/signout when there are no providers registered at all', async () => {
    // Even with zero providers, we should not eagerly kill backend sessions.
    // Lazy auth handles any mismatch on the next 401.
    mockGetAllProviders.mockReturnValue([]);

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/auth/siwe/session')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ address: '0xb9c90dbede265181' }),
        });
      }
      if (url.includes('/api/auth/siwe/signout')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    await new Promise((r) => setTimeout(r, 50));

    const signoutCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/auth/siwe/signout')
    );
    expect(signoutCalls).toHaveLength(0);
  });

  it('still restores wallet state when a provider is connected (regression guard)', async () => {
    const fakeProvider = {
      isConnected: jest.fn().mockReturnValue(true),
      getAddress: jest.fn().mockResolvedValue('0xabc'),
      getProviderName: jest.fn().mockReturnValue('walletconnect'),
      getCapabilities: jest.fn().mockReturnValue({}),
      getEthersProviderAsync: jest.fn().mockResolvedValue({}),
    };
    mockGetAllProviders.mockReturnValue([fakeProvider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    const state = manager.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe('0xabc');
    expect(state.providerName).toBe('walletconnect');

    // No signout call should happen in the connected case either.
    const signoutCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/auth/siwe/signout')
    );
    expect(signoutCalls).toHaveLength(0);
  });

  it('does not throw when fetch is unavailable (test/non-browser environment)', async () => {
    delete (global as any).fetch;
    mockGetAllProviders.mockReturnValue([]);

    const manager = AuthManager.getInstance();
    await expect(manager.initialize(config)).resolves.not.toThrow();
  });
});
