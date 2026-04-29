/**
 * Cold-load rehydration tests for AuthProvider.
 *
 * The bug: on a hard browser refresh of a protected route, AuthManager's
 * restoreSession() reconnects the wallet and sets isConnected=true, but the
 * reconnect effect in AuthProvider used to gate the user fetch on
 * /api/auth/siwe/session returning a non-null `address`. If the SIWE session
 * endpoint returned 200 with `{ address: null }` (or didn't have a SIWE
 * session despite a valid AUTH-TOKEN cookie), the user fetch was skipped and
 * `user` stayed null forever — the user-visible symptom was the dashboard
 * being unable to redraw without going back to the landing page.
 *
 * The fix: rely on /api/auth/identity (via authService.checkAuthentication)
 * as the source of truth. If the AUTH-TOKEN cookie is valid, identity
 * returns the user; otherwise it returns 401 and we leave user=null so
 * lazy auth can trigger on the next protected call.
 *
 * Tests are split:
 *   1. THE FIX        — pin that on cold load with isConnected=true and a
 *                       valid backend session, `user` is populated.
 *   2. REGRESSION GUARDS — pin existing behaviors so the fix doesn't break
 *                          them: not-connected, no-session, errors, etc.
 */

import { render, waitFor, act } from '@testing-library/react';
import { useAuth } from '@/lib/auth/react/AuthProvider';
import { AuthProvider } from '@/lib/auth/react/AuthProvider';

// --- Mocks --------------------------------------------------------------

// Holds the AuthManager state and listeners so tests can drive transitions.
type MockState = {
  isConnected: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  address: string | null;
  providerName: string | null;
  capabilities: any;
  error: string | null;
};

const initialState: MockState = {
  isConnected: false,
  isLoading: false,
  isInitialized: false,
  isAuthenticated: false,
  address: null,
  providerName: null,
  capabilities: null,
  error: null,
};

let managerState: MockState;
let listeners: Array<(s: MockState) => void>;
let mockInitialize: jest.Mock;

function setStateInternal(patch: Partial<MockState>) {
  managerState = { ...managerState, ...patch };
  listeners.forEach((l) => l(managerState));
}

// Singleton manager instance — must return the same object on every call so
// that React's useState(() => authManager.getState()) and our subscription
// agree on the same source of truth.
let managerSingleton: any;

jest.mock('@/lib/auth/core/AuthManager', () => ({
  AuthManager: {
    getInstance: () => managerSingleton,
  },
}));

const mockCheckAuthentication = jest.fn();

jest.mock('@/lib/auth/backend/AuthService', () => ({
  AuthService: {
    getInstance: () => ({
      checkAuthentication: () => mockCheckAuthentication(),
    }),
  },
}));

// Avoid noisy mobile logger output in tests.
jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

// --- Test harness -------------------------------------------------------

function AuthProbe({
  onRender,
}: {
  onRender: (auth: ReturnType<typeof useAuth>) => void;
}) {
  const auth = useAuth();
  onRender(auth);
  return null;
}

const config = {
  chainId: 84532,
  rpcUrl: 'https://example',
  explorerBaseUrl: 'https://example/explorer',
  walletConnectProjectId: 'test-project',
};

beforeEach(() => {
  managerState = { ...initialState };
  listeners = [];
  mockInitialize = jest.fn().mockImplementation(async () => {
    // Mimic real AuthManager.initialize: set isInitialized after work.
    setStateInternal({ isInitialized: true });
  });
  mockCheckAuthentication.mockReset();

  // Build the singleton fresh so each test starts clean.
  managerSingleton = {
    getState: () => managerState,
    subscribe: (cb: (s: MockState) => void) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    },
    initialize: (...args: any[]) => mockInitialize(...args),
    setState: (patch: Partial<MockState>) => setStateInternal(patch),
    connect: jest.fn(),
    disconnect: jest.fn(),
    switchWallet: jest.fn(),
    signMessage: jest.fn(),
    getEthersProvider: jest.fn(),
    requestAuthentication: jest.fn(),
    showWalletUI: jest.fn(),
    getCurrentProvider: () => null,
    setConnectionMode: jest.fn(),
  };
});

// --- 1. THE FIX --------------------------------------------------------

