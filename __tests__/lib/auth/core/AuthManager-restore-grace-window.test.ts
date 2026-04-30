/**
 * AuthManager.restoreSession() must keep isLoading=true for a short grace
 * window when no provider is synchronously connected, to give AppKit/Reown
 * time to finish its async session restore before the UI renders the
 * "Connect your wallet" prompt.
 *
 * The bug being fixed (cosmetic flash):
 *   - Cold load → restoreSession() finds no connected provider synchronously.
 *   - AuthManager sets isLoading=false, isConnected=false.
 *   - Dashboard renders "Connect your wallet" for ~50-150ms.
 *   - AppKit fires onConnectionChange → AuthManager sets isConnected=true.
 *   - Dashboard re-renders with content.
 *
 * The fix: when restoreSession ends without a connected provider AND we
 * wired up an onConnectionChange subscription, hold isLoading=true for a
 * short grace window. If a connect event fires inside the window, clear
 * the flag as part of the connected setState. Otherwise, clear it on
 * timeout.
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

function resetSingleton() {
  // @ts-expect-error -- private static field, reset for testing.
  AuthManager.instance = undefined;
}

type ConnectionChangeCb = (info: { isConnected: boolean; address: string | null }) => void;

function makeFakeProvider(opts: {
  startConnected: boolean;
  address?: string;
  withSubscription: boolean;
}) {
  let isConn = opts.startConnected;
  let addr = opts.startConnected ? opts.address || '0xinitial' : null;
  const callbacks: ConnectionChangeCb[] = [];

  const provider: any = {
    isConnected: jest.fn(() => isConn),
    getAddress: jest.fn(async () => {
      if (!addr) throw new Error('not connected');
      return addr;
    }),
    getProviderName: jest.fn(() => 'walletconnect'),
    getCapabilities: jest.fn(() => ({})),
    getEthersProviderAsync: jest.fn().mockResolvedValue({}),
  };

  if (opts.withSubscription) {
    provider.onConnectionChange = jest.fn((cb: ConnectionChangeCb) => {
      callbacks.push(cb);
      return () => {
        const idx = callbacks.indexOf(cb);
        if (idx >= 0) callbacks.splice(idx, 1);
      };
    });
  }

  const fireConnect = (address: string) => {
    isConn = true;
    addr = address;
    callbacks.forEach((cb) => cb({ isConnected: true, address }));
  };

  return { provider, fireConnect };
}

beforeEach(() => {
  resetSingleton();
  mockGetAllProviders.mockReset();
  mockGetBestProvider.mockReset();
  mockGetProvider.mockReset();
  mockRegistryInitialize.mockClear();
  mockGetAllProviders.mockReturnValue([]);
  (global as any).fetch = jest.fn().mockResolvedValue({ ok: false });
});

afterEach(() => {
  delete (global as any).fetch;
});

describe('AuthManager restoreSession grace window for async provider restore', () => {
  it('keeps isLoading=true after init when a subscribable provider is registered but not yet connected', async () => {
    const { provider } = makeFakeProvider({
      startConnected: false,
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    // Right after initialize() resolves, the manager is still in its grace
    // window — the UI should not yet render the "disconnected" branch.
    const state = manager.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isConnected).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('clears isLoading immediately when the async connection event fires inside the grace window', async () => {
    const { provider, fireConnect } = makeFakeProvider({
      startConnected: false,
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);
    expect(manager.getState().isLoading).toBe(true);

    fireConnect('0xabc');
    await new Promise((r) => setTimeout(r, 50));

    const state = manager.getState();
    expect(state.isConnected).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.address).toBe('0xabc');
  });

  it('clears isLoading on timeout when no async connection event fires', async () => {
    const { provider } = makeFakeProvider({
      startConnected: false,
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);
    expect(manager.getState().isLoading).toBe(true);

    // Wait long enough for the grace window to elapse.
    await new Promise((r) => setTimeout(r, 2200));

    const state = manager.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isLoading).toBe(false);
  }, 5000);
});

describe('AuthManager restoreSession grace window — regression guards', () => {
  it('does NOT keep isLoading=true when provider is already connected synchronously', async () => {
    const { provider } = makeFakeProvider({
      startConnected: true,
      address: '0xalready',
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    const state = manager.getState();
    expect(state.isConnected).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('does NOT keep isLoading=true when no providers expose onConnectionChange', async () => {
    // No subscription means no async restore path is possible — there's no
    // reason to wait. The dashboard should render the connect prompt
    // immediately.
    const { provider } = makeFakeProvider({
      startConnected: false,
      withSubscription: false,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    const state = manager.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('does NOT keep isLoading=true when there are no providers at all', async () => {
    mockGetAllProviders.mockReturnValue([]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    const state = manager.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('notifies subscribers when isLoading flips false on grace-window timeout', async () => {
    const { provider } = makeFakeProvider({
      startConnected: false,
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const listener = jest.fn();
    const manager = AuthManager.getInstance();
    manager.subscribe(listener);

    await manager.initialize(config);
    listener.mockClear();

    await new Promise((r) => setTimeout(r, 2200));

    const sawIsLoadingFalse = listener.mock.calls.some(
      ([s]) => s.isLoading === false && s.isConnected === false
    );
    expect(sawIsLoadingFalse).toBe(true);
  }, 8000);
});
