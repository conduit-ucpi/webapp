/**
 * AuthManager.restoreSession() must keep listening for late connection events.
 *
 * The bug (from production logs):
 *   1. Cold load runs AuthManager.initialize() → restoreSession().
 *   2. AppKit/Reown is still booting; provider.isConnected() returns false.
 *   3. restoreSession exits with isConnected=false.
 *   4. ~hundreds of ms later AppKit finishes restoring its persisted session
 *      and emits an account-changed event. Nothing in AuthManager is
 *      listening, so the wallet remains "disconnected" forever from
 *      AuthManager's perspective. The dashboard renders "Connect your
 *      wallet to continue" even though the user IS connected.
 *
 * Fix: AuthManager subscribes to each provider's optional
 * `onConnectionChange` callback during restoreSession. When the provider
 * transitions to connected (async session restore), AuthManager updates
 * state and the rest of the app reacts normally.
 *
 * Tests are split:
 *   1. THE FIX        — pin that AuthManager state flips to connected when
 *                       a provider fires onConnectionChange after init.
 *   2. REGRESSION GUARDS — keep working: providers without the callback,
 *                          providers connected on first check, repeat events.
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

  // Test helper to simulate AppKit's async session restore firing later.
  const fireConnect = (address: string) => {
    isConn = true;
    addr = address;
    callbacks.forEach((cb) => cb({ isConnected: true, address }));
  };

  const fireDisconnect = () => {
    isConn = false;
    addr = null;
    callbacks.forEach((cb) => cb({ isConnected: false, address: null }));
  };

  return { provider, fireConnect, fireDisconnect, callbacks };
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

describe('AuthManager async provider restore', () => {
  it('updates state to connected when a provider fires onConnectionChange after restoreSession finishes', async () => {
    const { provider, fireConnect } = makeFakeProvider({
      startConnected: false,
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    // After init, the provider was disconnected so state is disconnected.
    expect(manager.getState().isConnected).toBe(false);
    expect(manager.getState().address).toBeNull();

    // Simulate AppKit finishing its async session restore.
    fireConnect('0xb9c90dbede265181083f1a7159a6ca20d06ce699');

    // Allow any async work inside the connection handler (e.g.
    // getEthersProviderAsync, getAddress) to settle.
    await new Promise((r) => setTimeout(r, 50));

    const state = manager.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe('0xb9c90dbede265181083f1a7159a6ca20d06ce699');
    expect(state.providerName).toBe('walletconnect');
  });

  it('notifies subscribers when async restore completes (so React providers re-render)', async () => {
    const { provider, fireConnect } = makeFakeProvider({
      startConnected: false,
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const listener = jest.fn();
    const manager = AuthManager.getInstance();
    manager.subscribe(listener);

    await manager.initialize(config);
    listener.mockClear();

    fireConnect('0xabc');
    await new Promise((r) => setTimeout(r, 50));

    // At least one listener call after the async connect must reflect
    // the connected state.
    const sawConnected = listener.mock.calls.some(
      ([s]) => s.isConnected && s.address === '0xabc'
    );
    expect(sawConnected).toBe(true);
  });
});

describe('AuthManager async provider restore — regression guards', () => {
  it('still works when providers do not implement onConnectionChange', async () => {
    const { provider } = makeFakeProvider({
      startConnected: false,
      withSubscription: false,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await expect(manager.initialize(config)).resolves.not.toThrow();
    expect(manager.getState().isConnected).toBe(false);
  });

  it('does not subscribe to a provider that is already connected on first check', async () => {
    // If the provider is already connected, the synchronous restore loop
    // captures its state. We don't need a duplicate subscription.
    const { provider } = makeFakeProvider({
      startConnected: true,
      address: '0xalready',
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    expect(manager.getState().isConnected).toBe(true);
    expect(manager.getState().address).toBe('0xalready');
    expect(provider.onConnectionChange).not.toHaveBeenCalled();
  });

  it('handles a disconnect event after async-restore connect (cleanup)', async () => {
    const { provider, fireConnect, fireDisconnect } = makeFakeProvider({
      startConnected: false,
      withSubscription: true,
    });
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await manager.initialize(config);

    fireConnect('0xabc');
    await new Promise((r) => setTimeout(r, 30));
    expect(manager.getState().isConnected).toBe(true);

    fireDisconnect();
    await new Promise((r) => setTimeout(r, 30));
    expect(manager.getState().isConnected).toBe(false);
    expect(manager.getState().address).toBeNull();
  });

  it('does not throw if onConnectionChange fires before async work completes', async () => {
    // Edge case: the callback fires synchronously inside the subscribe call
    // (some libs do this with the current value). AuthManager should handle
    // it gracefully.
    const provider: any = {
      isConnected: jest.fn().mockReturnValue(false),
      getAddress: jest.fn().mockResolvedValue('0xabc'),
      getProviderName: jest.fn().mockReturnValue('walletconnect'),
      getCapabilities: jest.fn().mockReturnValue({}),
      getEthersProviderAsync: jest.fn().mockResolvedValue({}),
      onConnectionChange: jest.fn((cb: ConnectionChangeCb) => {
        // Synchronously fire connected during subscription.
        cb({ isConnected: true, address: '0xabc' });
        return () => {};
      }),
    };
    mockGetAllProviders.mockReturnValue([provider]);

    const manager = AuthManager.getInstance();
    await expect(manager.initialize(config)).resolves.not.toThrow();
    await new Promise((r) => setTimeout(r, 30));
    expect(manager.getState().isConnected).toBe(true);
  });
});
