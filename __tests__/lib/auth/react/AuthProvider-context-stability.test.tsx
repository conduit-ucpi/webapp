/**
 * Regression: AuthProvider's context value must be referentially STABLE across
 * re-renders when the underlying auth state has not changed.
 *
 * The bug: contextValue was a plain object literal created on every render of
 * AuthProvider. Each AuthProvider re-render therefore handed every useAuth()
 * consumer a brand-new context object — and a new `authenticatedFetch` (which
 * SimpleAuthProvider derives from it via useCallback([newAuth])). Downstream,
 * contract-pay's contract-fetch effect depends on `authenticatedFetch` and its
 * balance effect depends on the fetched `contract` object, so the unstable
 * reference re-fired those effects every render: contract re-fetch -> setContract
 * -> balance re-read -> setState -> re-render -> loop (observed as the balance
 * "flashing" and the page re-mounting endlessly).
 *
 * The fix: memoize contextValue (and the two members that were inline closures)
 * so it only changes when its real inputs change.
 *
 * This test forces a parent re-render WITHOUT changing auth state and asserts
 * the context value (and key callbacks) keep the same reference.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { useAuth, AuthProvider } from '@/lib/auth/react/AuthProvider';

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

let managerState: MockState;
let listeners: Array<(s: MockState) => void>;
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

jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

const config = {
  chainId: 84532,
  rpcUrl: 'https://example',
  explorerBaseUrl: 'https://example/explorer',
  walletConnectProjectId: 'test-project',
};

beforeEach(() => {
  managerState = {
    isConnected: false,
    isLoading: false,
    isInitialized: true,
    isAuthenticated: false,
    address: null,
    providerName: null,
    capabilities: null,
    error: null,
  };
  listeners = [];
  mockCheckAuthentication.mockReset();
  mockCheckAuthentication.mockResolvedValue({ success: false, user: null });

  managerSingleton = {
    getState: () => managerState,
    subscribe: (cb: (s: MockState) => void) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    },
    initialize: jest.fn().mockResolvedValue(undefined),
    setState: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    switchWallet: jest.fn(),
    signMessage: jest.fn(),
    getEthersProvider: jest.fn(),
    requestAuthentication: jest.fn(),
    showWalletUI: jest.fn(),
    getCurrentProvider: () => null,
    setConnectionMode: jest.fn(),
    getLastAuthFailure: jest.fn(),
  };
});

/** Captures the auth context value on each render. */
function Capturer({ capture }: { capture: (auth: ReturnType<typeof useAuth>) => void }) {
  capture(useAuth());
  return null;
}

/**
 * A PARENT that owns AuthProvider and can force AuthProvider itself to
 * re-render (this is what reproduces the bug: contextValue is built in
 * AuthProvider's render, so it only churns when AuthProvider re-renders).
 */
let forceParent: () => void = () => {};
function Parent({ capture }: { capture: (auth: ReturnType<typeof useAuth>) => void }) {
  const [n, setN] = React.useState(0);
  forceParent = () => setN((x) => x + 1);
  return (
    <AuthProvider config={config as any}>
      {/* n is referenced so the parent (and thus AuthProvider) actually re-renders */}
      <span data-n={n} />
      <Capturer capture={capture} />
    </AuthProvider>
  );
}

describe('AuthProvider context value stability', () => {
  it('keeps the same context value + authenticatedFetch reference across re-renders with unchanged auth state', () => {
    const captured: Array<ReturnType<typeof useAuth>> = [];

    render(<Parent capture={(a) => captured.push(a)} />);

    const first = captured[captured.length - 1];

    // Force AuthProvider ITSELF to re-render WITHOUT any auth state change.
    act(() => {
      forceParent();
    });

    const second = captured[captured.length - 1];

    // THE KEY ASSERTION: the context VALUE OBJECT itself must be the same
    // reference. In the buggy version it was a fresh object literal every
    // render, so this identity check fails even though the individual
    // useCallback'd members were stable. (SimpleAuthProvider derives
    // authenticatedFetch from this whole object, so object churn = fetch churn
    // = downstream effect loop.)
    expect(second).toBe(first);

    // And the inline-closure members that the fix had to wrap in useCallback:
    expect(second.setConnectionMode).toBe(first.setConnectionMode);
    expect(second.getLastAuthFailure).toBe(first.getLastAuthFailure);
  });
});
