/**
 * The pay screen is one of two things. A wallet that can pay gets one button. One that cannot is
 * asked "How do you want to pay?" and given two answers, on the screen itself:
 *   a. card or bank: one row per company, delivered straight to the payment's contract address
 *      where the company can and into this wallet where it cannot;
 *   b. crypto I already have: the contract address to send to, or this wallet's to top up.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability');
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
const tile = (name: RegExp) => screen.queryByRole('button', { name, pressed: true }) ?? screen.queryByRole('button', { name, pressed: false });
const CARD = /Card or bank/;
const CRYPTO = /Crypto I already have/;
const choose = (name: RegExp) => fireEvent.click(tile(name)!);
const provider = (name: RegExp) => screen.queryByRole('button', { name });
/** The row a company is listed in: its name, what it needs, where it delivers, and its button. */
const row = (name: RegExp) => provider(name)!.closest('li') as HTMLElement;
/** What the chosen company's row says to do next, or null while it has not been chosen. */
const nextStep = (name: RegExp) =>
  within(row(name)).queryByText('When you have paid there:')?.parentElement ?? null;
const payButton = () => screen.queryByRole('button', { name: /Pay 32.39 USDC from this wallet/ });
const QUESTION = 'How do you want to pay?';
/** What a row says, in full: its name, its one line, and its button. */
const says = (name: RegExp) => row(name).textContent;
const PASTE = 'Paste the address we copy for you when it asks.';

