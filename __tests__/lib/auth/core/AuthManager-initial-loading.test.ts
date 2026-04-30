/**
 * AuthManager must report isLoading=true from the moment it's constructed
 * — before initialize() has even started — so React providers that read
 * authManager.getState() as their initial useState value don't render a
 * "disconnected, not loading" frame on first paint.
 *
 * The bug: AuthState.isLoading defaulted to false in the constructor, so
 * the very first render of any component reading AuthManager state showed
 * isLoading=false, isConnected=false, which the dashboard correctly
 * interprets as "show the Connect your wallet prompt." The flash then
 * disappears once initialize()'s first setState({ isLoading: true }) lands.
 *
 * The fix: start with isLoading=true. Until initialize() has run and we
 * know whether a session can be restored, the system genuinely IS still
 * loading.
 */

jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/auth/core/ProviderRegistry', () => ({
  ProviderRegistry: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getAllProviders: jest.fn().mockReturnValue([]),
    getBestProvider: jest.fn(),
    getProvider: jest.fn(),
  })),
}));

jest.mock('@/lib/auth/core/TokenManager', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockReturnValue(null),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  })),
}));

import { AuthManager } from '@/lib/auth/core/AuthManager';

function resetSingleton() {
  // @ts-expect-error -- private static field, reset for testing.
  AuthManager.instance = undefined;
}

beforeEach(() => {
  resetSingleton();
});

describe('AuthManager initial state', () => {
  it('reports isLoading=true before initialize() is called (no first-render flash)', () => {
    const manager = AuthManager.getInstance();

    // No initialize() yet — but a React provider that reads getState() as
    // its useState seed would get this value on first render.
    const state = manager.getState();
    expect(state.isLoading).toBe(true);
    expect(state.isInitialized).toBe(false);
    expect(state.isConnected).toBe(false);
  });

  it('still reports isLoading=true synchronously after initialize() begins', async () => {
    const manager = AuthManager.getInstance();

    // Kick off initialize but don't await — synchronously after this call,
    // state should reflect "loading".
    const initPromise = manager.initialize({
      chainId: 8453,
      rpcUrl: 'https://example',
      explorerBaseUrl: 'https://example/explorer',
      walletConnectProjectId: 'test',
    } as any);

    expect(manager.getState().isLoading).toBe(true);

    await initPromise;
  });
});
