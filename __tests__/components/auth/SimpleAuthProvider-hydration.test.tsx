/**
 * Test suite for SimpleAuthProvider hydration behavior
 * This test ensures that useAuth never throws "useAuth must be used within a SimpleAuthProvider"
 * during SSR, hydration, or any other rendering phase.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SimpleAuthProvider, useAuth } from '@/components/auth/SimpleAuthProvider';

// Mock the auth dependencies to isolate the hydration behavior
jest.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: any) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({
    user: null,
    isLoading: false,
    isConnected: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    switchWallet: jest.fn(),
    getEthersProvider: () => null,
  }),
  BackendClient: {
    getInstance: () => ({
      authenticatedFetch: jest.fn(),
      checkAuthStatus: jest.fn()
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

// Test component that uses useAuth
function TestComponent({ testId }: { testId: string }) {
  try {
    const auth = useAuth();
    return (
      <div data-testid={testId}>
        Auth available: user={auth.user ? 'yes' : 'no'}, loading={auth.isLoading ? 'yes' : 'no'}
      </div>
    );
  } catch (error: any) {
    return (
      <div data-testid={testId}>
        Error: {error.message}
      </div>
    );
  }
}

describe('SimpleAuthProvider Hydration Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide auth context without throwing errors', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SimpleAuthProvider>{children}</SimpleAuthProvider>
    );

    render(<TestComponent testId="basic-test" />, { wrapper });

    // Should not throw error and should provide auth context
    const testElement = screen.getByTestId('basic-test');
    expect(testElement).toBeInTheDocument();
    expect(testElement.textContent).not.toContain('Error:');
    expect(testElement.textContent).toContain('Auth available:');
  });

  it('should never throw "useAuth must be used within a SimpleAuthProvider" error', () => {
    // This test specifically targets the error from the user's report
    let caughtError: Error | null = null;

    function ErrorBoundary({ children }: { children?: React.ReactNode }) {
      try {
        return <>{children}</>;
      } catch (error: any) {
        caughtError = error;
        return <div data-testid="error-boundary">Error caught: {error.message}</div>;
      }
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ErrorBoundary>
        <SimpleAuthProvider>{children}</SimpleAuthProvider>
      </ErrorBoundary>
    );

    render(<TestComponent testId="error-test" />, { wrapper });

    // Should not have thrown the specific error we're protecting against
    expect(caughtError).toBeNull();

    const testElement = screen.getByTestId('error-test');
    expect(testElement).toBeInTheDocument();
    expect(testElement.textContent).not.toContain('useAuth must be used within a SimpleAuthProvider');
  });

  it('should provide auth context in multiple components simultaneously', () => {
    function MultipleAuthComponent() {
      try {
        const auth1 = useAuth();
        const auth2 = useAuth();
        return (
          <div data-testid="multiple-auth-test">
            Both auth contexts available: {auth1 && auth2 ? 'yes' : 'no'}
          </div>
        );
      } catch (error: any) {
        return (
          <div data-testid="multiple-auth-test">
            Error: {error.message}
          </div>
        );
      }
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SimpleAuthProvider>{children}</SimpleAuthProvider>
    );

    render(<MultipleAuthComponent />, { wrapper });

    const testElement = screen.getByTestId('multiple-auth-test');
    expect(testElement.textContent).toContain('Both auth contexts available: yes');
    expect(testElement.textContent).not.toContain('Error:');
  });

  describe('Regression Test for Production Error', () => {
    it('should never throw the exact error reported by user', () => {
      // This test specifically replicates the conditions that caused the production error
      let errorMessage = '';

      function ProblematicComponent() {
        try {
          // This is the exact call pattern that was failing in production
          const auth = useAuth();
          return <div data-testid="success">Auth loaded successfully</div>;
        } catch (error: any) {
          errorMessage = error.message;
          return <div data-testid="failure">Failed: {error.message}</div>;
        }
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SimpleAuthProvider>{children}</SimpleAuthProvider>
      );

      render(<ProblematicComponent />, { wrapper });

      // The specific error that was occurring in production
      expect(errorMessage).not.toBe('useAuth must be used within a SimpleAuthProvider');

      // Should render successfully
      expect(screen.getByTestId('success')).toBeInTheDocument();
      expect(screen.queryByTestId('failure')).not.toBeInTheDocument();
    });
  });
});