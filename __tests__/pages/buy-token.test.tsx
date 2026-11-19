import { render, fireEvent, waitFor, within } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import BuyToken from '@/pages/buy-token';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

const mockUseWalletAddress = jest.fn();
jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: () => mockUseWalletAddress(),
}));

const mockUseAuth = jest.fn();
jest.mock('@/components/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// FundingOptions reads the wallet provider's on-ramp from here; the page reads the user from above.
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseConfig = jest.fn();
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => mockUseConfig(),
}));

jest.mock('@/components/auth/ConnectWalletEmbedded', () => ({
  __esModule: true,
  default: () => <button>Connect</button>,
}));

const mockCoinbaseAvailability = jest.fn();
jest.mock('@/hooks/useCoinbaseAvailability', () => ({
  useCoinbaseAvailability: () => mockCoinbaseAvailability(),
}));

const mockLinkAvailability = jest.fn();
jest.mock('@/hooks/useLinkAvailability', () => ({
  useLinkAvailability: () => mockLinkAvailability(),
}));

jest.mock('@/hooks/useOnrampMinimum', () => ({
  useOnrampMinimum: () => null,
}));

const mockVisitorCountry = jest.fn();
jest.mock('@/lib/visitorCountry', () => ({
  visitorCountry: () => mockVisitorCountry(),
}));

const mockReportFundingEvent = jest.fn();
jest.mock('@/lib/reportFundingEvent', () => ({
  reportFundingEvent: (...args: unknown[]) => mockReportFundingEvent(...args),
}));

const mockOpenCoinbaseOnramp = jest.fn();
jest.mock('@/lib/coinbaseOnramp', () => ({
  ONRAMP_RETURN_MESSAGE: 'coinbase-onramp-return',
  openCoinbaseOnramp: (...args: unknown[]) => mockOpenCoinbaseOnramp(...args),
}));

const USDC = { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, name: 'USD Coin' };
const USDT = { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6, name: 'Tether' };

const available = { unavailable: false, countryName: null, overrule: jest.fn() };

function signedIn(auth: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({
    user: { userId: '1', email: 'test@example.com', walletAddress: WALLET },
    isLoading: false,
    canFundWallet: () => true,
    fundWallet: jest.fn().mockResolvedValue({ status: 'completed' }),
    ...auth,
  });
  mockUseWalletAddress.mockReturnValue({ walletAddress: WALLET, isLoading: false });
}

function signedOut() {
  mockUseAuth.mockReturnValue({ user: null, isLoading: false, canFundWallet: () => false, fundWallet: jest.fn() });
  mockUseWalletAddress.mockReturnValue({ walletAddress: null, isLoading: false });
}

function configured(config: Record<string, unknown> = {}) {
  mockUseConfig.mockReturnValue({
    config: {
      chainId: 8453,
      tokenSymbol: 'USDC',
      defaultToken: USDC,
      supportedTokens: [USDC],
      coinbaseProjectId: 'project',
      ...config,
    },
    isLoading: false,
  });
}

