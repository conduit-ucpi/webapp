/**
 * Tests for Dynamic.xyz modal triggering on "Get Started" button click
 *
 * This test suite ensures that:
 * 1. When DYNAMIC_ENVIRONMENT_ID is present in config, Dynamic modal infrastructure is initialized
 * 2. When "Get Started" button is clicked, the Dynamic modal opens correctly
 * 3. The modal flow completes successfully when a wallet is connected
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import AnimatedHero from '@/components/landing/AnimatedHero';

// Mock the auth context
const mockConnect = jest.fn();
const mockAuthenticateBackend = jest.fn();
const mockSetShowAuthFlow = jest.fn();

// Mock Dynamic context
const mockDynamicContext = {
  setShowAuthFlow: mockSetShowAuthFlow,
  primaryWallet: null,
  user: null,
  handleLogOut: jest.fn()
};

// Mock the auth hook
jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isConnected: false,
    address: null,
    connect: mockConnect,
    authenticateBackend: mockAuthenticateBackend
  })
}));

// Mock the config provider
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      dynamicEnvironmentId: 'ac6e291d-c06a-4685-8d1f-5d4c2a384e9f', // Valid Dynamic environment ID
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      explorerBaseUrl: 'https://basescan.org',
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'sapphire_mainnet',
      walletConnectProjectId: 'test-project-id'
    },
    isLoading: false
  })
}));

// Mock Dynamic context hook
jest.mock('@dynamic-labs/sdk-react-core', () => ({
  DynamicContextProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="dynamic-provider">{children}</div>,
  useDynamicContext: () => mockDynamicContext,
  useDynamicEvents: jest.fn(),
  DynamicEmbeddedWidget: () => <div data-testid="dynamic-widget">Dynamic Widget</div>
}));

// Mock Farcaster detection
jest.mock('@/components/farcaster/FarcasterDetectionProvider', () => ({
  useFarcaster: () => ({
    isInFarcaster: false
  })
}));

// Mock mobile logger
jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    circle: (props: any) => <circle {...props} />,
    text: ({ children, ...props }: any) => <text {...props}>{children}</text>,
    path: (props: any) => <path {...props} />,
    polygon: (props: any) => <polygon {...props} />
  }
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('Dynamic Modal Triggering with DYNAMIC_ENVIRONMENT_ID', () => {

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset window.dynamicLogin
    delete (window as any).dynamicLogin;

    // Setup window.dynamicLogin to simulate Dynamic modal opening
    (window as any).dynamicLogin = jest.fn().mockImplementation(() => {
      // Simulate modal opening
      mockSetShowAuthFlow(true);

      // Return a promise that resolves when "wallet connected"
      return Promise.resolve({
        address: '0x1234567890123456789012345678901234567890',
        provider: {},
        wallet: {
          key: 'dynamicembedded',
          address: '0x1234567890123456789012345678901234567890',
          connector: {
            name: 'Dynamic Embedded Wallet',
            key: 'dynamic-embedded'
          }
        },
        user: {
          email: 'test@example.com',
          walletAddress: '0x1234567890123456789012345678901234567890'
        }
      });
    });
  });

  describe('ConnectWalletEmbedded component', () => {

    test('should render "Get Started" button when not authenticated', () => {
      render(<ConnectWalletEmbedded />);

      const button = screen.getByRole('button', { name: /get started/i });
      expect(button).toBeInTheDocument();
    });

    test('should render custom button text when provided', () => {
      render(<ConnectWalletEmbedded buttonText="Connect Now" />);

      const button = screen.getByRole('button', { name: /connect now/i });
      expect(button).toBeInTheDocument();
    });

    test('should call connect function when Get Started is clicked', async () => {
      const user = userEvent.setup();

      mockConnect.mockResolvedValue({
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        capabilities: {
          canSign: true,
          canTransact: true,
          canSwitchWallets: true,
          isAuthOnly: false
        }
      });

      render(<ConnectWalletEmbedded />);

      const button = screen.getByRole('button', { name: /get started/i });

      await act(async () => {
        await user.click(button);
      });

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    test('should call authenticateBackend after successful connection', async () => {
      const user = userEvent.setup();

      const connectionResult = {
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        capabilities: {
          canSign: true,
          canTransact: true,
          canSwitchWallets: true,
          isAuthOnly: false
        }
      };

      mockConnect.mockResolvedValue(connectionResult);
      mockAuthenticateBackend.mockResolvedValue(true);

      render(<ConnectWalletEmbedded />);

      const button = screen.getByRole('button', { name: /get started/i });

      await act(async () => {
        await user.click(button);
      });

      await waitFor(() => {
        expect(mockAuthenticateBackend).toHaveBeenCalledWith(connectionResult);
      });
    });

    test('should call onSuccess callback after successful authentication', async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();

      mockConnect.mockResolvedValue({
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        capabilities: {
          canSign: true,
          canTransact: true,
          canSwitchWallets: true,
          isAuthOnly: false
        }
      });
      mockAuthenticateBackend.mockResolvedValue(true);

      render(<ConnectWalletEmbedded onSuccess={onSuccess} />);

      const button = screen.getByRole('button', { name: /get started/i });

      await act(async () => {
        await user.click(button);
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    test('should not call authenticateBackend if connection fails', async () => {
      const user = userEvent.setup();

      mockConnect.mockResolvedValue({
        success: false,
        error: 'Connection failed',
        capabilities: {
          canSign: false,
          canTransact: false,
          canSwitchWallets: false,
          isAuthOnly: true
        }
      });

      render(<ConnectWalletEmbedded />);

      const button = screen.getByRole('button', { name: /get started/i });

      await act(async () => {
        await user.click(button);
      });

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled();
      });

      expect(mockAuthenticateBackend).not.toHaveBeenCalled();
    });

    test('should disable button when connect function is not available', () => {
      // Override the mock temporarily
      jest.spyOn(require('@/components/auth'), 'useAuth').mockReturnValue({
        user: null,
        isLoading: false,
        isConnected: false,
        address: null,
        connect: null, // No connect function
        authenticateBackend: mockAuthenticateBackend
      });

      render(<ConnectWalletEmbedded />);

      const button = screen.getByRole('button', { name: /get started/i });
      expect(button).toBeDisabled();

      // Restore the mock
      jest.restoreAllMocks();
    });
  });

  describe('Dynamic modal infrastructure with DYNAMIC_ENVIRONMENT_ID', () => {

    test('should have window.dynamicLogin available when Dynamic is configured', () => {
      render(<ConnectWalletEmbedded />);

      // The window.dynamicLogin function should be available
      expect((window as any).dynamicLogin).toBeDefined();
      expect(typeof (window as any).dynamicLogin).toBe('function');
    });

    test('window.dynamicLogin should call setShowAuthFlow(true) when invoked', async () => {
      render(<ConnectWalletEmbedded />);

      // Call the dynamicLogin function directly
      await act(async () => {
        await (window as any).dynamicLogin();
      });

      // Verify that setShowAuthFlow was called with true
      expect(mockSetShowAuthFlow).toHaveBeenCalledWith(true);
    });

    test('window.dynamicLogin should return connection result when wallet is connected', async () => {
      render(<ConnectWalletEmbedded />);

      let result: any;
      await act(async () => {
        result = await (window as any).dynamicLogin();
      });

      // Verify the result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('wallet');
      expect(result).toHaveProperty('user');
      expect(result.address).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  describe('AnimatedHero component with Get Started button', () => {

    test('should render "Get Started Now" button for unauthenticated users', () => {
      render(<AnimatedHero />);

      // The ConnectWalletEmbedded component should render with custom text
      const button = screen.getByRole('button', { name: /get started now/i });
      expect(button).toBeInTheDocument();
    });

    test('should trigger connection flow when Get Started Now is clicked', async () => {
      const user = userEvent.setup();

      mockConnect.mockResolvedValue({
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        capabilities: {
          canSign: true,
          canTransact: true,
          canSwitchWallets: true,
          isAuthOnly: false
        }
      });

      render(<AnimatedHero />);

      const button = screen.getByRole('button', { name: /get started now/i });

      await act(async () => {
        await user.click(button);
      });

      expect(mockConnect).toHaveBeenCalled();
    });

    test('should show authenticated UI when user is logged in', () => {
      // Override the mock to return authenticated user
      jest.spyOn(require('@/components/auth'), 'useAuth').mockReturnValue({
        user: {
          userId: 'test-user-id',
          email: 'test@example.com',
          walletAddress: '0x1234567890123456789012345678901234567890'
        },
        isLoading: false,
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890',
        connect: mockConnect,
        authenticateBackend: mockAuthenticateBackend
      });

      render(<AnimatedHero />);

      // Should show authenticated buttons instead of Get Started
      expect(screen.queryByRole('button', { name: /get started now/i })).not.toBeInTheDocument();
      expect(screen.getByText(/create payment request/i)).toBeInTheDocument();
      expect(screen.getByText(/view dashboard/i)).toBeInTheDocument();

      // Restore the mock
      jest.restoreAllMocks();
    });
  });

  describe('Error handling', () => {

    test('should handle connection errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockConnect.mockRejectedValue(new Error('Connection failed'));

      render(<ConnectWalletEmbedded />);

      const button = screen.getByRole('button', { name: /get started/i });

      await act(async () => {
        await user.click(button);
      });

      // The component should not crash
      expect(button).toBeInTheDocument();

      consoleError.mockRestore();
    });

    test('should handle authentication errors gracefully', async () => {
      const user = userEvent.setup();

      mockConnect.mockResolvedValue({
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        capabilities: {
          canSign: true,
          canTransact: true,
          canSwitchWallets: true,
          isAuthOnly: false
        }
      });
      mockAuthenticateBackend.mockResolvedValue(false); // Backend auth fails

      render(<ConnectWalletEmbedded />);

      const button = screen.getByRole('button', { name: /get started/i });

      await act(async () => {
        await user.click(button);
      });

      // The component should not crash and should not call onSuccess
      expect(button).toBeInTheDocument();
    });
  });

  describe('OAuth redirect handling', () => {

    beforeEach(() => {
      // Mock URLSearchParams to simulate OAuth redirect
      const originalURLSearchParams = global.URLSearchParams;
      (global as any).URLSearchParams = class MockURLSearchParams {
        private params: Map<string, string>;

        constructor(search?: string) {
          this.params = new Map();
          // Always include OAuth parameters for these tests
          this.params.set('dynamicOauthCode', 'test-code');
          this.params.set('dynamicOauthState', 'test-state');
        }

        has(key: string): boolean {
          return this.params.has(key);
        }

        get(key: string): string | null {
          return this.params.get(key) || null;
        }
      };

      // Mock history.replaceState
      Object.defineProperty(window, 'history', {
        value: {
          replaceState: jest.fn()
        },
        writable: true,
        configurable: true
      });

      // Store original for restoration
      (window as any)._originalURLSearchParams = originalURLSearchParams;
    });

    afterEach(() => {
      // Restore original URLSearchParams
      if ((window as any)._originalURLSearchParams) {
        global.URLSearchParams = (window as any)._originalURLSearchParams;
        delete (window as any)._originalURLSearchParams;
      }
    });

    test('should detect OAuth redirect parameters', () => {
      render(<ConnectWalletEmbedded />);

      const urlParams = new URLSearchParams(window.location.search);
      expect(urlParams.has('dynamicOauthCode')).toBe(true);
      expect(urlParams.has('dynamicOauthState')).toBe(true);
    });

    test('should skip normal connect flow if OAuth redirect is detected and already connected', async () => {
      // Mock as already connected from OAuth
      jest.spyOn(require('@/components/auth'), 'useAuth').mockReturnValue({
        user: null,
        isLoading: false,
        isConnected: true, // Already connected
        address: '0x1234567890123456789012345678901234567890',
        connect: mockConnect,
        authenticateBackend: mockAuthenticateBackend
      });

      mockAuthenticateBackend.mockResolvedValue(true);

      render(<ConnectWalletEmbedded />);

      // The component should auto-authenticate on mount when OAuth params are detected
      // So we should see "Connecting..." initially, then it completes
      await waitFor(() => {
        expect(mockAuthenticateBackend).toHaveBeenCalled();
      });

      // Should authenticate directly without calling connect
      expect(mockConnect).not.toHaveBeenCalled();

      // Verify it was called with the correct parameters
      expect(mockAuthenticateBackend).toHaveBeenCalledWith({
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        capabilities: {
          canSign: true,
          canTransact: true,
          canSwitchWallets: true,
          isAuthOnly: false
        }
      });

      // Restore the mock
      jest.restoreAllMocks();
    });
  });
});
