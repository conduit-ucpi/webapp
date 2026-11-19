/**
 * The pay screen is one of two things. A wallet that can pay gets one button. One that cannot gets
 * three ways on, each a section on the screen itself:
 *   a. card or bank, straight to the payment's contract address;
 *   b. another wallet, straight to the contract address;
 *   c. top up this wallet, then pay from it.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));
const mockOpenCoinbase = jest.fn();
jest.mock('@/lib/coinbaseOnramp', () => ({
  ONRAMP_RETURN_MESSAGE: 'coinbase-onramp-return',
  openCoinbaseOnramp: (options: unknown) => mockOpenCoinbase(options),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453 } }),
}));
const fundWallet = jest.fn();
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => true, fundWallet }),
}));

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const CONTRACT = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';
const onPayFromExternalWallet = jest.fn();
const onRefreshBalance = jest.fn();
const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '32.39 USDC',
  amountInTokens: 32.391,
  balanceFloat: 0,
  tokenSymbol: 'USDC',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  tokenDecimals: 6,
  chainId: 8453,
  walletAddress: WALLET,
  networkName: 'Base',
  isLoadingBalance: false,
  hasInsufficientBalance: true,
  isSameAddress: false,
  isPaymentInProgress: false,
  onPay: jest.fn(),
  onPayFromExternalWallet,
  onRefreshBalance,
  resolveEscrowAddress: async () => CONTRACT,
  elsewherePanel: <div>the contract address panel</div>,
  ...overrides,
});
const section = (name: RegExp) => screen.queryByRole('button', { name, expanded: false }) ?? screen.queryByRole('button', { name, expanded: true });
const CARD = /Pay by card or bank transfer/;
const ELSEWHERE = /Pay from another wallet/;
const TOP_UP = /Add USDC to this wallet, then pay/;
const openSection = (name: RegExp) => fireEvent.click(section(name)!);
const payButton = () => screen.queryByRole('button', { name: /Pay 32.39 USDC from this wallet/ });

describe('PaymentActionPanel', () => {
  let tab: { opener: unknown; location: { href: string }; close: jest.Mock };
  let open: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    fundWallet.mockResolvedValue({ status: 'cancelled' });
    mockOpenCoinbase.mockResolvedValue(undefined);
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
    tab = { opener: {}, location: { href: '' }, close: jest.fn() };
    open = jest.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => open.mockRestore());

  describe('a wallet that can pay', () => {
    const rich = () => props({ balanceFloat: 50, hasInsufficientBalance: false });

    it('gets one button, and nothing else to choose', () => {
      render(<PaymentActionPanel {...rich()} />);
      expect(payButton()).toBeEnabled();
      expect(section(CARD)).toBeNull();
      expect(section(ELSEWHERE)).toBeNull();
      expect(section(TOP_UP)).toBeNull();
    });

    it('is told the wallet will ask them to approve the transfer', () => {
      render(<PaymentActionPanel {...rich()} />);
      expect(screen.getByText('Your wallet will ask you to approve the transfer.')).toBeInTheDocument();
    });

    it('does not re-read the balance when they come back to the tab', () => {
      render(<PaymentActionPanel {...rich()} />);
      fireEvent.focus(window);
      expect(onRefreshBalance).not.toHaveBeenCalled();
    });
  });

  describe('a wallet that cannot pay', () => {
    it('gets the three ways on, on the screen, closed, and no dead pay button', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText("Your wallet can't pay this yet. Choose how you'd like to pay:")).toBeInTheDocument();
      [CARD, ELSEWHERE, TOP_UP].forEach((name) => expect(section(name)).toHaveAttribute('aria-expanded', 'false'));
      expect(payButton()).toBeNull();
      expect(screen.queryByText(/Continue with/)).toBeNull();
      expect(screen.queryByText('the contract address panel')).toBeNull();
    });

    it('opens one section at a time', () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(CARD);
      expect(section(CARD)).toHaveAttribute('aria-expanded', 'true');
      openSection(TOP_UP);
      expect(section(CARD)).toHaveAttribute('aria-expanded', 'false');
      expect(section(TOP_UP)).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not show them before the balance has been read once', () => {
      render(<PaymentActionPanel {...props({ isLoadingBalance: true })} />);
      expect(section(CARD)).toBeNull();
    });

    it('keeps them up, and the open one open, while the balance is read again', () => {
      const { rerender } = render(<PaymentActionPanel {...props()} />);
      openSection(TOP_UP);
      rerender(<PaymentActionPanel {...props({ isLoadingBalance: true })} />);
      expect(section(TOP_UP)).toHaveAttribute('aria-expanded', 'true');
    });

    it('becomes the one button when the money is in the wallet', () => {
      const { rerender } = render(<PaymentActionPanel {...props()} />);
      rerender(<PaymentActionPanel {...props({ balanceFloat: 40, hasInsufficientBalance: false })} />);
      expect(section(CARD)).toBeNull();
      expect(payButton()).toBeEnabled();
    });

    it('offers nothing where the buyer is paying themselves', () => {
      render(<PaymentActionPanel {...props({ isSameAddress: true })} />);
      expect(section(CARD)).toBeNull();
      expect(payButton()).toBeDisabled();
    });
  });

  describe('a. card or bank, straight to the payment', () => {
    const provider = (name: RegExp) => screen.queryByRole('button', { name });

    it('offers Coinbase, Kraken and Link side by side, each with the fact that tells it apart', () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(CARD);
      expect(provider(/Continue with Coinbase.*Card or bank transfer/)).toBeEnabled();
      expect(provider(/Continue with Kraken.*Card, from 11 USD/)).toBeEnabled();
      expect(provider(/Continue with Link by Stripe/)).toBeEnabled();
    });

    it('offers Coinbase and Link to everyone, saying where each may not work', () => {
      (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'Venezuela', overrule: jest.fn() });
      render(<PaymentActionPanel {...props()} />);
      openSection(CARD);
      expect(provider(/Continue with Coinbase/)).toBeEnabled();
      expect(screen.getByText('For United States Coinbase accounts. Coinbase refuses this for everyone else.')).toBeInTheDocument();
      expect(provider(/Continue with Link by Stripe/)).toBeEnabled();
      expect(screen.getByText('Link sells in the United States, so it may not work in your country.')).toBeInTheDocument();
    });

    it('Coinbase is sent the exact amount to the contract address, and coming back lands on "I have paid"', async () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(CARD);
      fireEvent.click(provider(/Continue with Coinbase/)!);
      await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
      const options = mockOpenCoinbase.mock.calls[0][0];
      expect(options).toMatchObject({ destinationAddress: CONTRACT, purpose: 'pay-by-card', asset: 'USDC', presetCryptoAmount: 32.4 });
      expect(screen.queryByText('the contract address panel')).toBeNull();

      act(() => options.onPopupClosed());
      expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
      expect(onPayFromExternalWallet).toHaveBeenCalled();
    });

    it('Kraken is sent the exact amount to the contract address, then the address and "I have paid" are shown', async () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(CARD);
      fireEvent.click(provider(/Continue with Kraken/)!);
      // Opened during the click, before the address is known, so the browser does not block it.
      expect(open).toHaveBeenCalledWith('', '_blank');
      await waitFor(() => expect(tab.location.href).toContain('https://ramp.kraken.com/entry?'));
      const url = new URL(tab.location.href);
      expect(url.searchParams.get('wallet_address')).toBe(CONTRACT);
      expect(url.searchParams.get('amount')).toBe('32.4');
      expect(tab.opener).toBeNull();
      expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
    });

    it('Link takes no address, so the contract address is copied for the buyer to paste there', async () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(CARD);
      fireEvent.click(provider(/Continue with Link by Stripe/)!);
      await waitFor(() => expect(tab.location.href).toContain('https://crypto.link.com/?'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CONTRACT);
      expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
    });

    it("drops a provider below its minimum, with the reason: the contract address takes the exact amount", () => {
      (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 7, currency: 'USD', inTokens: 7 });
      render(<PaymentActionPanel {...props({ amountLabel: '5 USDC', amountInTokens: 5 })} />);
      openSection(CARD);
      expect(provider(/Continue with Coinbase/)).toBeNull();
      expect(provider(/Continue with Kraken/)).toBeNull();
      expect(screen.getByText('Coinbase: this amount is below its minimum of 7 USD.')).toBeInTheDocument();
      expect(screen.getByText('Kraken: this amount is below its minimum of 11 USD.')).toBeInTheDocument();
      expect(provider(/Continue with Link by Stripe/)).toBeEnabled();
    });

    it('drops Kraken and Link on a network they do not deliver to', () => {
      render(<PaymentActionPanel {...props({ chainId: 1, networkName: 'Ethereum' })} />);
      openSection(CARD);
      expect(provider(/Continue with Kraken/)).toBeNull();
      expect(screen.getByText("Kraken can't deliver USDC on Ethereum yet.")).toBeInTheDocument();
      expect(screen.getByText("Link can't deliver USDC on Ethereum yet.")).toBeInTheDocument();
    });

    it('closes the tab and says so when the contract address cannot be prepared', async () => {
      render(<PaymentActionPanel {...props({ resolveEscrowAddress: async () => null })} />);
      openSection(CARD);
      fireEvent.click(provider(/Continue with Kraken/)!);
      await waitFor(() => expect(tab.close).toHaveBeenCalled());
      expect(onPayFromExternalWallet).not.toHaveBeenCalled();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('is not offered where there is no contract address to send to', () => {
      render(<PaymentActionPanel {...props({ resolveEscrowAddress: undefined })} />);
      expect(section(CARD)).toBeNull();
    });
  });

  describe('b. another wallet, straight to the payment', () => {
    it('shows the contract address panel, stresses the network, and starts the address', () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(ELSEWHERE);
      expect(screen.getByText('the contract address panel')).toBeInTheDocument();
      expect(screen.getByText('Send only USDC on Base. Funds sent on another network may be lost.')).toBeInTheDocument();
      expect(onPayFromExternalWallet).toHaveBeenCalledTimes(1);
    });

    it('is left out where the payment has no address to send to', () => {
      render(<PaymentActionPanel {...props({ elsewherePanel: undefined })} />);
      expect(section(ELSEWHERE)).toBeNull();
    });
  });

  describe('c. top up this wallet', () => {
    it('says how much is missing', () => {
      render(<PaymentActionPanel {...props({ balanceFloat: 10 })} />);
      expect(within(section(TOP_UP)!).getByText('You hold 10.00 USDC. Add 22.40 more, then pay from it.')).toBeInTheDocument();
    });

    it('gives the wallet address to copy, a code to scan, and stresses the network', () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(TOP_UP);
      expect(screen.getByText('Your wallet, on Base')).toBeInTheDocument();
      expect((screen.getAllByLabelText('Your wallet address')[0] as HTMLInputElement).value).toBe(WALLET);
      expect(screen.getByText('Send only USDC on Base. Funds sent on another network may be lost.')).toBeInTheDocument();
      expect(document.querySelector('svg[height="160"]')).not.toBeNull();
    });

    it('lists the ways to add it, the exchanges included, each for the shortfall and into the wallet', () => {
      render(<PaymentActionPanel {...props({ balanceFloat: 10 })} />);
      openSection(TOP_UP);
      const exchanges = screen.getByText('More places to buy USDC').closest('details') as HTMLElement;
      expect(exchanges.querySelector('a[href="https://swyftx.com"]')).not.toBeNull();

      open.mockImplementation(() => null);
      fireEvent.click(screen.getByRole('button', { name: /Add from Kraken/ }));
      const url = new URL(open.mock.calls[0][0]);
      expect(url.searchParams.get('wallet_address')).toBe(WALLET);
      expect(url.searchParams.get('amount')).toBe('22.4');

      fireEvent.click(screen.getByRole('button', { name: /Add funds with a card/ }));
      expect(fundWallet).toHaveBeenCalledWith(expect.objectContaining({ amount: '22.40', asset: 'USDC' }));
    });

    it("works below a provider's minimum, because what is over stays in the wallet", () => {
      render(<PaymentActionPanel {...props({ amountLabel: '5 USDC', amountInTokens: 5 })} />);
      openSection(TOP_UP);
      open.mockImplementation(() => null);
      fireEvent.click(screen.getByRole('button', { name: /Add from Kraken/ }));
      expect(new URL(open.mock.calls[0][0]).searchParams.get('amount')).toBe('11');
    });

    it('says to come back and press Pay, and that the wallet will ask them to approve', () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(TOP_UP);
      expect(
        screen.getByText('When it arrives, come back to this page and press Pay. Your wallet will ask you to approve the transfer.')
      ).toBeInTheDocument();
    });

    it('reads the balance again when asked, and when the buyer comes back to the tab, but not over and over', () => {
      render(<PaymentActionPanel {...props()} />);
      openSection(TOP_UP);
      fireEvent.click(screen.getByRole('button', { name: "I've added it: check my balance" }));
      expect(onRefreshBalance).toHaveBeenCalledTimes(1);
      fireEvent.focus(window);
      fireEvent.focus(window);
      expect(onRefreshBalance).toHaveBeenCalledTimes(2);
    });
  });

  describe("a seller's preview", () => {
    it('shows the three ways, openable, with nothing live and nothing of the seller\'s own wallet', () => {
      render(<PaymentActionPanel {...props({ preview: true, elsewherePanel: <button type="button">I have paid</button> })} />);
      expect(payButton()).toBeNull();
      expect(screen.getByText(/A customer whose wallet cannot pay sees these ways to pay/)).toBeInTheDocument();

      openSection(CARD);
      screen.getAllByRole('button', { name: /^Continue with/ }).forEach((button) => expect(button).toBeDisabled());

      openSection(ELSEWHERE);
      expect(screen.getByRole('button', { name: 'I have paid' })).toBeDisabled();
      expect(onPayFromExternalWallet).not.toHaveBeenCalled();

      openSection(TOP_UP);
      expect(screen.getByRole('button', { name: /Add from Kraken/ })).toBeDisabled();
      expect(screen.queryByDisplayValue(WALLET)).toBeNull();
      expect(screen.queryByText(new RegExp(WALLET))).toBeNull();
      expect(mockOpenCoinbase).not.toHaveBeenCalled();
    });
  });
});
