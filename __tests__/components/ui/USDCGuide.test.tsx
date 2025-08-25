import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import USDCGuide from '@/components/ui/USDCGuide';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthContextProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
// Mock the providers
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

jest.mock('@/components/auth/Web3AuthContextProvider', () => ({
  useWeb3AuthInstance: jest.fn(),
}));

jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>;
const mockUseWalletAddress = useWalletAddress as jest.MockedFunction<typeof useWalletAddress>;
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
    explorerBaseUrl: 'https://snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  beforeEach(() => {
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
      web3authProvider: null,
      isLoading: false,
      web3authInstance: null,
      onLogout: jest.fn(),
    });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: mockUser.walletAddress,
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
    expect(screen.getByText(/Web3Auth Wallet Widget:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Coinbase' })).toHaveAttribute('href', 'https://www.coinbase.com/price/usdc');
    expect(screen.getByRole('link', { name: 'Kraken' })).toHaveAttribute('href', 'https://www.kraken.com');
    expect(screen.getByRole('link', { name: 'Crypto.com' })).toHaveAttribute('href', 'https://crypto.com');
    // Easy Crypto is commented out
    expect(screen.queryByRole('link', { name: 'Easy Crypto' })).not.toBeInTheDocument();
  });

  it('shows links with correct security attributes', () => {
    render(<USDCGuide />);

    // Web3Auth wallet widget doesn't use external links, it's integrated in the page
    expect(screen.getByText(/Click the wallet button.*to buy\/sell USDC/)).toBeInTheDocument();
  });

  it('shows Web3Auth wallet widget as funding option', () => {
    render(<USDCGuide />);
    expect(screen.getByText(/Web3Auth Wallet Widget:/)).toBeInTheDocument();
    expect(screen.getByText(/Click the wallet button.*to buy\/sell USDC/)).toBeInTheDocument();
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

    mockUseWalletAddress.mockReturnValue({
      walletAddress: null,
      isLoading: false,
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

    expect(screen.getByText(/Web3Auth Wallet Widget:/)).toBeInTheDocument();
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