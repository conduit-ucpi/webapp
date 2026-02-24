/**
 * Regression Test: SIWX sessionStorage cleanup on disconnect
 *
 * Bug: When user logs in with Account A, logs out, then logs in with Account B,
 * the SIWX session cached in sessionStorage for Account A was never cleared.
 * This caused stale session data to be returned by BackendSIWXStorage.get(),
 * potentially auto-authenticating with the wrong account's context.
 *
 * Root cause: AuthProvider.disconnect() called /api/auth/siwe/signout (clears
 * backend cookie) and authManager.disconnect() (clears provider state), but
 * never removed the 'conduit_siwx_session' entry from sessionStorage.
 */

import React from 'react';
import { render, act } from '@testing-library/react';

const SIWX_SESSION_STORAGE_KEY = 'conduit_siwx_session';

// Mock fetch globally
const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
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

// Create mock AuthManager with disconnect that mimics real behavior
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

// Import AuthProvider AFTER mocks are set up
import { AuthProvider, useAuth } from '@/lib/auth/react/AuthProvider';

// Helper component that captures disconnect function
let capturedDisconnect: (() => Promise<void>) | null = null;

function DisconnectCapture() {
  const { disconnect } = useAuth();
  capturedDisconnect = disconnect;
  return null;
}

const mockConfig = {
  walletConnectProjectId: 'test-project-id',
  chainId: 8453,
  rpcUrl: 'https://test-rpc.url',
} as any;

describe('SIWX sessionStorage cleanup on disconnect', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    capturedDisconnect = null;
    jest.clearAllMocks();
  });

  it('disconnect must clear conduit_siwx_session from sessionStorage', async () => {
    // Simulate Account A's SIWX session being stored (as BackendSIWXStorage.add() does)
    sessionStorage.setItem(SIWX_SESSION_STORAGE_KEY, JSON.stringify({
      message: { domain: 'test.com', address: '0xAccountA' },
      signature: '0xsig_a',
      data: { accountAddress: '0xAccountA' },
    }));

    // Verify it's there
    expect(sessionStorage.getItem(SIWX_SESSION_STORAGE_KEY)).not.toBeNull();

    // Render AuthProvider and capture disconnect
    await act(async () => {
      render(
        <AuthProvider config={mockConfig}>
          <DisconnectCapture />
        </AuthProvider>
      );
    });

    expect(capturedDisconnect).not.toBeNull();

    // Mock signout endpoint
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    // Call disconnect (simulates user logging out)
    await act(async () => {
      await capturedDisconnect!();
    });

    // THIS IS THE KEY ASSERTION:
    // After disconnect, conduit_siwx_session must be removed from sessionStorage.
    // If this fails, stale session data will persist and cause wrong-account bugs on re-login.
    expect(sessionStorage.getItem(SIWX_SESSION_STORAGE_KEY)).toBeNull();
  });
});
