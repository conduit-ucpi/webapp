/**
 * Regression Tests: Account switching (disconnect Account A, login Account B)
 *
 * Bug 1: SimpleAuthProvider's backendUserData was never cleared on disconnect.
 * Fix: Sync effect now always keeps backendUserData in sync with newAuth.user.
 *
 * Bug 2: After Account B connects (SIWX creates backend session), nobody fetches
 * Account B's user data. The init effect only runs once (singleton deps).
 * Fix: AuthProvider watches state.isConnected + state.address and fetches user data.
 *
 * Bug 3: isLoading went false as soon as wallet connected, before SIWE completed
 * and user data was fetched. Pages rendered with no user data.
 * Fix: isLoading stays true while connected but user data hasn't arrived yet.
 */

import React from 'react';
import { render, act, screen, waitFor } from '@testing-library/react';

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

// Track the subscribe callback so we can simulate state changes
let stateChangeCallback: ((state: any) => void) | null = null;

const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockInitialize = jest.fn().mockResolvedValue(undefined);

const defaultState = {
  isConnected: false,
  isLoading: false,
  isInitialized: true,
  isAuthenticated: false,
  address: null,
  providerName: null,
  capabilities: null,
  error: null,
};

let currentMockState = { ...defaultState };

const mockGetState = jest.fn().mockImplementation(() => ({ ...currentMockState }));
const mockSetState = jest.fn().mockImplementation((partial: any) => {
  currentMockState = { ...currentMockState, ...partial };
  if (stateChangeCallback) {
    stateChangeCallback({ ...currentMockState });
  }
});
const mockSubscribe = jest.fn().mockImplementation((cb: any) => {
  stateChangeCallback = cb;
  return () => { stateChangeCallback = null; };
});

const mockCheckAuthentication = jest.fn().mockResolvedValue({ success: false });

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
      checkAuthentication: mockCheckAuthentication,
      authenticateWithBackend: jest.fn(),
    }),
  },
}));

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

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    fundAndSendTransaction: jest.fn(),
  }),
}));

import { SimpleAuthProvider, useAuth } from '@/components/auth/SimpleAuthProvider';

let capturedDisconnect: (() => Promise<void>) | null = null;
let capturedUpdateUserData: ((user: any) => void) | null = null;

function TestConsumer() {
  const { disconnect, user, updateUserData, isLoading, isConnected } = useAuth();
  capturedDisconnect = disconnect;
  capturedUpdateUserData = updateUserData;
  return (
    <>
      <div data-testid="user">{user ? user.walletAddress : 'none'}</div>
      <div data-testid="loading">{isLoading ? 'true' : 'false'}</div>
      <div data-testid="connected">{isConnected ? 'true' : 'false'}</div>
    </>
  );
}

describe('Account switching: disconnect A, login B', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    capturedDisconnect = null;
    capturedUpdateUserData = null;
    currentMockState = { ...defaultState };
    stateChangeCallback = null;
    jest.clearAllMocks();
  });

  it('after disconnect, backendUserData must be cleared', async () => {
    await act(async () => {
      render(
        <SimpleAuthProvider>
          <TestConsumer />
        </SimpleAuthProvider>
      );
    });

    expect(screen.getByTestId('user').textContent).toBe('none');

    await act(async () => {
      capturedUpdateUserData!({ walletAddress: '0xAccountA', email: 'a@test.com' });
    });

    expect(screen.getByTestId('user').textContent).toBe('0xAccountA');

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await act(async () => {
      await capturedDisconnect!();
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('after Account B connects with active SIWE session, user data must be fetched', async () => {
    await act(async () => {
      render(
        <SimpleAuthProvider>
          <TestConsumer />
        </SimpleAuthProvider>
      );
    });

    // Account A is logged in
    await act(async () => {
      capturedUpdateUserData!({ walletAddress: '0xAccountA', email: 'a@test.com' });
    });
    expect(screen.getByTestId('user').textContent).toBe('0xAccountA');

    // Account A disconnects
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await act(async () => {
      await capturedDisconnect!();
    });
    expect(screen.getByTestId('user').textContent).toBe('none');

    // Account B connects — SIWX auto-signs and creates backend session
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/auth/siwe/session')) {
        return { ok: true, json: async () => ({ address: '0xAccountB' }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    mockCheckAuthentication.mockResolvedValueOnce({
      success: true,
      user: { walletAddress: '0xAccountB', email: 'b@test.com' },
    });

    // Simulate AuthManager state change (Account B wallet connected)
    await act(async () => {
      mockSetState({
        isConnected: true,
        address: '0xAccountB',
        providerName: 'walletconnect',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('0xAccountB');
    }, { timeout: 3000 });
  });

  it('isLoading must stay true while connected but user data has not arrived', async () => {
    await act(async () => {
      render(
        <SimpleAuthProvider>
          <TestConsumer />
        </SimpleAuthProvider>
      );
    });

    // Initially: not connected, not loading (auth init already finished via mock)
    expect(screen.getByTestId('connected').textContent).toBe('false');

    // Wallet connects but SIWE + user data fetch still in progress
    // (no mock for /api/auth/siwe/session — so user data won't arrive yet)
    await act(async () => {
      mockSetState({
        isConnected: true,
        isLoading: false, // AuthManager says loading is done (wallet connected)
        address: '0xAccountB',
        providerName: 'walletconnect',
      });
    });

    // Connected but no user yet — isLoading MUST stay true so pages show skeleton
    expect(screen.getByTestId('connected').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('loading').textContent).toBe('true');
  });
});
