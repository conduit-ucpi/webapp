import { render, screen } from '@testing-library/react';
import USDCGuide from '@/components/ui/USDCGuide';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConfig } from '@/components/auth/ConfigProvider';

// Mock the providers
jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;

describe('USDCGuide', () => {
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
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      provider: null,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
    });

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the guide with correct title', () => {
    render(<USDCGuide />);
    expect(screen.getByText('How to Add USDC to Your Wallet/How to get cash from your Wallet')).toBeInTheDocument();
  });

  it('displays the correct network for Avalanche mainnet', () => {
    render(<USDCGuide />);
    expect(screen.getByText(/You're currently on Avalanche C-Chain/)).toBeInTheDocument();
  });

  it('displays the correct network for Avalanche testnet', () => {
    mockUseConfig.mockReturnValue({
      config: { ...mockConfig, chainId: 43113 },
      isLoading: false,
    });

    render(<USDCGuide />);
    expect(screen.getByText(/You're currently on Avalanche Fuji Testnet/)).toBeInTheDocument();
  });

  it('displays fallback network name for unknown chain', () => {
    mockUseConfig.mockReturnValue({
      config: { ...mockConfig, chainId: 1 },
      isLoading: false,
    });

    render(<USDCGuide />);
    expect(screen.getByText(/You're currently on Avalanche Network/)).toBeInTheDocument();
  });

  it('displays the user wallet address', () => {
    render(<USDCGuide />);
    expect(screen.getByText(mockUser.walletAddress)).toBeInTheDocument();
  });

  it('shows all exchange links', () => {
    render(<USDCGuide />);
    
    // Check that all exchange links are present
    expect(screen.getByRole('link', { name: 'MoonPay' })).toHaveAttribute('href', 'https://www.moonpay.com');
    expect(screen.getByRole('link', { name: 'Coinbase' })).toHaveAttribute('href', 'https://www.coinbase.com/price/usdc');
    expect(screen.getByRole('link', { name: 'Kraken' })).toHaveAttribute('href', 'https://www.kraken.com');
    expect(screen.getByRole('link', { name: 'Crypto.com' })).toHaveAttribute('href', 'https://crypto.com');
    // Easy Crypto is commented out
    expect(screen.queryByRole('link', { name: 'Easy Crypto' })).not.toBeInTheDocument();
  });

  it('shows links with correct security attributes', () => {
    render(<USDCGuide />);
    
    const moonpayLink = screen.getByRole('link', { name: 'MoonPay' });
    expect(moonpayLink).toHaveAttribute('target', '_blank');
    expect(moonpayLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows MoonPay without "coming soon" by default', () => {
    render(<USDCGuide />);
    expect(screen.getByRole('link', { name: 'MoonPay' })).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/)).not.toBeInTheDocument();
  });

  it('shows MoonPay with "coming soon" when prop is true', () => {
    render(<USDCGuide showMoonPayComingSoon={true} />);
    expect(screen.getByRole('link', { name: 'MoonPay' })).toBeInTheDocument();
    expect(screen.getByText(/\(coming soon\)/)).toBeInTheDocument();
  });

  it('displays important warning about network deposits', () => {
    render(<USDCGuide />);
    expect(screen.getByText(/Important:/)).toBeInTheDocument();
    expect(screen.getByText(/Ensure you're depositing USDC.*on the Avalanche C-Chain network/)).toBeInTheDocument();
  });

  it('adapts warning text for testnet', () => {
    mockUseConfig.mockReturnValue({
      config: { ...mockConfig, chainId: 43113 },
      isLoading: false,
    });

    render(<USDCGuide />);
    expect(screen.getByText(/on the Avalanche Fuji Testnet network/)).toBeInTheDocument();
  });

  it('returns null when user is not available', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      provider: null,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
    });

    const { container } = render(<USDCGuide />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when config is not available', () => {
    mockUseConfig.mockReturnValue({
      config: null,
      isLoading: false,
    });

    const { container } = render(<USDCGuide />);
    expect(container.firstChild).toBeNull();
  });

  it('includes all funding methods', () => {
    render(<USDCGuide />);
    
    expect(screen.getByRole('link', { name: 'MoonPay' })).toBeInTheDocument();
    expect(screen.getByText(/MetaMask\/Coinbase:/)).toBeInTheDocument();
    expect(screen.getByText(/Major Exchanges:/)).toBeInTheDocument();
    expect(screen.getByText(/Cash Conversion:/)).toBeInTheDocument();
  });

  it('has proper styling classes', () => {
    render(<USDCGuide />);
    
    const container = screen.getByText('How to Add USDC to Your Wallet/How to get cash from your Wallet').closest('div');
    expect(container).toHaveClass('bg-blue-50', 'border', 'border-blue-200', 'rounded-lg', 'p-6');
  });

  it('displays numbered steps correctly', () => {
    render(<USDCGuide />);
    
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });
});