describe('BuyToken page', () => {
  let open: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    signedIn();
    configured();
    mockCoinbaseAvailability.mockReturnValue(available);
    mockLinkAvailability.mockReturnValue(available);
    mockVisitorCountry.mockResolvedValue(null);
    mockOpenCoinbaseOnramp.mockResolvedValue(undefined);
    open = jest.spyOn(window, 'open').mockImplementation(() => null);
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => open.mockRestore());

  it('names the token and the network, without the word Mainnet', () => {
    render(<BuyToken />);
    expect(screen.getByRole('heading', { level: 1, name: 'Add USDC to your wallet' })).toBeInTheDocument();
    expect(screen.getAllByText('Base').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mainnet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Web3Auth/)).not.toBeInTheDocument();
  });

  it('shows the wallet address wherever it has to be pasted', () => {
    render(<BuyToken />);
    const boxes = screen.getAllByLabelText('Your wallet address') as HTMLInputElement[];
    expect(boxes.length).toBe(2);
    boxes.forEach((box) => expect(box.value).toBe(WALLET));
  });

  describe('the wallet provider on-ramp', () => {
    it('asks for the amount typed, in the token, on the app chain', async () => {
      const fundWallet = jest.fn().mockResolvedValue({ status: 'completed', detail: 'confirmed' });
      signedIn({ fundWallet });
      render(<BuyToken />);

      fireEvent.change(screen.getByLabelText(/How much USDC/), { target: { value: '120.005' } });
      fireEvent.click(screen.getByRole('button', { name: /Add funds with a card/ }));

      await waitFor(() => expect(fundWallet).toHaveBeenCalledWith({ amount: '120.01', asset: 'USDC', chainId: 8453 }));
      await waitFor(() =>
        expect(mockReportFundingEvent).toHaveBeenCalledWith('privy-completed', { wallet: WALLET, amount: '120.01', detail: 'confirmed' })
      );
    });

    it('shows why it could not open', async () => {
      signedIn({ fundWallet: jest.fn().mockRejectedValue(new Error('No providers for this purchase')) });
      render(<BuyToken />);
      fireEvent.click(screen.getByRole('button', { name: /Add funds with a card/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('No providers for this purchase');
    });

    it('is not offered to a wallet whose provider has none', () => {
      signedIn({ canFundWallet: () => false });
      render(<BuyToken />);
      expect(screen.queryByRole('button', { name: /Add funds with a card/ })).not.toBeInTheDocument();
    });
  });

  describe('Coinbase', () => {
    it('is asked for tokens delivered to the wallet', async () => {
      render(<BuyToken />);
      fireEvent.click(screen.getByRole('button', { name: /Add from Coinbase/ }));
      await waitFor(() =>
        expect(mockOpenCoinbaseOnramp).toHaveBeenCalledWith({
          destinationAddress: WALLET,
          purpose: 'guide',
          asset: 'USDC',
          presetCryptoAmount: 50,
          returnPath: undefined,
        })
      );
    });

    it('is never asked for less than its minimum', async () => {
      render(<BuyToken />);
      fireEvent.change(screen.getByLabelText(/How much USDC/), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: /Add from Coinbase/ }));
      await waitFor(() => expect(mockOpenCoinbaseOnramp).toHaveBeenCalledWith(expect.objectContaining({ presetCryptoAmount: 5 })));
    });

    it('is left out when there is no Coinbase project', () => {
      configured({ coinbaseProjectId: undefined });
      render(<BuyToken />);
      expect(screen.queryByRole('button', { name: /Add from Coinbase/ })).not.toBeInTheDocument();
    });

    it('is greyed out, with a way to overrule, where Coinbase cannot serve', () => {
      const overrule = jest.fn();
      mockCoinbaseAvailability.mockReturnValue({ unavailable: true, countryName: 'Nigeria', overrule });
      render(<BuyToken />);
      expect(screen.getByRole('button', { name: /Add from Coinbase/ })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Not in Nigeria?' }));
      expect(overrule).toHaveBeenCalled();
    });
  });

  describe('Kraken', () => {
    it('opens its purchase page for this wallet, at its minimum when less is asked for', () => {
      render(<BuyToken />);
      fireEvent.change(screen.getByLabelText(/How much USDC/), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /Add from Kraken/ }));

      const url = new URL(open.mock.calls[0][0]);
      expect(url.origin).toBe('https://ramp.kraken.com');
      expect(url.searchParams.get('wallet_address')).toBe(WALLET);
      expect(url.searchParams.get('amount')).toBe('11');
      expect(url.searchParams.get('network')).toBe('Base');
      expect(mockReportFundingEvent).toHaveBeenCalledWith('kraken-opened', { wallet: WALLET, amount: '11' });
    });

    it('is greyed out on a network it does not deliver to', () => {
      configured({ chainId: 43113 });
      render(<BuyToken />);
      expect(screen.getByRole('button', { name: /Add from Kraken/ })).toBeDisabled();
      expect(screen.getByText(/Kraken can't deliver USDC on Avalanche Fuji Testnet/)).toBeInTheDocument();
    });
  });

  describe('Link', () => {
    it('opens with the purchase filled in and copies the address to paste there', () => {
      render(<BuyToken />);
      fireEvent.click(screen.getByRole('button', { name: /Add with Link/ }));

      const url = new URL(open.mock.calls[0][0]);
      expect(url.origin).toBe('https://crypto.link.com');
      expect(url.searchParams.get('destination_amount')).toBe('50');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(WALLET);
    });

    it('is greyed out outside the United States', () => {
      mockLinkAvailability.mockReturnValue({ unavailable: true, countryName: 'Australia', overrule: jest.fn() });
      render(<BuyToken />);
      expect(screen.getByRole('button', { name: /Add with Link/ })).toBeDisabled();
    });
  });

  it('opens nothing without an amount', () => {
    render(<BuyToken />);
    fireEvent.change(screen.getByLabelText(/How much USDC/), { target: { value: '' } });
    expect(screen.getByText('Enter an amount to buy.')).toBeInTheDocument();
    ['Add funds with a card', 'Add from Coinbase', 'Add from Kraken', 'Add with Link'].forEach((name) =>
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDisabled()
    );
  });

  it('greys out the buying routes for a token no on-ramp delivers', () => {
    configured({ supportedTokens: [USDC, USDT] });
    render(<BuyToken />);
    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'USDT' } });

    expect(screen.getByRole('heading', { level: 1, name: 'Add USDT to your wallet' })).toBeInTheDocument();
    ['Add funds with a card', 'Add from Coinbase', 'Add from Kraken', 'Add with Link'].forEach((name) =>
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDisabled()
    );
  });

  describe('the exchange list', () => {
    it('links to each exchange in a new tab', () => {
      render(<BuyToken />);
      const section = screen.getByText('More places to buy USDC').closest('details') as HTMLElement;
      expect(section).toHaveAttribute('open');
      for (const [name, href] of [
        ['Kraken', 'https://www.kraken.com'],
        ['Binance', 'https://www.binance.com'],
        ['Swyftx', 'https://swyftx.com'],
        ['Coinbase', 'https://www.coinbase.com'],
      ]) {
        const link = within(section).getAllByRole('link').find((a) => a.getAttribute('href') === href) as HTMLElement;
        expect(link).toHaveTextContent(name);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
      expect(within(section).getAllByRole('link').length).toBe(79);
    });

    it('says to check the withdrawal network before buying', () => {
      render(<BuyToken />);
      expect(screen.getByText(/not every company here can send USDC on Base/)).toBeInTheDocument();
    });

    it('puts the visitor’s local exchanges first, once', async () => {
      mockVisitorCountry.mockResolvedValue('AU');
      render(<BuyToken />);

      const local = (await screen.findByRole('heading', { name: 'Popular in Australia' })).parentElement as HTMLElement;
      expect(within(local).getByRole('link', { name: /^Swyftx/ })).toBeInTheDocument();
      expect(within(local).getByRole('link', { name: /^Kraken/ })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /^Swyftx/ }).length).toBe(1);
    });
  });

  describe('signed out', () => {
    beforeEach(signedOut);

    it('asks to connect, and still lists the exchanges', () => {
      render(<BuyToken />);
      expect(screen.getByRole('heading', { name: 'Connect your wallet' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Swyftx/ })).toBeInTheDocument();
    });

    it('offers no route that needs a wallet', () => {
      render(<BuyToken />);
      expect(screen.queryByRole('button', { name: /Add from Kraken/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Transfer from another wallet/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Your wallet address')).not.toBeInTheDocument();
      expect(screen.getByText(/Connect your wallet to see it/)).toBeInTheDocument();
    });
  });

  it('shows the address and a code to scan for a transfer from another wallet', () => {
    render(<BuyToken />);
    fireEvent.click(screen.getByRole('button', { name: /Transfer from another wallet/ }));
    expect(screen.getByText(/Scan with your wallet app to send/)).toBeInTheDocument();
    expect(screen.getByText('50.0000 USDC')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /Add from Kraken/ })).toBeInTheDocument();
  });

  it('shows a spinner while the wallet is loading', () => {
    mockUseWalletAddress.mockReturnValue({ walletAddress: null, isLoading: true });
    render(<BuyToken />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
