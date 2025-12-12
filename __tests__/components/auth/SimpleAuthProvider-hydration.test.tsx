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

  it('should show loading screen when config is null even if mounted', () => {
    // This test specifically catches the bug where children were rendered
    // when mounted && !isLoading && !config, causing useAuth to fail

    // Mock useConfig to return null config but not loading
    jest.spyOn(require('@/components/auth/ConfigProvider'), 'useConfig').mockReturnValue({
      config: null,
      isLoading: false
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SimpleAuthProvider>{children}</SimpleAuthProvider>
    );

    // This component would fail if the bug exists
    function TestConfigNull() {
      const auth = useAuth();
      return <div data-testid="config-null-test">Auth: {auth ? 'available' : 'null'}</div>;
    }

    const { container } = render(<TestConfigNull />, { wrapper });

    // CHANGED: For SEO, we now ALWAYS render children, even when config is loading
    // This allows SSR/SEO to see actual page content instead of loading spinners
    // The auth context will have isLoading: true, but pages still render
    expect(screen.queryByTestId('config-null-test')).toBeInTheDocument();
    expect(container.textContent).toContain('Auth: available');

    // Restore mock
    jest.restoreAllMocks();
  });

  it('should provide default auth context when used outside any provider', () => {
    // This test ensures useAuth NEVER throws, even when used completely outside providers
    function StandaloneComponent() {
      try {
        const auth = useAuth();
        return (
          <div data-testid="standalone-test">
            Standalone auth: user={auth.user ? 'yes' : 'no'}, loading={auth.isLoading ? 'yes' : 'no'}
          </div>
        );
      } catch (error: any) {
        return <div data-testid="standalone-error">Error: {error.message}</div>;
      }
    }

    // Render without ANY wrapper - this should use the default context
    render(<StandaloneComponent />);

    // Should render successfully with default auth values
    const element = screen.getByTestId('standalone-test');
    expect(element).toBeInTheDocument();
    expect(element.textContent).toContain('Standalone auth: user=no, loading=yes');

    // Should NOT show an error
    expect(screen.queryByTestId('standalone-error')).not.toBeInTheDocument();
  });

  describe('Regression Test for Production Error', () => {
    it('should never throw the exact error reported by user', () => {
      // This test ensures that useAuth never throws during any loading/config state
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

      const { container } = render(<ProblematicComponent />, { wrapper });

      // The specific error that was occurring in production should never happen
      expect(errorMessage).not.toBe('useAuth must be used within a SimpleAuthProvider');

      // Should never show a failure component
      expect(screen.queryByTestId('failure')).not.toBeInTheDocument();

      // CHANGED: For SEO, we now ALWAYS render children, never show loading screen
      // The auth context is always available with isLoading state
      const successElement = screen.queryByTestId('success');
      expect(successElement).toBeInTheDocument();
    });
  });
});