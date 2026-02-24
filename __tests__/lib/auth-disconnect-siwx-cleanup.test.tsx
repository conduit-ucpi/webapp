/**
 * Regression Tests: User data cleanup on disconnect
 *
 * Bug: When user logs in with Account A, logs out, then logs in with Account B,
 * Account A's user data persisted in SimpleAuthProvider's backendUserData state.
 *
 * Root cause: SimpleAuthProvider's sync effect only set backendUserData when
 * newAuth.user was truthy, but never cleared it when newAuth.user became null
 * on disconnect. So the stale Account A data remained visible after re-login.
 */

import React from 'react';
import { render, act, screen } from '@testing-library/react';

const SIWX_SESSION_STORAGE_KEY = 'conduit_siwx_session';

// Mock fetch globally
const mockFetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
global.fetch = mockFetch;

// Mock mobileLogger
jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock ethers
jest.mock('ethers', () => ({
  BrowserProvider: jest.fn(),
  JsonRpcProvider: jest.fn(),
  ethers: { JsonRpcProvider: jest.fn() },
}));

// Mock AuthManager
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockGetState = jest.fn().mockReturnValue({
  isConnected: false,
  isLoading: false,
  isInitialized: true,
  isAuthenticated: false,
  address: null,
  providerName: null,
  capabilities: null,
  error: null,
});
const mockSubscribe = jest.fn().mockReturnValue(() => {});
const mockSetState = jest.fn();

jest.mock('@/lib/auth/core/AuthManager', () => ({
  AuthManager: {
    getInstance: () => ({
      initialize: mockInitialize,
      disconnect: mockDisconnect,
      getState: mockGetState,
      setState: mockSetState,
      subscribe: mockSubscribe,
      getCurrentProvider: jest.fn().mockReturnValue(null),
      connect: jest.fn(),
      signMessage: jest.fn(),
      getEthersProvider: jest.fn(),
      requestAuthentication: jest.fn(),
      showWalletUI: jest.fn(),
    }),
  },
}));

jest.mock('@/lib/auth/backend/AuthService', () => ({
  AuthService: {
    getInstance: () => ({
      checkAuthentication: jest.fn().mockResolvedValue({ success: false }),
      authenticateWithBackend: jest.fn(),
    }),
  },
}));

// Mock ConfigProvider to return a valid config
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      chainId: 8453,
      rpcUrl: 'https://test-rpc.url',
      explorerBaseUrl: 'https://test-explorer.url',
      walletConnectProjectId: 'test-project-id',
    },
    isLoading: false,
  }),
}));

// Mock useSimpleEthers
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    fundAndSendTransaction: jest.fn(),
  }),
}));

// Import SimpleAuthProvider (the production wrapper) and its useAuth
import { SimpleAuthProvider, useAuth } from '@/components/auth/SimpleAuthProvider';

// Helper component that captures auth functions and displays user
let capturedDisconnect: (() => Promise<void>) | null = null;
let capturedUpdateUserData: ((user: any) => void) | null = null;

function TestConsumer() {
  const { disconnect, user, updateUserData } = useAuth();
  capturedDisconnect = disconnect;
  capturedUpdateUserData = updateUserData;
  return <div data-testid="user">{user ? user.walletAddress : 'none'}</div>;
}

describe('SimpleAuthProvider: disconnect must clear backendUserData', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    capturedDisconnect = null;
    capturedUpdateUserData = null;
    jest.clearAllMocks();
  });

  it('after disconnect, user must be null — not stale Account A data', async () => {
    await act(async () => {
      render(
        <SimpleAuthProvider>
          <TestConsumer />
        </SimpleAuthProvider>
      );
    });

    // Starts with no user
    expect(screen.getByTestId('user').textContent).toBe('none');

    // Simulate Account A login — updateUserData sets both AuthProvider user
    // AND SimpleAuthProvider's backendUserData (via the sync effect)
    await act(async () => {
      capturedUpdateUserData!({ walletAddress: '0xAccountA', email: 'a@test.com' });
    });

    expect(screen.getByTestId('user').textContent).toBe('0xAccountA');

    // Simulate disconnect
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await act(async () => {
      await capturedDisconnect!();
    });

    // CRITICAL ASSERTION:
    // After disconnect, user must be null.
    // BUG: SimpleAuthProvider's backendUserData is never cleared because the
    // sync effect (line 62-67) only sets when truthy, never clears on null.
    expect(screen.getByTestId('user').textContent).toBe('none');
  });
});
