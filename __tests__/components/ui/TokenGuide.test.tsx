import { render, act } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import TokenGuide from '@/components/ui/TokenGuide';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { detectUserCurrency } from '@/utils/currencyDetection';

// Mock the providers
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: jest.fn(),
}));

jest.mock('@/utils/currencyDetection', () => ({
  detectUserCurrency: jest.fn(),
}));

jest.mock('@onramp.money/onramp-web-sdk', () => ({
  OnrampWebSDK: jest.fn(),
}));

jest.mock('@/lib/coinbaseOnramp', () => ({
  openCoinbaseOnramp: jest.fn(),
}));

import { openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
const mockOpenCoinbaseOnramp = openCoinbaseOnramp as jest.MockedFunction<typeof openCoinbaseOnramp>;

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseWalletAddress = useWalletAddress as jest.MockedFunction<typeof useWalletAddress>;
const mockDetectUserCurrency = detectUserCurrency as jest.MockedFunction<typeof detectUserCurrency>;

describe('TokenGuide', () => {
  const mockUser = {
    userId: 'test-user',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    email: 'test@example.com',
    authProvider: 'web3auth' as const,
  };

  const mockConfig = {
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    usdcContractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    moonPayApiKey: 'test-api-key',
    minGasWei: '5',
    maxGasPriceGwei: '0.001',
    maxGasCostGwei: '0.15',
    usdcGrantFoundryGas: '150000',
    depositFundsFoundryGas: '150000',
    resolutionVoteFoundryGas: '80000',
    raiseDisputeFoundryGas: '150000',
    claimFundsFoundryGas: '150000',
    gasPriceBuffer: '1',
    basePath: '',
    explorerBaseUrl: 'https://snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  beforeEach(() => {
    mockDetectUserCurrency.mockReturnValue('USD');

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
      config: { ...mockConfig, chainId: 999999 },
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

    expect(screen.getByRole('link', { name: 'Coinbase' })).toHaveAttribute('href', 'https://www.coinbase.com/price/usdc');
    expect(screen.getByRole('link', { name: 'Binance' })).toHaveAttribute('href', 'https://www.binance.com');
    expect(screen.getByRole('link', { name: 'Kraken' })).toHaveAttribute('href', 'https://www.kraken.com');
    expect(screen.getByRole('link', { name: 'Crypto.com' })).toHaveAttribute('href', 'https://crypto.com');
    expect(screen.getByRole('link', { name: 'EasyCrypto' })).toHaveAttribute('href', 'https://easycrypto.com');
  });

  it('shows links with correct security attributes', () => {
    render(<TokenGuide />);

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

  it('has proper styling classes on manual instructions section', () => {
    render(<TokenGuide />);

    const heading = screen.getByText('How to Add USDC to Your Wallet/How to get cash from your Wallet');
    const container = heading.closest('div.bg-blue-50');
    expect(container).toHaveClass('bg-blue-50', 'border', 'border-blue-200', 'rounded-lg', 'p-6');
  });

  it('displays numbered steps correctly', () => {
    render(<TokenGuide />);

    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText(/2\. Your wallet address:/)).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });

  // Onramp widget tests
  describe('Onramp widget for Nigerian users', () => {
    const ngnConfig = {
      ...mockConfig,
      onrampAppId: '1953324',
    };

    it('does not show Onramp widget for non-Nigerian users', () => {
      mockDetectUserCurrency.mockReturnValue('USD');
      mockUseConfig.mockReturnValue({ config: ngnConfig, isLoading: false });

      render(<TokenGuide />);
      expect(screen.queryByText('Buy USDC with Naira')).not.toBeInTheDocument();
    });

    it('does not show Onramp widget when onrampAppId is not configured', () => {
      mockDetectUserCurrency.mockReturnValue('NGN');
      // mockConfig has no onrampAppId
      render(<TokenGuide />);
      expect(screen.queryByText('Buy USDC with Naira')).not.toBeInTheDocument();
    });

    it('shows Onramp widget section for Nigerian users with appId configured', () => {
      mockDetectUserCurrency.mockReturnValue('NGN');
      mockUseConfig.mockReturnValue({ config: ngnConfig, isLoading: false });

      render(<TokenGuide />);
      expect(screen.getByText('Buy USDC with Naira')).toBeInTheDocument();
      expect(screen.getByText(/Purchase USDC directly using Nigerian Naira/)).toBeInTheDocument();
    });

    it('shows alternative title for manual instructions when Onramp is shown', () => {
      mockDetectUserCurrency.mockReturnValue('NGN');
      mockUseConfig.mockReturnValue({ config: ngnConfig, isLoading: false });

      render(<TokenGuide />);
      expect(screen.getByText('Alternative: Manual Transfer')).toBeInTheDocument();
      expect(screen.queryByText('How to Add USDC to Your Wallet/How to get cash from your Wallet')).not.toBeInTheDocument();
    });

    it('renders the onramp widget container element', () => {
      mockDetectUserCurrency.mockReturnValue('NGN');
      mockUseConfig.mockReturnValue({ config: ngnConfig, isLoading: false });

      render(<TokenGuide />);
      const container = document.getElementById('onramp-widget-container');
      expect(container).toBeInTheDocument();
    });

    it('shows loading indicator while widget initializes', () => {
      mockDetectUserCurrency.mockReturnValue('NGN');
      mockUseConfig.mockReturnValue({ config: ngnConfig, isLoading: false });

      render(<TokenGuide />);
      expect(screen.getByText('Loading purchase widget...')).toBeInTheDocument();
    });

    it('uses correct token symbol in Onramp heading when currency prop provided', () => {
      mockDetectUserCurrency.mockReturnValue('NGN');
      mockUseConfig.mockReturnValue({ config: ngnConfig, isLoading: false });

      render(<TokenGuide currency="USDT" />);
      expect(screen.getByText('Buy USDT with Naira')).toBeInTheDocument();
    });
  });

  describe('Coinbase Onramp for non-Nigerian users', () => {
    const cbConfig = {
      ...mockConfig,
      coinbaseProjectId: 'test-project-id',
    };

    it('shows Coinbase button for non-NGN users when project ID is configured', () => {
      mockDetectUserCurrency.mockReturnValue('USD');
      mockUseConfig.mockReturnValue({ config: cbConfig, isLoading: false });

      render(<TokenGuide />);
      expect(screen.getByText('Buy USDC with Card or Bank')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Buy with Coinbase/ })).toBeInTheDocument();
    });

    it('hides Coinbase button when project ID is not configured', () => {
      mockDetectUserCurrency.mockReturnValue('USD');
      // mockConfig has no coinbaseProjectId
      render(<TokenGuide />);
      expect(screen.queryByText('Buy USDC with Card or Bank')).not.toBeInTheDocument();
    });

    it('hides Coinbase button for Nigerian users (Onramp.money takes priority)', () => {
      mockDetectUserCurrency.mockReturnValue('NGN');
      mockUseConfig.mockReturnValue({
        config: { ...cbConfig, onrampAppId: '1953324' },
        isLoading: false,
      });

      render(<TokenGuide />);
      expect(screen.queryByText('Buy USDC with Card or Bank')).not.toBeInTheDocument();
      expect(screen.getByText('Buy USDC with Naira')).toBeInTheDocument();
    });

    it('switches manual instructions heading to "Alternative" when Coinbase shown', () => {
      mockDetectUserCurrency.mockReturnValue('USD');
      mockUseConfig.mockReturnValue({ config: cbConfig, isLoading: false });

      render(<TokenGuide />);
      expect(screen.getByText('Alternative: Manual Transfer')).toBeInTheDocument();
    });

    it('calls openCoinbaseOnramp with the user wallet address on click', async () => {
      mockDetectUserCurrency.mockReturnValue('USD');
      mockUseConfig.mockReturnValue({ config: cbConfig, isLoading: false });
      mockOpenCoinbaseOnramp.mockResolvedValue(undefined);

      render(<TokenGuide />);
      const button = screen.getByRole('button', { name: /Buy with Coinbase/ });
      await act(async () => {
        button.click();
      });

      expect(mockOpenCoinbaseOnramp).toHaveBeenCalledWith({ walletAddress: mockUser.walletAddress });
    });

    it('uses correct token symbol when currency prop is provided', () => {
      mockDetectUserCurrency.mockReturnValue('USD');
      mockUseConfig.mockReturnValue({ config: cbConfig, isLoading: false });

      render(<TokenGuide currency="USDT" />);
      expect(screen.getByText('Buy USDT with Card or Bank')).toBeInTheDocument();
    });
  });
});
