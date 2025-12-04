import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import TokenGuide from '@/components/ui/TokenGuide';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
// import { useWeb3AuthInstance } from '@/components/auth/Web3AuthContextProvider'; // Not needed
import { useWalletAddress } from '@/hooks/useWalletAddress';
// Mock the providers
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

// jest.mock('@/components/auth/Web3AuthContextProvider', () => ({
//   useWeb3AuthInstance: jest.fn(),
// })); // Not needed

jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
// const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>; // Not needed
const mockUseWalletAddress = useWalletAddress as jest.MockedFunction<typeof useWalletAddress>;
describe('TokenGuide', () => {
  const mockUser = {
    userId: 'test-user',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    email: 'test@example.com',
    authProvider: 'web3auth' as const,
  };

  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    usdcContractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    moonPayApiKey: 'test-api-key',
    minGasWei: '5',
    maxGasPriceGwei: '0.001',
    maxGasCostGwei: '0.15',
    usdcGrantFoundryGas: '150000',
    depositFundsFoundryGas: '150000',
    gasPriceBuffer: '1',
    basePath: '',
    explorerBaseUrl: 'https://snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isConnected: true,
      error: null,
      disconnect: jest.fn(),
      getEthersProvider: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn().mockReturnValue(false),
    });

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    // mockUseWeb3AuthInstance.mockReturnValue({
    //   web3authProvider: null,
    //   isLoading: false,
    //   web3authInstance: null,
    //   onLogout: jest.fn(),
    // });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: mockUser.walletAddress,
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the guide with correct title', () => {
    render(<TokenGuide />);
    expect(screen.getByText('How to Add USDC to Your Wallet/How to get cash from your Wallet')).toBeInTheDocument();
  });

  it('displays the correct network for Avalanche mainnet', () => {
    render(<TokenGuide />);
    expect(screen.getByText(/You're currently on Avalanche C-Chain/)).toBeInTheDocument();
  });

  it('displays the correct network for Avalanche testnet', () => {
    mockUseConfig.mockReturnValue({
      config: { ...mockConfig, chainId: 43113 },
      isLoading: false,
    });

    render(<TokenGuide />);
    expect(screen.getByText(/You're currently on Avalanche Fuji Testnet/)).toBeInTheDocument();
  });

  it('displays the correct network for Ethereum mainnet', () => {
    mockUseConfig.mockReturnValue({
      config: { ...mockConfig, chainId: 1 },
      isLoading: false,
    });

    render(<TokenGuide />);
    expect(screen.getByText(/You're currently on Ethereum Mainnet/)).toBeInTheDocument();
  });

  it('displays fallback network name for unknown chain', () => {
    mockUseConfig.mockReturnValue({
      config: { ...mockConfig, chainId: 999999 }, // Use an unknown chain ID
      isLoading: false,
    });

    render(<TokenGuide />);
    expect(screen.getByText(/You're currently on Chain 999999/)).toBeInTheDocument();
  });

  it('displays the user wallet address', () => {
    render(<TokenGuide />);
    expect(screen.getByText(mockUser.walletAddress)).toBeInTheDocument();
  });

  it('has a copy button for the wallet address', () => {
    render(<TokenGuide />);
    const copyButton = screen.getByLabelText('Copy wallet address');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton.tagName).toBe('BUTTON');
  });

  it('shows all exchange links', () => {
    render(<TokenGuide />);

    // Check that all exchange links are present
    expect(screen.getByRole('link', { name: 'Coinbase' })).toHaveAttribute('href', 'https://www.coinbase.com/price/usdc');
    expect(screen.getByRole('link', { name: 'Binance' })).toHaveAttribute('href', 'https://www.binance.com');
    expect(screen.getByRole('link', { name: 'Kraken' })).toHaveAttribute('href', 'https://www.kraken.com');
    expect(screen.getByRole('link', { name: 'Crypto.com' })).toHaveAttribute('href', 'https://crypto.com');
    expect(screen.getByRole('link', { name: 'EasyCrypto' })).toHaveAttribute('href', 'https://easycrypto.com');
  });

  it('shows links with correct security attributes', () => {
    render(<TokenGuide />);

    // Check that external links have proper security attributes
    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('shows MetaMask/Coinbase as funding option', () => {
    render(<TokenGuide />);
    expect(screen.getByText(/MetaMask\/Coinbase:/)).toBeInTheDocument();
    expect(screen.getByText(/Transfer USDC to\/from another wallet/)).toBeInTheDocument();
  });


  it('displays important warning about network deposits', () => {
    render(<TokenGuide />);
    expect(screen.getByText(/Important:/)).toBeInTheDocument();
    expect(screen.getByText(/Ensure you're depositing USDC.*on the Avalanche C-Chain network/)).toBeInTheDocument();
  });

  it('adapts warning text for testnet', () => {
    mockUseConfig.mockReturnValue({
      config: { ...mockConfig, chainId: 43113 },
      isLoading: false,
    });

    render(<TokenGuide />);
    expect(screen.getByText(/on the Avalanche Fuji Testnet network/)).toBeInTheDocument();
  });

  it('returns null when user is not available', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isConnected: true,
      error: null,
      disconnect: jest.fn(),
      getEthersProvider: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn().mockReturnValue(false),
    });

    // mockUseWeb3AuthInstance.mockReturnValue({
    //   web3authProvider: null,
    //   isLoading: false,
    //   web3authInstance: null,
    //   onLogout: jest.fn(),
    // });

    mockUseWalletAddress.mockReturnValue({
      walletAddress: null,
      isLoading: false,
    });

    const { container } = render(<TokenGuide />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when config is not available', () => {
    mockUseConfig.mockReturnValue({
      config: null,
      isLoading: false,
    });

    const { container } = render(<TokenGuide />);
    expect(container.firstChild).toBeNull();
  });

  it('includes all funding methods', () => {
    render(<TokenGuide />);

    expect(screen.getByText(/MetaMask\/Coinbase:/)).toBeInTheDocument();
    expect(screen.getByText(/Major Exchanges:/)).toBeInTheDocument();
    expect(screen.getByText(/Cash Conversion:/)).toBeInTheDocument();
  });

  it('has proper styling classes', () => {
    render(<TokenGuide />);

    const container = screen.getByText('How to Add USDC to Your Wallet/How to get cash from your Wallet').closest('div');
    expect(container).toHaveClass('bg-blue-50', 'border', 'border-blue-200', 'rounded-lg', 'p-6');
  });

  it('displays numbered steps correctly', () => {
    render(<TokenGuide />);

    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });
});