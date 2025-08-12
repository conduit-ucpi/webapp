import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import BuyUSDC from '@/pages/buy-usdc';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock the wallet address hook
jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: () => ({
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    isLoading: false,
  }),
}));

// Mock the auth provider
const mockUseAuth = jest.fn();
jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock the config provider
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'sapphire_devnet',
      chainId: 43113,
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
      usdcContractAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
      moonPayApiKey: 'test-api-key',
    },
    isLoading: false,
  }),
}));

// Mock the Web3Auth instance provider
jest.mock('@/components/auth/Web3AuthInstanceProvider', () => ({
  useWeb3AuthInstance: () => ({
    web3authProvider: { request: jest.fn() },
    isLoading: false,
    web3authInstance: null,
  }),
}));

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();

describe('BuyUSDC Page', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      basePath: '',
      push: mockRouterPush,
      back: mockRouterBack,
    });

    // Default auth state - authenticated user
    mockUseAuth.mockReturnValue({
      user: { id: '1', wallet: '0x123', email: 'test@example.com' },
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When user is authenticated', () => {
    it('renders the main heading and description', () => {
      render(<BuyUSDC />);

      expect(screen.getByRole('heading', { level: 1, name: 'Buy or Sell USDC' })).toBeInTheDocument();
      expect(screen.getByText('Use the Web3Auth wallet widget to buy, sell, swap, or manage your crypto')).toBeInTheDocument();
    });

    it('renders wallet services information', () => {
      render(<BuyUSDC />);

      expect(screen.getByRole('heading', { level: 2, name: 'Access Wallet Services' })).toBeInTheDocument();
      expect(screen.getByText(/Web3Auth Wallet Services provides integrated fiat on-ramp functionality/)).toBeInTheDocument();
    });

    it('displays wallet information', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Connected Wallet:')).toBeInTheDocument();
      expect(screen.getByText('0x1234567890abcdef1234567890abcdef12345678')).toBeInTheDocument();
      expect(screen.getByText('Network:')).toBeInTheDocument();
      expect(screen.getByText('Avalanche C-Chain')).toBeInTheDocument();
      expect(screen.getByText('Supported Currency:')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });

    it('shows requirements for wallet services', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Requirements for Web3Auth Wallet Services:')).toBeInTheDocument();
      expect(screen.getByText('1. Upgrade to Web3Auth SDK v9 or higher')).toBeInTheDocument();
      expect(screen.getByText('2. Subscribe to Web3Auth Scale Plan (minimum for production)')).toBeInTheDocument();
      expect(screen.getByText('3. Configure wallet services in Web3Auth dashboard')).toBeInTheDocument();
    });

    it('shows available features', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Once enabled, you\'ll have access to:')).toBeInTheDocument();
      expect(screen.getByText('• Fiat on-ramp aggregator (MoonPay, Ramp, and more)')).toBeInTheDocument();
      expect(screen.getByText('• Token swaps and exchanges')).toBeInTheDocument();
      expect(screen.getByText('• Portfolio management')).toBeInTheDocument();
      expect(screen.getByText('• WalletConnect integration')).toBeInTheDocument();
    });

    it('displays upgrade notice', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Note:')).toBeInTheDocument();
      expect(screen.getByText(/Full wallet services with integrated widget require Web3Auth v9\+ and a Scale Plan/)).toBeInTheDocument();
    });

    it('shows navigation buttons', () => {
      render(<BuyUSDC />);

      const dashboardButton = screen.getByRole('button', { name: 'Go to Dashboard' });
      expect(dashboardButton).toBeInTheDocument();
      expect(dashboardButton).not.toBeDisabled();

      const backButton = screen.getByRole('button', { name: 'Go Back' });
      expect(backButton).toBeInTheDocument();
    });

    it('navigates to dashboard when dashboard button is clicked', () => {
      render(<BuyUSDC />);

      const dashboardButton = screen.getByRole('button', { name: 'Go to Dashboard' });
      dashboardButton.click();

      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });

    it('navigates back when back button is clicked', () => {
      render(<BuyUSDC />);

      const backButton = screen.getByRole('button', { name: 'Go Back' });
      backButton.click();

      expect(mockRouterBack).toHaveBeenCalled();
    });

    it('displays Web3Auth attribution', () => {
      render(<BuyUSDC />);

      expect(screen.getByText(/Powered by Web3Auth Wallet Services/)).toBeInTheDocument();
    });
  });

  describe('When user is not authenticated', () => {
    it('shows connect wallet message', () => {
      // Override the auth mock for this test
      mockUseAuth.mockReturnValueOnce({
        user: null,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
      });

      render(<BuyUSDC />);

      expect(screen.getByRole('heading', { level: 1, name: 'Connect Your Wallet' })).toBeInTheDocument();
      expect(screen.getByText('You need to connect your wallet to buy or sell USDC.')).toBeInTheDocument();
    });
  });

  describe('Loading states', () => {
    it('shows loading spinner when auth is loading', () => {
      // Override the auth mock for this test
      mockUseAuth.mockReturnValueOnce({
        user: null,
        isLoading: true,
        login: jest.fn(),
        logout: jest.fn(),
      });

      render(<BuyUSDC />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });
});