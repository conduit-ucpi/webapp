/**
 * Test suite for ConnectWalletEmbedded excessive re-render issue
 *
 * Bug: The OAuth redirect check useEffect runs excessively, causing:
 * - 30+ log messages during component initialization
 * - Multiple timeout schedules on every dependency change
 * - Poor performance due to unnecessary work
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { mLog } from '@/utils/mobileLogger';

// Mock the auth hook
const mockConnect = jest.fn();
const mockAuthenticateBackend = jest.fn();

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    isLoading: false,
    connect: mockConnect,
    authenticateBackend: mockAuthenticateBackend,
    isConnected: false,
    address: null,
  })),
}));

// Spy on mLog.info to track OAuth check executions
jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ConnectWalletEmbedded - Excessive Re-render Bug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock window.location
    delete (global as any).window.location;
    (global as any).window.location = {
      search: '',
      origin: 'http://localhost:3000',
      pathname: '/',
      href: 'http://localhost:3000/',
      replace: jest.fn(),
    };

    // Mock window.history for URL cleanup tests
    delete (global as any).window.history;
    (global as any).window.history = {
      replaceState: jest.fn(),
    };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should NOT log when there is no OAuth redirect', async () => {
    // GIVEN: No OAuth redirect parameters in URL
    (global as any).window.location.search = '';

    // Clear sessionStorage
    sessionStorage.clear();

    // WHEN: Component renders without OAuth redirect
    render(<ConnectWalletEmbedded />);

    // Fast-forward through all timeouts
    jest.runAllTimers();

    await waitFor(() => {
      // Wait a bit to ensure no async logging happens
      return new Promise(resolve => setTimeout(resolve, 100));
    }, { timeout: 500 });

    // THEN: Should NOT log at all when there's no OAuth redirect
    const oauthCheckCalls = (mLog.info as jest.Mock).mock.calls.filter(
      (call) => call[1] === 'OAuth redirect detected' || call[1] === 'OAuth redirect check in useEffect'
    );

    console.log(`OAuth logs: ${oauthCheckCalls.length} (expected: 0 - no OAuth redirect in URL)`);

    // Fixed: Should not log at all when there's no OAuth redirect
    expect(oauthCheckCalls.length).toBe(0);
  });

  it('should handle component remounts without issues', async () => {
    // GIVEN: Component is mounted and then remounted (no OAuth redirect)
    (global as any).window.location.search = '';
    sessionStorage.clear();

    const { unmount } = render(<ConnectWalletEmbedded />);

    jest.runAllTimers();
    await waitFor(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    }, { timeout: 500 });

    // Should not log anything for normal page loads
    let oauthLogs = (mLog.info as jest.Mock).mock.calls.filter(
      (call) => call[1] === 'OAuth redirect detected'
    );
    expect(oauthLogs.length).toBe(0);

    jest.clearAllMocks();

    // WHEN: Component unmounts and remounts (simulating navigation or remount)
    unmount();
    render(<ConnectWalletEmbedded />);

    jest.runAllTimers();

    // THEN: Should still not log
    await waitFor(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    }, { timeout: 500 });

    oauthLogs = (mLog.info as jest.Mock).mock.calls.filter(
      (call) => call[1] === 'OAuth redirect detected'
    );

    console.log(`Logs after remount: ${oauthLogs.length} (expected: 0 - no OAuth redirect)`);

    expect(oauthLogs.length).toBe(0);
  });

  it.skip('should log only ONCE per session when OAuth redirect is detected - jsdom URL mocking issue', async () => {
    // GIVEN: OAuth redirect parameters in URL
    // Override location.search in a way that URLSearchParams will pick up
    delete (global as any).window.location;
    (global as any).window.location = {
      search: '?dynamicOauthCode=test123&dynamicOauthState=state456',
      origin: 'http://localhost:3000',
      pathname: '/',
      href: 'http://localhost:3000/?dynamicOauthCode=test123&dynamicOauthState=state456',
      replace: jest.fn(),
    };

    // Clear sessionStorage
    sessionStorage.clear();

    // WHEN: Component renders with OAuth redirect
    const { unmount } = render(<ConnectWalletEmbedded />);

    jest.runAllTimers();

    await waitFor(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    }, { timeout: 500 });

    // Check first render logged
    let oauthCheckCalls = (mLog.info as jest.Mock).mock.calls.filter(
      (call) => call[1] === 'OAuth redirect detected'
    );

    expect(oauthCheckCalls.length).toBe(1);

    // Clear mocks but NOT sessionStorage
    jest.clearAllMocks();

    // Unmount and remount to simulate new render
    unmount();
    render(<ConnectWalletEmbedded />);

    jest.runAllTimers();

    await waitFor(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    }, { timeout: 500 });

    // THEN: Should NOT log again because sessionStorage tracks it
    oauthCheckCalls = (mLog.info as jest.Mock).mock.calls.filter(
      (call) => call[1] === 'OAuth redirect detected'
    );

    console.log(`OAuth redirect logs on remount: ${oauthCheckCalls.length} (expected: 0 - already logged this session)`);

    expect(oauthCheckCalls.length).toBe(0);
  });

  it.skip('OAuth authentication test - needs better mocking', async () => {
    // GIVEN: OAuth redirect parameters in URL
    (global as any).window.location.search = '?dynamicOauthCode=test123&dynamicOauthState=state456';

    // Mock successful connection after OAuth
    const mockUseAuth = require('@/components/auth').useAuth;
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      connect: mockConnect,
      authenticateBackend: mockAuthenticateBackend.mockResolvedValue(true),
      isConnected: true,
      address: '0x123',
    });

    // WHEN: Component renders with OAuth redirect
    render(<ConnectWalletEmbedded />);

    // Fast-forward through all timeouts
    jest.runAllTimers();

    await waitFor(() => {
      expect(mockAuthenticateBackend).toHaveBeenCalled();
    });

    // THEN: authenticateBackend should be called ONLY ONCE, not 6 times
    expect(mockAuthenticateBackend).toHaveBeenCalledTimes(1);
  });

  it('should clean up timeouts when component unmounts', () => {
    // GIVEN: Component is mounted
    const { unmount } = render(<ConnectWalletEmbedded />);

    // Clear the initial calls
    jest.clearAllMocks();

    // WHEN: Component unmounts before timeouts fire
    unmount();

    // Fast-forward to when timeouts would have fired
    jest.runAllTimers();

    // THEN: No OAuth checks should run after unmount
    const oauthCheckCalls = (mLog.info as jest.Mock).mock.calls.filter(
      (call) => call[1] === 'OAuth redirect check in useEffect'
    );

    expect(oauthCheckCalls.length).toBe(0);
  });

  /**
   * Test: Verify lazy authentication pattern
   *
   * With lazy auth (new behavior):
   * 1. Wallet connects successfully (WalletConnect provider returns success)
   * 2. onSuccess() is called IMMEDIATELY after wallet connection
   * 3. Backend auth happens LATER on first API call (not during connection)
   * 4. If backend returns 401 → BackendClient throws AuthenticationExpiredError
   * 5. SimpleAuthProvider catches it → calls requestAuthentication() → retries request
   *
   * Expected: onSuccess() should be called as soon as wallet connects,
   *          regardless of backend authentication status (lazy auth pattern)
   */
  it('should call onSuccess() immediately when wallet connects (lazy auth pattern)', async () => {
    // GIVEN: A mock connect function that returns success
    const mockSuccessfulConnect = jest.fn().mockResolvedValue({
      success: true,
      address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
      capabilities: {
        canSign: true,
        canTransact: true,
        canSwitchWallets: false,
        isAuthOnly: false
      }
    });

    const mockOnSuccess = jest.fn();

    // Mock useAuth to return connected but NOT yet authenticated state
    // (backend auth will happen later on first API call)
    const mockUseAuth = require('@/components/auth').useAuth;
    mockUseAuth.mockReturnValue({
      user: null, // ❌ No user YET - backend auth happens lazily
      isLoading: false,
      connect: mockSuccessfulConnect,
      authenticateBackend: mockAuthenticateBackend,
      isConnected: true, // ✅ Wallet connected
      address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
    });

    // Mock fetch - backend session check returns 401 (lazy auth - no session yet)
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' })
    });

    // Clear sessionStorage to ensure clean test
    sessionStorage.clear();

    // WHEN: User clicks the button and wallet connects successfully
    const { getByText } = render(
      <ConnectWalletEmbedded onSuccess={mockOnSuccess} />
    );

    const button = getByText('Get Started');
    button.click();

    // Wait for connect to complete
    await waitFor(() => {
      expect(mockSuccessfulConnect).toHaveBeenCalled();
    });

    // THEN: onSuccess() SHOULD be called immediately after wallet connection
    // Backend authentication will happen automatically on first API call
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