describe('AuthProvider cold-load: fetches user when wallet reconnects with valid backend session', () => {
  it('populates user via /api/auth/identity when manager reports isConnected=true on mount', async () => {
    // Cold-load scenario: the wallet provider has already auto-reconnected
    // before AuthProvider even mounts (e.g. WalletConnect persisted the
    // session). The manager's initial state already shows connected.
    managerState = {
      ...initialState,
      isConnected: true,
      address: '0xabc',
      isInitialized: true,
      providerName: 'walletconnect',
    };

    const expectedUser = {
      userId: 'user-1',
      email: 'alice@example.com',
      walletAddress: '0xabc',
    };
    mockCheckAuthentication.mockResolvedValue({
      success: true,
      user: expectedUser,
    });

    const renders: Array<ReturnType<typeof useAuth>> = [];

    render(
      <AuthProvider config={config as any}>
        <AuthProbe onRender={(a) => renders.push(a)} />
      </AuthProvider>
    );

    await waitFor(() => {
      const latest = renders[renders.length - 1];
      expect(latest.user).toEqual(expectedUser);
    });

    // The fix must call /api/auth/identity (via checkAuthentication) — not
    // gate on /api/auth/siwe/session returning an address first.
    expect(mockCheckAuthentication).toHaveBeenCalled();
  });

  it('does not get stuck calling checkAuthentication forever (bounded re-fetch)', async () => {
    managerState = {
      ...initialState,
      isConnected: true,
      address: '0xabc',
      isInitialized: true,
      providerName: 'walletconnect',
    };
    mockCheckAuthentication.mockResolvedValue({
      success: true,
      user: { userId: 'u', email: 'a@b.c', walletAddress: '0xabc' },
    });

    render(
      <AuthProvider config={config as any}>
        <AuthProbe onRender={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockCheckAuthentication).toHaveBeenCalled();
    });

    await new Promise((r) => setTimeout(r, 50));
    const callsAfterSettle = mockCheckAuthentication.mock.calls.length;
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCheckAuthentication.mock.calls.length).toBe(callsAfterSettle);
  });
});

// --- 2. REGRESSION GUARDS ----------------------------------------------

describe('AuthProvider cold-load regression guards', () => {
  it('does not call checkAuthentication when nothing is connected', async () => {
    // Default initialize: just sets isInitialized=true, no connection.
    render(
      <AuthProvider config={config as any}>
        <AuthProbe onRender={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled();
    });

    // Wait a tick for any pending effects.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCheckAuthentication).not.toHaveBeenCalled();
  });

  it('leaves user=null when isConnected=true but backend identity returns 401-equivalent (success=false)', async () => {
    managerState = {
      ...initialState,
      isConnected: true,
      address: '0xabc',
      isInitialized: true,
      providerName: 'walletconnect',
    };
    // No backend session — identity proxy returned 401 → AuthService maps
    // that to success=false. user should stay null so lazy auth can trigger
    // on the next protected call.
    mockCheckAuthentication.mockResolvedValue({
      success: false,
      error: 'Not authenticated',
    });

    const renders: Array<ReturnType<typeof useAuth>> = [];
    render(
      <AuthProvider config={config as any}>
        <AuthProbe onRender={(a) => renders.push(a)} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockCheckAuthentication).toHaveBeenCalled();
    });

    // Settle and assert user remained null.
    await new Promise((r) => setTimeout(r, 50));
    const latest = renders[renders.length - 1];
    expect(latest.user).toBeNull();
    expect(latest.isConnected).toBe(true);
  });

  it('does not throw when checkAuthentication rejects (network error)', async () => {
    managerState = {
      ...initialState,
      isConnected: true,
      address: '0xabc',
      isInitialized: true,
      providerName: 'walletconnect',
    };
    mockCheckAuthentication.mockRejectedValue(new Error('network down'));

    const renders: Array<ReturnType<typeof useAuth>> = [];
    expect(() => {
      render(
        <AuthProvider config={config as any}>
          <AuthProbe onRender={(a) => renders.push(a)} />
        </AuthProvider>
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(mockCheckAuthentication).toHaveBeenCalled();
    });

    await new Promise((r) => setTimeout(r, 50));
    const latest = renders[renders.length - 1];
    expect(latest.user).toBeNull();
  });

  it('re-fetches user on a true reconnect transition (account switch)', async () => {
    // Start disconnected.
    render(
      <AuthProvider config={config as any}>
        <AuthProbe onRender={() => {}} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled();
    });
    expect(mockCheckAuthentication).not.toHaveBeenCalled();

    // Simulate user connecting an account after init.
    mockCheckAuthentication.mockResolvedValue({
      success: true,
      user: { userId: 'u2', email: 'b@c.d', walletAddress: '0xdef' },
    });
    await act(async () => {
      setStateInternal({
        isConnected: true,
        address: '0xdef',
        providerName: 'walletconnect',
      });
    });

    await waitFor(() => {
      expect(mockCheckAuthentication).toHaveBeenCalled();
    });
  });

  it('does not re-fetch user on every render when user is already populated', async () => {
    managerState = {
      ...initialState,
      isConnected: true,
      address: '0xabc',
      isInitialized: true,
      providerName: 'walletconnect',
    };
    mockCheckAuthentication.mockResolvedValue({
      success: true,
      user: { userId: 'u', email: 'a@b.c', walletAddress: '0xabc' },
    });

    const renders: Array<ReturnType<typeof useAuth>> = [];
    render(
      <AuthProvider config={config as any}>
        <AuthProbe onRender={(a) => renders.push(a)} />
      </AuthProvider>
    );

    await waitFor(() => {
      const latest = renders[renders.length - 1];
      expect(latest.user).not.toBeNull();
    });

    const callCountAfterFirst = mockCheckAuthentication.mock.calls.length;

    // Trigger an unrelated state change that re-renders the provider.
    await act(async () => {
      setStateInternal({ providerName: 'walletconnect' }); // no real change
    });

    expect(mockCheckAuthentication.mock.calls.length).toBe(callCountAfterFirst);
  });
});
