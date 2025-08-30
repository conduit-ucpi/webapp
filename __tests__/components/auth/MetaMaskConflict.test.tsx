/**
 * Test to reproduce MetaMask + Web3Auth conflict issue
 * This test should FAIL with the current code to demonstrate the problem
 */
import React from 'react';
import { render } from '@testing-library/react';
import { waitFor, screen } from '@testing-library/dom';
import { AuthProvider } from '@/components/auth/AuthProvider';

// Mock the config provider
const mockUseConfig = jest.fn();
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => mockUseConfig(),
}));

// Mock the Farcaster detection provider
jest.mock('@/components/farcaster/FarcasterDetectionProvider', () => ({
  FarcasterDetectionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="farcaster-provider">{children}</div>
  ),
  useFarcaster: () => ({
    isInFarcaster: false,
    isLoading: false,
    farcasterSDK: null,
  }),
}));

// Mock console to capture errors
const mockConsoleError = jest.fn();
const originalConsoleError = console.error;

describe('MetaMask Conflict Issue (TDD)', () => {
  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'sapphire_devnet',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    usdcContractAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
    moonPayApiKey: 'test-api-key',
  };

  beforeEach(() => {
    // Mock config provider
    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    // Clear previous mocks
    jest.clearAllMocks();
    console.error = mockConsoleError;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    // Clean up global objects
    try {
      delete (global as any).window;
      delete (global as any).navigator;
      delete (global as any).ethereum;
      delete (global as any).__originalEthereum;
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should handle MetaMask presence without causing runtime errors', async () => {
    // Simulate MetaMask being present (like your friend's browser)
    const mockMetaMask = {
      isMetaMask: true,
      request: jest.fn(),
      enable: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      selectedAddress: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: '0xa869', // Avalanche mainnet
      // Simulate MetaMask's auto-injection behavior
      _handleChainChanged: jest.fn(),
      _handleAccountsChanged: jest.fn(),
    };

    // Set up global window with MetaMask (simulating user's browser environment)
    (global as any).window = {
      ethereum: mockMetaMask,
      __originalEthereum: undefined,
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    // Also set navigator globally
    (global as any).navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    // This should NOT throw errors or cause infinite loading
    const TestComponent = () => (
      <AuthProvider>
        <div data-testid="app-content">Test App</div>
      </AuthProvider>
    );

    // The render should complete without errors
    expect(() => {
      render(<TestComponent />);
    }).not.toThrow();

    // Wait for Web3Auth initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Should not have any unhandled runtime errors
    expect(mockConsoleError).not.toHaveBeenCalledWith(
      expect.stringMatching(/TypeError.*ethereum/)
    );
    expect(mockConsoleError).not.toHaveBeenCalledWith(
      expect.stringMatching(/Cannot redefine property/)
    );
    expect(mockConsoleError).not.toHaveBeenCalledWith(
      expect.stringMatching(/Uncaught.*runtime\.lastError/)
    );
  });

  it('should not crash when MetaMask interferes with Web3Auth', async () => {
    // Simulate aggressive MetaMask behavior that could cause issues
    const mockMetaMask = {
      isMetaMask: true,
      request: jest.fn().mockRejectedValue(new Error('MetaMask interference')),
      enable: jest.fn().mockRejectedValue(new Error('MetaMask interference')),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    (global as any).window = {
      ethereum: mockMetaMask,
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    (global as any).navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const TestComponent = () => (
      <AuthProvider>
        <div data-testid="app-content">Test App</div>
      </AuthProvider>
    );

    // This should not throw runtime errors
    expect(() => {
      render(<TestComponent />);
    }).not.toThrow();

    // The component should eventually render successfully
    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Should not have runtime errors about property redefinition
    expect(mockConsoleError).not.toHaveBeenCalledWith(
      expect.stringMatching(/Cannot redefine property/)
    );
  });

  it('should not cause infinite loading when MetaMask interferes with Web3Auth', async () => {
    // Simulate aggressive MetaMask behavior that causes conflicts
    const mockMetaMask = {
      isMetaMask: true,
      request: jest.fn()
        .mockRejectedValueOnce(new Error('User rejected the request'))
        .mockRejectedValueOnce(new Error('Already processing eth_requestAccounts'))
        .mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']),
      enable: jest.fn().mockRejectedValue(new Error('User denied account authorization')),
      on: jest.fn(),
      removeListener: jest.fn(),
      // Simulate MetaMask trying to auto-connect
      autoConnect: jest.fn().mockResolvedValue(true),
    };

    (global as any).window = {
      ethereum: mockMetaMask,
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    (global as any).navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const TestComponent = () => (
      <AuthProvider>
        <div data-testid="app-content">Test App</div>
      </AuthProvider>
    );

    render(<TestComponent />);

    // The component should eventually load and not hang indefinitely
    await waitFor(() => {
      expect(screen.getByTestId('app-content')).toBeInTheDocument();
    }, { timeout: 10000 }); // Give it extra time but it should still complete

    // Should handle MetaMask conflicts gracefully without infinite loading
    expect(mockConsoleError).not.toHaveBeenCalledWith(
      expect.stringMatching(/timeout|infinite|hanging/)
    );
  });
});