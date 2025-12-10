/**
 * Dashboard lazy loading tests
 *
 * Tests that the dashboard correctly handles lazy authentication:
 * 1. Shows loading state while checking connection
 * 2. Shows "Connect Your Wallet" when isConnected = false
 * 3. Shows dashboard content when isConnected = true (even if user is null)
 * 4. Shows user info when user is available
 */

import { render, screen } from '@testing-library/react';
import Dashboard from '@/pages/dashboard';
import { useAuth } from '@/components/auth';
import { useWalletAddress } from '@/hooks/useWalletAddress';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    pathname: '/dashboard',
    push: jest.fn(),
  })),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock AuthProvider
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock ConfigProvider
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(() => ({
    config: {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'testnet',
      chainId: 84532,
      rpcUrl: 'https://sepolia.base.org',
      usdcContractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      explorerBaseUrl: 'https://sepolia.basescan.org',
      serviceLink: 'http://localhost:3000',
      walletConnectProjectId: 'test-project-id'
    },
    isLoading: false
  })),
  ConfigProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useWalletAddress hook
jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: jest.fn(),
}));

// Mock EnhancedDashboard
jest.mock('@/components/dashboard/EnhancedDashboard', () => {
  return function MockEnhancedDashboard() {
    return <div data-testid="enhanced-dashboard">Mock Enhanced Dashboard</div>;
  };
});

// Mock DashboardTour
jest.mock('@/components/onboarding/DashboardTour', () => {
  return function MockDashboardTour() {
    return null;
  };
});

// Mock ConnectWalletEmbedded
jest.mock('@/components/auth/ConnectWalletEmbedded', () => {
  return function MockConnectWalletEmbedded() {
    return <div data-testid="connect-wallet">Connect Wallet Button</div>;
  };
});

describe('Dashboard - Lazy Loading', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockUseWalletAddress = useWalletAddress as jest.MockedFunction<typeof useWalletAddress>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state while checking connection', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isConnected: false,
      isAuthenticated: false,
      error: null,
      address: null,
      state: {
        isConnected: false,
        isLoading: true,
        isInitialized: false,
        isAuthenticated: false,
        address: null,
        providerName: null,
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: null,
      isLoading: true
    });

    render(<Dashboard />);

    // Should show loading skeleton
    expect(screen.getAllByRole('generic').some(el => el.className.includes('animate-pulse'))).toBe(true);
  });

  it('shows "Connect Your Wallet" when isConnected = false', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isConnected: false, // Wallet NOT connected
      isAuthenticated: false,
      error: null,
      address: null,
      state: {
        isConnected: false,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        address: null,
        providerName: null,
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: null,
      isLoading: false
    });

    render(<Dashboard />);

    // Should show connect wallet message
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByText(/You need to connect your wallet/i)).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet')).toBeInTheDocument();
  });

  it('shows dashboard content when isConnected = true (even if user is null - lazy loading)', () => {
    mockUseAuth.mockReturnValue({
      user: null, // Backend user NOT loaded yet (lazy loading)
      isLoading: false,
      isConnected: true, // Wallet IS connected
      isAuthenticated: false, // Backend auth NOT done yet
      error: null,
      address: '0x1234567890123456789012345678901234567890',
      state: {
        isConnected: true,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        address: '0x1234567890123456789012345678901234567890',
        providerName: 'reown',
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: '0x1234567890123456789012345678901234567890',
      isLoading: false
    });

    render(<Dashboard />);

    // Should show dashboard content
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Manage your escrow contracts/i)).toBeInTheDocument();
    expect(screen.getByTestId('enhanced-dashboard')).toBeInTheDocument();

    // Should show wallet address (in ExpandableHash component)
    expect(screen.getByText(/0x123/)).toBeInTheDocument();

    // Should NOT show user info (because user is null)
    expect(screen.queryByText('@testuser')).not.toBeInTheDocument();
  });

  it('shows user info when user is available (after backend auth)', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        email: 'test@example.com',
        username: 'testuser',
        isAdmin: false,
        createdAt: 1700000000,
        updatedAt: 1700000000
      },
      isLoading: false,
      isConnected: true,
      isAuthenticated: true,
      error: null,
      address: '0x1234567890123456789012345678901234567890',
      state: {
        isConnected: true,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: true,
        address: '0x1234567890123456789012345678901234567890',
        providerName: 'reown',
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: '0x1234567890123456789012345678901234567890',
      isLoading: false
    });

    render(<Dashboard />);

    // Should show dashboard content
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    // Should show wallet address (in ExpandableHash component)
    expect(screen.getByText(/0x123/)).toBeInTheDocument();

    // Should show user info
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('shows email when username is not available', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        email: 'test@example.com',
        username: null, // No username
        isAdmin: false,
        createdAt: 1700000000,
        updatedAt: 1700000000
      },
      isLoading: false,
      isConnected: true,
      isAuthenticated: true,
      error: null,
      address: '0x1234567890123456789012345678901234567890',
      state: {
        isConnected: true,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: true,
        address: '0x1234567890123456789012345678901234567890',
        providerName: 'reown',
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: '0x1234567890123456789012345678901234567890',
      isLoading: false
    });

    render(<Dashboard />);

    // Should show email when username is null
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });
});
