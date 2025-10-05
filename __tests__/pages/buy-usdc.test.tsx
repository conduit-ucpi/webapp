import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
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
jest.mock('@/components/auth', () => ({
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

// Mock the Web3Auth instance provider - Not needed
// jest.mock('@/components/auth/Web3AuthContextProvider', () => ({
//   useWeb3AuthInstance: () => ({
//     web3authProvider: { request: jest.fn() },
//     isLoading: false,
//     web3authInstance: null,
//   }),
// }));

// AuthContextProvider has been removed - using SimpleAuthProvider instead

// Mock the wallet provider
jest.mock('@/lib/wallet/WalletProvider', () => ({
  useWallet: () => ({
    walletProvider: null,
    isConnected: false,
    address: null,
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
    isLoading: false,
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
      user: { userId: '1', email: 'test@example.com', walletAddress: '0xtest', authProvider: 'web3auth' },
      isLoading: false,
      isConnected: true,
      error: null,
      disconnect: jest.fn(),
      getEthersProvider: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn().mockReturnValue(false),
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

      expect(screen.getByText('Connected Wallet:')).toBeInTheDocument();
      expect(screen.getAllByText('0x1234567890abcdef1234567890abcdef12345678').length).toBeGreaterThan(0);
      expect(screen.getByText('Network:')).toBeInTheDocument();
      expect(screen.getByText('Avalanche Fuji Testnet')).toBeInTheDocument();
    });

    it('shows Web3Auth wallet services', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Web3Auth Wallet Services')).toBeInTheDocument();
      expect(screen.getByText(/Use the integrated wallet widget to buy, sell, swap, and manage your crypto/)).toBeInTheDocument();
      expect(screen.getByText(/Look for the wallet widget button/)).toBeInTheDocument();
    });

    it('shows active status notice', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Active:')).toBeInTheDocument();
      expect(screen.getByText(/Web3Auth Wallet Services are now integrated and available through the wallet widget/)).toBeInTheDocument();
    });

    it('displays informational footer', () => {
      render(<BuyUSDC />);

      expect(screen.getByText(/Powered by Web3Auth Wallet Services/)).toBeInTheDocument();
      expect(screen.getByText(/fiat on-ramp providers and DeFi services/)).toBeInTheDocument();
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

    it('shows expandable manual instructions', () => {
      render(<BuyUSDC />);

      expect(screen.getByText(/Alternative: Manual Instructions/)).toBeInTheDocument();
      expect(screen.getByText(/click to expand/)).toBeInTheDocument();
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