import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import BuyUSDC from '@/pages/buy-usdc';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthInstanceProvider';
import { useConfig } from '@/components/auth/ConfigProvider';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock AuthProvider
jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// Mock ConfigProvider
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

// Mock Web3AuthInstanceProvider
jest.mock('@/components/auth/Web3AuthInstanceProvider', () => ({
  useWeb3AuthInstance: jest.fn(),
}));

// Mock LoadingSpinner
jest.mock('@/components/ui/LoadingSpinner', () => {
  return function MockLoadingSpinner({ size }: { size?: string }) {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

// Mock ConnectWallet
jest.mock('@/components/auth/ConnectWallet', () => {
  return function MockConnectWallet() {
    return <div data-testid="connect-wallet">Connect Wallet</div>;
  };
});

// Mock MoonPayWidget (should not be rendered in coming soon mode)
jest.mock('@/components/moonpay/MoonPayWidget', () => {
  return function MockMoonPayWidget({ onClose, mode }: { onClose?: () => void; mode?: string }) {
    return <div data-testid="moonpay-widget">MoonPay Widget - Mode: {mode}</div>;
  };
});

// Mock USDCGuide
jest.mock('@/components/ui/USDCGuide', () => {
  return function MockUSDCGuide({ showMoonPayComingSoon }: { showMoonPayComingSoon?: boolean }) {
    return (
      <div data-testid="usdc-guide">
        USDC Guide {showMoonPayComingSoon && '(Coming Soon)'}
      </div>
    );
  };
});

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>;
describe('BuyUSDC Page', () => {
  const mockPush = jest.fn();
  const mockBack = jest.fn();

  const mockUser = {
    userId: 'test-user',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    email: 'test@example.com',
  };

  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    usdcContractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    moonPayApiKey: 'test-api-key',
    minGasWei: '5',
    basePath: '',
    snowtraceBaseUrl: 'https://snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: mockBack,
      query: { mode: 'buy' },
      basePath: '',
    } as any);

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
    });

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    mockUseWeb3AuthInstance.mockReturnValue({
      web3authProvider: { dummy: 'dummy' },
      isLoading: false,
      web3authInstance: null,
      onLogout: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Buy Mode', () => {
    it('renders buy mode title and description', () => {
      render(<BuyUSDC />);

      expect(screen.getByRole('heading', { level: 1, name: 'Buy USDC' })).toBeInTheDocument();
      expect(screen.getByText(/Buy USDC with your credit card.*This feature is coming soon!/)).toBeInTheDocument();
    });

    it('shows coming soon button that is disabled', () => {
      render(<BuyUSDC />);

      const button = screen.getByRole('button', { name: 'Coming Soon' });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('cursor-not-allowed');
    });

    it('displays user wallet address', () => {
      render(<BuyUSDC />);

      expect(screen.getByText(mockUser.walletAddress)).toBeInTheDocument();
    });

    it('shows USDC guide with coming soon flag', () => {
      render(<BuyUSDC />);

      expect(screen.getByTestId('usdc-guide')).toHaveTextContent('USDC Guide (Coming Soon)');
    });

    it('does not render MoonPay widget', () => {
      render(<BuyUSDC />);

      expect(screen.queryByTestId('moonpay-widget')).not.toBeInTheDocument();
    });
  });

  describe('Sell Mode', () => {
    beforeEach(() => {
      mockUseRouter.mockReturnValue({
        push: mockPush,
        back: mockBack,
        query: { mode: 'sell' },
        basePath: '',
      } as any);
    });

    it('renders sell mode title and description', () => {
      render(<BuyUSDC />);

      expect(screen.getByRole('heading', { level: 1, name: 'Sell USDC' })).toBeInTheDocument();
      expect(screen.getByText(/Sell USDC from your wallet.*This feature is coming soon!/)).toBeInTheDocument();
    });

    it('shows correct wallet label for sell mode', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Source Wallet:')).toBeInTheDocument();
    });
  });

  describe('Authentication States', () => {
    it('shows loading spinner when auth is loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        login: jest.fn(),
        logout: jest.fn(),
      });

      mockUseWeb3AuthInstance.mockReturnValue({
        web3authProvider: null,
        isLoading: false,
        web3authInstance: null,
        onLogout: jest.fn(),
      });

      render(<BuyUSDC />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows connect wallet when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
      });

      mockUseWeb3AuthInstance.mockReturnValue({
        web3authProvider: null,
        isLoading: false,
        web3authInstance: null,
        onLogout: jest.fn(),
      });

      render(<BuyUSDC />);

      expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByTestId('connect-wallet')).toBeInTheDocument();
    });

    it('adapts connect wallet message for buy mode', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
      });

      mockUseWeb3AuthInstance.mockReturnValue({
        web3authProvider: null,
        isLoading: false,
        web3authInstance: null,
        onLogout: jest.fn(),
      });

      render(<BuyUSDC />);

      expect(screen.getByText(/You need to connect your wallet to purchase USDC/)).toBeInTheDocument();
    });

    it('adapts connect wallet message for sell mode', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
      });

      mockUseWeb3AuthInstance.mockReturnValue({
        web3authProvider: null,
        isLoading: false,
        web3authInstance: null,
        onLogout: jest.fn(),
      });

      mockUseRouter.mockReturnValue({
        push: mockPush,
        back: mockBack,
        query: { mode: 'sell' },
        basePath: '',
      } as any);

      render(<BuyUSDC />);

      expect(screen.getByText(/You need to connect your wallet to sell USDC/)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('has a go back button that calls router.back()', () => {
      render(<BuyUSDC />);

      const goBackButton = screen.getByText('Go Back');
      fireEvent.click(goBackButton);

      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Information', () => {
    it('displays correct network information', () => {
      render(<BuyUSDC />);

      expect(screen.getByText('Network:')).toBeInTheDocument();
      expect(screen.getByText('Avalanche C-Chain')).toBeInTheDocument();
      expect(screen.getByText('Currency:')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });
  });

  describe('MoonPay Links', () => {
    it('displays MoonPay terms and privacy policy links', () => {
      render(<BuyUSDC />);

      const termsLink = screen.getByRole('link', { name: 'Terms of Use' });
      const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });

      expect(termsLink).toHaveAttribute('href', 'https://moonpay.com/terms_of_use');
      expect(termsLink).toHaveAttribute('target', '_blank');
      expect(termsLink).toHaveAttribute('rel', 'noopener noreferrer');

      expect(privacyLink).toHaveAttribute('href', 'https://moonpay.com/privacy_policy');
      expect(privacyLink).toHaveAttribute('target', '_blank');
      expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Button Interaction', () => {
    it('coming soon button does not trigger widget display', () => {
      render(<BuyUSDC />);

      const button = screen.getByRole('button', { name: 'Coming Soon' });
      fireEvent.click(button);

      // MoonPay widget should still not be displayed
      expect(screen.queryByTestId('moonpay-widget')).not.toBeInTheDocument();
    });
  });

  describe('Default Mode', () => {
    it('defaults to buy mode when no mode is specified', () => {
      mockUseRouter.mockReturnValue({
        push: mockPush,
        back: mockBack,
        query: {},
        basePath: '',
      } as any);

      render(<BuyUSDC />);

      expect(screen.getByRole('heading', { level: 1, name: 'Buy USDC' })).toBeInTheDocument();
      expect(screen.getByText('Destination Wallet:')).toBeInTheDocument();
    });
  });
});