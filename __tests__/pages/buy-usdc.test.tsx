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
      expect(screen.getByText('Manual instructions for adding USDC to your wallet or converting to fiat')).toBeInTheDocument();
    });

    it('renders USDC guide information', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('How to Add USDC to Your Wallet/How to get cash from your Wallet')).toBeInTheDocument();
      expect(screen.getByText(/Check your network:/)).toBeInTheDocument();
      expect(screen.getByText(/Your wallet address:/)).toBeInTheDocument();
    });

    it('displays wallet information', () => {
      render(<BuyUSDC />);

      expect(screen.getByText(/Your wallet address:/)).toBeInTheDocument();
      expect(screen.getByText('0x1234567890abcdef1234567890abcdef12345678')).toBeInTheDocument();
      expect(screen.getAllByText(/Avalanche Fuji Testnet/).length).toBeGreaterThan(0);
    });

    it('shows funding methods', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Fund your wallet using:')).toBeInTheDocument();
      expect(screen.getByText(/Web3Auth Wallet Widget:/)).toBeInTheDocument();
      expect(screen.getByText(/MetaMask\/Coinbase:/)).toBeInTheDocument();
      expect(screen.getByText(/Major Exchanges:/)).toBeInTheDocument();
    });

    it('shows coming soon notice', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Coming Soon:')).toBeInTheDocument();
      expect(screen.getByText(/Web3Auth Wallet Services widget for integrated buying\/selling/)).toBeInTheDocument();
    });

    it('displays informational footer', () => {
      render(<BuyUSDC />);

      expect(screen.getByText(/For now, please use the manual methods above to add USDC to your wallet or convert to fiat/)).toBeInTheDocument();
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

    it('displays informational message about Web3Auth widget', () => {
      render(<BuyUSDC />);

      expect(screen.getByText(/The integrated Web3Auth widget will be available soon/)).toBeInTheDocument();
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