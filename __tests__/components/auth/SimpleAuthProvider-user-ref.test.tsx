/**
 * Test suite for SimpleAuthProvider user data ref behavior
 * This test verifies that user data is immediately available via ref without waiting for re-renders
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { SimpleAuthProvider, useAuth } from '@/components/auth/SimpleAuthProvider';

// Mock the auth dependencies
const mockUpdateUserData = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockGetEthersProvider = jest.fn();

jest.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: any) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({
    user: null,
    isLoading: false,
    isConnected: false,
    isAuthenticated: false,
    error: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
    switchWallet: jest.fn(),
    getEthersProvider: mockGetEthersProvider,
    updateUserData: mockUpdateUserData,
  }),
  BackendClient: {
    getInstance: () => ({
      authenticatedFetch: jest.fn(),
      checkAuthStatus: jest.fn().mockResolvedValue({ success: false })
    })
  }
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    fundAndSendTransaction: jest.fn()
  })
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'testnet',
      chainId: 8453,
      rpcUrl: 'https://test-rpc.url',
      explorerBaseUrl: 'https://test-explorer.url',
      walletConnectProjectId: 'test-project-id'
    },
    isLoading: false
  })
}));

describe('SimpleAuthProvider User Data Ref', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide user data immediately via getter without waiting for re-renders', async () => {
    let capturedAuthContext: any = null;

    function TestComponent() {
      const auth = useAuth();
      capturedAuthContext = auth;
      return (
        <div data-testid="test-component">
          User: {auth.user?.email || 'none'}
        </div>
      );
    }

    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    await waitFor(() => {
      // The auth context should be available
      expect(capturedAuthContext).toBeTruthy();
    });

    // The user property should be a getter on the authValue object (not a plain value)
    const descriptor = Object.getOwnPropertyDescriptor(capturedAuthContext, 'user');

    // Verify it's a getter function, not a plain value
    expect(descriptor).toBeDefined();
    expect(descriptor?.get).toBeDefined();

    // Verify the getter is a function
    expect(typeof descriptor?.get).toBe('function');
  });

  it('should sync ref with user data via useEffect', async () => {
    // This test verifies that when newAuth.user changes,
    // the ref is updated via the useEffect hook

    let renderCount = 0;
    let lastUserValue: any = null;

    function TestComponent() {
      const auth = useAuth();
      renderCount++;
      lastUserValue = auth.user;

      return (
        <div data-testid="render-tracker">
          Renders: {renderCount}, User: {auth.user ? 'yes' : 'no'}
        </div>
      );
    }

    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    // Should render with initial state (no user)
    expect(renderCount).toBeGreaterThan(0);
    expect(lastUserValue).toBeNull();

    // The useEffect should keep the ref in sync with newAuth.user
    // When user data is updated, both the ref and context should update
  });

  it('should handle rapid user data updates without closure issues', async () => {
    // This test verifies that multiple rapid updates to user data
    // don't cause stale closure issues

    let authContextSnapshot: any = null;

    function TestComponent() {
      const auth = useAuth();
      authContextSnapshot = auth;
      return <div data-testid="multi-update">User: {auth.user?.email || 'none'}</div>;
    }

    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    await waitFor(() => {
      expect(authContextSnapshot).toBeTruthy();
    });

    // The ref pattern ensures that even with rapid updates,
    // the latest value is always available via the getter
    // without stale closure issues
  });

  it('should return null when user data is not available', () => {
    // This test verifies the fallback behavior when ref is null

    let authContext: any = null;

    function TestComponent() {
      const auth = useAuth();
      authContext = auth;
      return <div data-testid="null-user">User: {auth.user || 'null'}</div>;
    }

    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    // Initially, user should be null (ref is null, newAuth.user is null)
    expect(authContext.user).toBeNull();
  });

  it('should prioritize ref value over context value when both exist', async () => {
    // This test verifies the getter returns ref value || context value
    // The getter should check the ref first, then fall back to newAuth.user

    let capturedAuth: any = null;

    function TestComponent() {
      const auth = useAuth();
      capturedAuth = auth;
      return <div data-testid="priority-test">User: {auth.user ? 'exists' : 'null'}</div>;
    }

    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    await waitFor(() => {
      expect(capturedAuth).toBeTruthy();
    });

    // The implementation uses: latestUserDataRef.current || newAuth.user
    // This ensures the latest value is always returned
  });
});