describe('PaymentActionPanel', () => {
  let tab: { opener: unknown; location: { href: string }; close: jest.Mock };
  let open: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    fundWallet.mockResolvedValue({ status: 'cancelled' });
    mockOpenCoinbase.mockResolvedValue(undefined);
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
    // Country unknown: nobody is assumed to be outside the United States.
    (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
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
      expect(screen.queryByText(QUESTION)).toBeNull();
      expect(tile(CARD)).toBeNull();
      expect(tile(CRYPTO)).toBeNull();
    });

    it('sees its wallet and balance at the top', () => {
      render(<PaymentActionPanel {...rich()} />);
      expect(screen.getByText('Connected wallet')).toBeInTheDocument();
      expect(screen.getByText('50.0000 USDC')).toBeInTheDocument();
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
    it('is asked how it wants to pay, with card or bank already open and no dead pay button', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('heading', { name: QUESTION })).toBeInTheDocument();
      expect(tile(CARD)).toHaveAttribute('aria-pressed', 'true');
      expect(tile(CARD)).toHaveTextContent('No crypto needed');
      expect(tile(CRYPTO)).toHaveAttribute('aria-pressed', 'false');
      expect(tile(CRYPTO)).toHaveTextContent('USDC on Base');
      expect(payButton()).toBeNull();
      expect(provider(/Continue with Kraken/)).toBeEnabled();
      expect(screen.queryByText('the contract address panel')).toBeNull();
    });

    // A red "32.3910 USDC short" as the first thing read as a failure to a buyer with no crypto.
    it('is not told first that it is short: the wallet is one quiet line at the foot', () => {
      render(<PaymentActionPanel {...props({ balanceFloat: 10 })} />);
      expect(screen.queryByText(/short/)).toBeNull();
      expect(screen.queryByText('Connected wallet')).toBeNull();
      const line = screen.getByText('Your wallet here:').closest('p') as HTMLElement;
      expect(line).toHaveTextContent('0x1234...5678');
      expect(line).toHaveTextContent('10.0000 USDC');
      expect(within(line).getByRole('button', { name: 'Copy full wallet address' })).toBeEnabled();
    });

    it('shows one answer at a time, and choosing the open one again leaves it open', () => {
      render(<PaymentActionPanel {...props()} />);
      choose(CRYPTO);
      expect(tile(CRYPTO)).toHaveAttribute('aria-pressed', 'true');
      expect(tile(CARD)).toHaveAttribute('aria-pressed', 'false');
      expect(provider(/Continue with Kraken/)).toBeNull();
      choose(CRYPTO);
      expect(tile(CRYPTO)).toHaveAttribute('aria-pressed', 'true');
      choose(CARD);
      expect(provider(/Continue with Kraken/)).toBeEnabled();
      expect(screen.queryByText('the contract address panel')).toBeNull();
    });

    it('does not ask before the balance has been read once', () => {
      render(<PaymentActionPanel {...props({ isLoadingBalance: true })} />);
      expect(screen.queryByText(QUESTION)).toBeNull();
    });

    it('keeps the answer that is open, open, while the balance is read again', () => {
      const { rerender } = render(<PaymentActionPanel {...props()} />);
      choose(CRYPTO);
      rerender(<PaymentActionPanel {...props({ isLoadingBalance: true })} />);
      expect(tile(CRYPTO)).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('the contract address panel')).toBeInTheDocument();
    });

    it('becomes the one button when the money is in the wallet', () => {
      const { rerender } = render(<PaymentActionPanel {...props()} />);
      rerender(<PaymentActionPanel {...props({ balanceFloat: 40, hasInsufficientBalance: false })} />);
      expect(screen.queryByText(QUESTION)).toBeNull();
      expect(payButton()).toBeEnabled();
    });

    it('offers nothing where the buyer is paying themselves', () => {
      render(<PaymentActionPanel {...props({ isSameAddress: true })} />);
      expect(screen.queryByText(QUESTION)).toBeNull();
      expect(payButton()).toBeDisabled();
    });

    it('has no tiles to choose between when there is only one answer', () => {
      // A token nobody sells, in a wallet with nothing to convert: it can only be sent from elsewhere.
      render(<PaymentActionPanel {...props({ tokenSymbol: 'DAI', amountLabel: '32.39 DAI' })} />);
      expect(screen.getByRole('heading', { name: QUESTION })).toBeInTheDocument();
      expect(tile(CARD)).toBeNull();
      expect(tile(CRYPTO)).toBeNull();
      expect(screen.getByText('the contract address panel')).toBeInTheDocument();
    });
  });

  describe('a. card or bank', () => {
    /*
     * Each row had three or four lines: what it takes, where it delivers, what to paste, where it
     * will not work. Nobody could tell the companies apart for words. One line now, with only what
     * decides the choice or has to be known over there.
     */
    it('lists each company once: its name, one line, and a button', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.getAllByRole('button', { name: /^Continue with/ })).toHaveLength(4);
      expect(says(/Continue with Card, Apple Pay or Google Pay/)).toBe(
        'Card, Apple Pay or Google PayNo account needed. Check you will receive at least 32.40 USDC: its fee comes out of what you pay.Continue'
      );
      expect(says(/Continue with Kraken/)).toBe(`KrakenCard. Needs a Kraken account. ${PASTE}Continue`);
      expect(says(/Continue with Coinbase/)).toBe('CoinbaseCard or bank transfer. Needs a United States Coinbase account.Continue');
      expect(says(/Continue with Link by Stripe/)).toBe(`Link by StripeCard. Sells in the United States only. ${PASTE}Continue`);
    });

    /*
     * The next step was a box under the whole list headed "After you pay with Kraken", which read
     * as belonging to every company above it. It is inside the chosen company's own row.
     */
    it("puts what to do next inside the chosen company's row, and nowhere else", async () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.queryByText('When you have paid there:')).toBeNull();

      fireEvent.click(provider(/Continue with Kraken/)!);
      expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
      expect(screen.getAllByText('When you have paid there:')).toHaveLength(1);
      expect(within(row(/Continue with Kraken/)).getByText('the contract address panel')).toBeInTheDocument();
      expect(nextStep(/Continue with Coinbase/)).toBeNull();

      // Choosing another moves it to that one's row.
      fireEvent.click(provider(/Continue with Card/)!);
      expect(screen.getAllByText('When you have paid there:')).toHaveLength(1);
      expect(nextStep(/Continue with Card/)).toHaveTextContent('press Pay');
      expect(nextStep(/Continue with Kraken/)).toBeNull();
    });

    // It changes nothing about which to choose, and is said as what to do next once one is chosen.
    it('does not say where each delivers until one is chosen', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.queryByText(/straight to this payment/i)).toBeNull();
      expect(screen.queryByText(/into your wallet/i)).toBeNull();
    });

    it('says once, above them, that each adds its own fee and to come back afterwards', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(
        screen.getByText('Each adds its own fee, shown there before you pay. Afterwards, come back to this page.')
      ).toBeInTheDocument();
    });

    it('puts the companies with a warning after those without', () => {
      render(<PaymentActionPanel {...props()} />);
      const names = screen.getAllByRole('button', { name: /^Continue with/ }).map((button) => button.getAttribute('aria-label'));
      expect(names).toEqual([
        'Continue with Card, Apple Pay or Google Pay',
        'Continue with Kraken',
        'Continue with Coinbase',
        'Continue with Link by Stripe',
      ]);
      expect(row(/Continue with Coinbase/)).toHaveTextContent('Needs a United States Coinbase account.');
      expect(row(/Continue with Link by Stripe/)).toHaveTextContent('Sells in the United States only.');
    });

    describe('the card window (no account)', () => {
      it('buys the shortfall into the wallet, and tells the buyer to check what they will receive', () => {
        render(<PaymentActionPanel {...props({ balanceFloat: 10 })} />);
        expect(row(/Continue with Card/)).toHaveTextContent(
          'Check you will receive at least 22.40 USDC: its fee comes out of what you pay.'
        );
        fireEvent.click(provider(/Continue with Card/)!);
        expect(fundWallet).toHaveBeenCalledWith(expect.objectContaining({ amount: '22.40', asset: 'USDC' }));
      });

      it('then shows the wallet it lands in, and how to finish', () => {
        render(<PaymentActionPanel {...props()} />);
        fireEvent.click(provider(/Continue with Card/)!);
        const after = nextStep(/Continue with Card/)!;
        expect(after).toHaveTextContent('When it arrives, come back to this page and press Pay. Your wallet will ask you to approve the transfer.');
        expect((within(after).getByLabelText('Your wallet address') as HTMLInputElement).value).toBe(WALLET);
        expect(within(after).getByText('Send only USDC on Base. Funds sent on another network may be lost.')).toBeInTheDocument();
        expect(screen.queryByText('the contract address panel')).toBeNull();
        fireEvent.click(within(after).getByRole('button', { name: "I've added it: check my balance" }));
        expect(onRefreshBalance).toHaveBeenCalledTimes(1);
      });

      it('is left out for a wallet provider with no card window', () => {
        jest.spyOn(jest.requireMock('@/components/auth/SimpleAuthProvider'), 'useAuth').mockReturnValue({ canFundWallet: () => false, fundWallet });
        render(<PaymentActionPanel {...props()} />);
        expect(provider(/Continue with Card/)).toBeNull();
        expect(provider(/Continue with Kraken/)).toBeEnabled();
        jest.restoreAllMocks();
        open = jest.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);
      });
    });

    describe('Coinbase', () => {
      it('is sent the exact amount to the contract address, and coming back lands on "I have paid"', async () => {
        render(<PaymentActionPanel {...props()} />);
        fireEvent.click(provider(/Continue with Coinbase/)!);
        await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
        const options = mockOpenCoinbase.mock.calls[0][0];
        expect(options).toMatchObject({ destinationAddress: CONTRACT, purpose: 'pay-by-card', asset: 'USDC', presetCryptoAmount: 32.4 });
        expect(screen.queryByText('the contract address panel')).toBeNull();

        act(() => options.onPopupClosed());
        expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
        expect(nextStep(/Continue with Coinbase/)).not.toBeNull();
        expect(onPayFromExternalWallet).toHaveBeenCalled();
      });

      /*
       * Into the contract address Coinbase completes for United States accounts only; into a
       * wallet it serves most countries. A visitor known to be elsewhere gets the route that works.
       */
      it('goes into the wallet instead for a visitor known to be outside the United States', async () => {
        (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'United Kingdom', overrule: jest.fn() });
        render(<PaymentActionPanel {...props({ balanceFloat: 10 })} />);
        expect(says(/Continue with Coinbase/)).toBe('CoinbaseCard or bank transfer. Needs a Coinbase account.Continue');
        fireEvent.click(provider(/Continue with Coinbase/)!);
        await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
        expect(mockOpenCoinbase.mock.calls[0][0]).toMatchObject({ destinationAddress: WALLET, asset: 'USDC', presetCryptoAmount: 22.4 });
        expect(nextStep(/Continue with Coinbase/)!).toHaveTextContent('press Pay');
      });

      it('is set aside, with the reason and a way to overrule it, in a country Coinbase does not serve', () => {
        const overrule = jest.fn();
        (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'Venezuela', overrule });
        render(<PaymentActionPanel {...props()} />);
        expect(provider(/Continue with Coinbase/)).toBeNull();
        expect(screen.getByText(/Coinbase: Coinbase can't take card or bank payments in Venezuela\./)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Not in Venezuela?' }));
        expect(overrule).toHaveBeenCalled();
      });

      it("goes into the wallet below its minimum: the contract address takes the exact amount, the wallet takes more", async () => {
        (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 7, currency: 'USD', inTokens: 7 });
        render(<PaymentActionPanel {...props({ amountLabel: '5 USDC', amountInTokens: 5 })} />);
        expect(row(/Continue with Coinbase/)).toHaveTextContent('Needs a Coinbase account. Its minimum is 7 USD, so you buy a little extra.');
        fireEvent.click(provider(/Continue with Coinbase/)!);
        await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
        expect(mockOpenCoinbase.mock.calls[0][0]).toMatchObject({ destinationAddress: WALLET, presetCryptoAmount: 7 });
      });
    });

    describe('Kraken', () => {
      it('is sent the exact amount to the contract address, then the address and "I have paid" are shown', async () => {
        render(<PaymentActionPanel {...props()} />);
        fireEvent.click(provider(/Continue with Kraken/)!);
        // Opened during the click, before the address is known, so the browser does not block it.
        expect(open).toHaveBeenCalledWith('', '_blank');
        await waitFor(() => expect(tab.location.href).toContain('https://ramp.kraken.com/entry?'));
        const url = new URL(tab.location.href);
        expect(url.searchParams.get('wallet_address')).toBe(CONTRACT);
        expect(url.searchParams.get('amount')).toBe('32.4');
        expect(tab.opener).toBeNull();
        expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
        expect(nextStep(/Continue with Kraken/)).not.toBeNull();
      });

      it('says it will ask for the address, which is copied', () => {
        render(<PaymentActionPanel {...props()} />);
        expect(row(/Continue with Kraken/)).toHaveTextContent(PASTE);
      });

      it('goes into the wallet below its minimum, buying the minimum, with the wallet copied to paste', () => {
        render(<PaymentActionPanel {...props({ amountLabel: '5 USDC', amountInTokens: 5 })} />);
        expect(row(/Continue with Kraken/)).toHaveTextContent(`Its minimum is 11 USD, so you buy a little extra. ${PASTE}`);
        open.mockImplementation(() => null);
        fireEvent.click(provider(/Continue with Kraken/)!);
        const url = new URL(open.mock.calls[0][0]);
        expect(url.searchParams.get('wallet_address')).toBe(WALLET);
        expect(url.searchParams.get('amount')).toBe('11');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(WALLET);
        expect(nextStep(/Continue with Kraken/)!).toHaveTextContent('press Pay');
      });

      it('closes the tab and says so when the contract address cannot be prepared', async () => {
        render(<PaymentActionPanel {...props({ resolveEscrowAddress: async () => null })} />);
        fireEvent.click(provider(/Continue with Kraken/)!);
        await waitFor(() => expect(tab.close).toHaveBeenCalled());
        expect(onPayFromExternalWallet).not.toHaveBeenCalled();
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(nextStep(/Continue with Kraken/)).toBeNull();
      });
    });

    describe('Link', () => {
      it('takes no address, so the contract address is copied for the buyer to paste there', async () => {
        render(<PaymentActionPanel {...props()} />);
        fireEvent.click(provider(/Continue with Link by Stripe/)!);
        await waitFor(() => expect(tab.location.href).toContain('https://crypto.link.com/?'));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CONTRACT);
        expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
      });

      /*
       * Seen 2026-11-23 in Chrome: once the provider's tab is in front, a clipboard write from this
       * page neither succeeds nor fails. The handler awaited it, so the tab was never pointed at
       * Link and the buyer was left on a blank one, with no error.
       */
      it('still opens when the clipboard never answers', async () => {
        Object.assign(navigator, { clipboard: { writeText: jest.fn(() => new Promise(() => undefined)) } });
        render(<PaymentActionPanel {...props()} />);
        fireEvent.click(provider(/Continue with Link by Stripe/)!);
        await waitFor(() => expect(tab.location.href).toContain('https://crypto.link.com/?'));
        expect(await screen.findByText('the contract address panel')).toBeInTheDocument();
      });

      it('is still offered, with its warning, to a visitor outside the United States', () => {
        (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'United Kingdom', overrule: jest.fn() });
        render(<PaymentActionPanel {...props()} />);
        expect(provider(/Continue with Link by Stripe/)).toBeEnabled();
        expect(row(/Continue with Link by Stripe/)).toHaveTextContent('Sells in the United States only.');
      });
    });

    it('still opens Link and Kraken when there is no clipboard at all', async () => {
      Object.assign(navigator, { clipboard: undefined });
      render(<PaymentActionPanel {...props()} />);
      fireEvent.click(provider(/Continue with Link by Stripe/)!);
      await waitFor(() => expect(tab.location.href).toContain('https://crypto.link.com/?'));
      fireEvent.click(provider(/Continue with Kraken/)!);
      await waitFor(() => expect(tab.location.href).toContain('https://ramp.kraken.com/entry?'));
    });

    // A page that is not in front cannot write to the clipboard, and the new tab is in front at once.
    it.each([/Continue with Link by Stripe/, /Continue with Kraken/])(
      'copies an address it already knows before %s opens its tab',
      async (name) => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        render(<PaymentActionPanel {...props({ escrowAddress: CONTRACT })} />);
        fireEvent.click(provider(name)!);
        expect(writeText).toHaveBeenCalledWith(CONTRACT);
        expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0]);
        await waitFor(() => expect(tab.location.href).toMatch(/^https:/));
        expect(writeText).toHaveBeenCalledTimes(1);
      }
    );

    it('sets Kraken and Link aside, with the reason, on a network they do not deliver to', () => {
      render(<PaymentActionPanel {...props({ chainId: 1, networkName: 'Ethereum' })} />);
      expect(provider(/Continue with Kraken/)).toBeNull();
      expect(provider(/Continue with Link by Stripe/)).toBeNull();
      expect(screen.getByText(/Kraken: Kraken can't deliver USDC on Ethereum yet\./)).toBeInTheDocument();
      expect(screen.getByText(/Link by Stripe: Link can't deliver USDC on Ethereum yet\./)).toBeInTheDocument();
    });

    it('delivers everything into the wallet where the payment has no address to send to', () => {
      render(<PaymentActionPanel {...props({ resolveEscrowAddress: undefined })} />);
      open.mockImplementation(() => null);
      fireEvent.click(provider(/Continue with Kraken/)!);
      expect(new URL(open.mock.calls[0][0]).searchParams.get('wallet_address')).toBe(WALLET);
      expect(nextStep(/Continue with Kraken/)!).toHaveTextContent('press Pay');
      fireEvent.click(provider(/Continue with Link by Stripe/)!);
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(WALLET);
    });

    /*
     * In the same box as the companies above it read as a fifth one, and it held eighty links,
     * most of them exchanges, for a buyer who had just said they hold no crypto.
     */
    describe('for someone none of them serve', () => {
      const more = () => screen.getByText('None of these work for you? More card services').closest('details') as HTMLDetailsElement;

      it('is a quiet link under the companies, closed, not another company in a box', () => {
        render(<PaymentActionPanel {...props()} />);
        expect(more().open).toBe(false);
        expect(more().closest('li')).toBeNull();
        expect(screen.queryByText('More places to buy USDC')).toBeNull();
      });

      it('holds the card services and nothing else: no exchanges, and no steps about withdrawing', () => {
        render(<PaymentActionPanel {...props()} />);
        const names = within(more()).getAllByRole('link').map((link) => link.textContent);
        expect(names).toHaveLength(7);
        expect(names.join(' ')).toMatch(/MoonPay.*Transak.*Ramp Network.*Banxa.*Mercuryo.*Guardarian.*Onramp\.money/);
        expect(within(more()).queryByText(/Withdraw or send it/)).toBeNull();
        expect(within(more()).queryByRole('button', { name: 'Show all countries' })).toBeNull();
      });

      it('says first where they deliver, gives the wallet to hand them, and the way back', () => {
        render(<PaymentActionPanel {...props({ balanceFloat: 10 })} />);
        expect(within(more()).getByText('These send USDC to your wallet here; then you press Pay.')).toBeInTheDocument();
        expect((within(more()).getByLabelText('Your wallet address') as HTMLInputElement).value).toBe(WALLET);
        expect(within(more()).getByText('Send only USDC on Base. Funds sent on another network may be lost.')).toBeInTheDocument();
        const moonPay = new URL(within(more()).getByRole('link', { name: /MoonPay/ }).getAttribute('href')!);
        expect(moonPay.searchParams.get('walletAddress')).toBe(WALLET);
        expect(moonPay.searchParams.get('quoteCurrencyAmount')).toBe('22.4');
        expect(within(more()).getByRole('button', { name: "I've added it: check my balance" })).toBeEnabled();
      });
    });
  });

  describe('b. crypto I already have', () => {
    it('shows the contract address panel, stresses the network, and starts the address', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(onPayFromExternalWallet).not.toHaveBeenCalled();
      choose(CRYPTO);
      expect(screen.getByText('the contract address panel')).toBeInTheDocument();
      expect(screen.getAllByText('Send only USDC on Base. Funds sent on another network may be lost.').length).toBeGreaterThan(0);
      expect(onPayFromExternalWallet).toHaveBeenCalledTimes(1);
    });

    it('offers, more quietly, this wallet to top up and pay from: address, a code to scan, the network', () => {
      render(<PaymentActionPanel {...props()} />);
      choose(CRYPTO);
      const topUp = screen.getByText('Or add USDC to your wallet here, then pay from it').closest('details') as HTMLDetailsElement;
      expect(topUp.open).toBe(false);
      expect(within(topUp).getByText('Your wallet, on Base')).toBeInTheDocument();
      expect((within(topUp).getByLabelText('Your wallet address') as HTMLInputElement).value).toBe(WALLET);
      expect(topUp.querySelector('svg[height="160"]')).not.toBeNull();
      expect(
        within(topUp).getByText('When it arrives, come back to this page and press Pay. Your wallet will ask you to approve the transfer.')
      ).toBeInTheDocument();
    });

    it('opens on the wallet where the payment has no address to send to', () => {
      render(<PaymentActionPanel {...props({ elsewherePanel: undefined })} />);
      choose(CRYPTO);
      expect(screen.queryByText('the contract address panel')).toBeNull();
      const topUp = screen.getByText('Or add USDC to your wallet here, then pay from it').closest('details') as HTMLDetailsElement;
      expect(topUp.open).toBe(true);
      expect(onPayFromExternalWallet).not.toHaveBeenCalled();
    });

    it('reads the balance again when asked, and when the buyer comes back to the tab, but not over and over', () => {
      render(<PaymentActionPanel {...props()} />);
      choose(CRYPTO);
      fireEvent.click(screen.getByRole('button', { name: "I've added it: check my balance" }));
      expect(onRefreshBalance).toHaveBeenCalledTimes(1);
      fireEvent.focus(window);
      fireEvent.focus(window);
      expect(onRefreshBalance).toHaveBeenCalledTimes(2);
    });
  });

  /*
   * An exchange is a place to buy. For a day it sat under "Crypto I already have", so a buyer with
   * no crypto had to pick the answer saying they had some to find where to get it.
   */
  describe('a. an exchange the buyer already uses', () => {
    const LABEL = 'Have an exchange account? Buy USDC there instead';
    const exchanges = () => screen.getByText(LABEL).closest('details') as HTMLDetailsElement;

    it('is under "Card or bank", with the other ways of buying, as a quiet link, closed', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(tile(CARD)).toHaveAttribute('aria-pressed', 'true');
      expect(exchanges().open).toBe(false);
      expect(exchanges().closest('li')).toBeNull();
    });

    it('lists exchanges, not card services, with how to withdraw to this wallet and the way back', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(within(exchanges()).getByRole('link', { name: /^Kraken/ })).toHaveAttribute('href', 'https://www.kraken.com');
      expect(within(exchanges()).queryByRole('link', { name: /MoonPay/ })).toBeNull();
      expect(within(exchanges()).getByText('These send USDC to your wallet here; then you press Pay.')).toBeInTheDocument();
      expect(within(exchanges()).getByText(/Withdraw or send it/)).toBeInTheDocument();
      expect((within(exchanges()).getByLabelText('Your wallet address') as HTMLInputElement).value).toBe(WALLET);
      expect(within(exchanges()).getByRole('button', { name: "I've added it: check my balance" })).toBeEnabled();
    });

    // The country is unknown here, so there is no region of the visitor's own.
    it('shows the worldwide ones first, and the other countries only on asking', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(within(exchanges()).getAllByRole('link')).toHaveLength(17);
      expect(within(exchanges()).queryByRole('link', { name: /^Swyftx/ })).toBeNull();
      fireEvent.click(within(exchanges()).getByRole('button', { name: 'Show all countries' }));
      expect(within(exchanges()).getAllByRole('link')).toHaveLength(72);
      expect(within(exchanges()).getByRole('link', { name: /^Swyftx/ })).toBeInTheDocument();
    });
  });

  // The answer "Crypto I already have" is for someone who has it.
  describe('b. nothing under "Crypto I already have" is a way of buying', () => {
    it('has no exchange list, no card services and no link out to a company that sells', () => {
      render(<PaymentActionPanel {...props()} />);
      choose(CRYPTO);
      expect(screen.queryByText(/exchange account/)).toBeNull();
      expect(screen.queryByText(/card services/i)).toBeNull();
      expect(screen.queryByText(/^Buy /)).toBeNull();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /^Continue with/ })).toBeNull();
    });
  });

  describe("a seller's preview", () => {
    it("shows both answers, with nothing live and nothing of the seller's own wallet", () => {
      render(<PaymentActionPanel {...props({ preview: true, elsewherePanel: <button type="button">I have paid</button> })} />);
      expect(payButton()).toBeNull();
      expect(screen.getByText(/A customer whose wallet cannot pay sees these ways to pay/)).toBeInTheDocument();
      expect(screen.queryByText('Your wallet here:')).toBeNull();

      screen.getAllByRole('button', { name: /^Continue with/ }).forEach((button) => expect(button).toBeDisabled());

      choose(CRYPTO);
      expect(screen.getByRole('button', { name: 'I have paid' })).toBeDisabled();
      expect(onPayFromExternalWallet).not.toHaveBeenCalled();
      expect(screen.queryByDisplayValue(WALLET)).toBeNull();
      expect(screen.queryByText(new RegExp(WALLET))).toBeNull();
      expect(mockOpenCoinbase).not.toHaveBeenCalled();
      expect(fundWallet).not.toHaveBeenCalled();
    });
  });
});
