/**
 * The pay screen is one next step, or two plain choices. What an exchange would refuse is never a
 * greyed-out button on it: behind "Pay by card or bank transfer" a provider that cannot serve is a
 * line saying why, and topping the wallet up sits behind "Pay with crypto".
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability', () => ({
  useLinkAvailability: () => ({ unavailable: false, countryName: null, overrule: jest.fn() }),
}));
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
const mockOpenCoinbase = jest.fn();
jest.mock('@/lib/coinbaseOnramp', () => ({ openCoinbaseOnramp: (options: unknown) => mockOpenCoinbase(options) }));
const mockModal = jest.fn();
jest.mock('@/components/contracts/AddFundsModal', () => (modalProps: any) => {
  mockModal(modalProps);
  return null;
});
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p' } }),
}));

const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '1.50 USDC',
  amountInTokens: 1.5,
  balanceFloat: 0,
  tokenSymbol: 'USDC',
  tokenAddress: '0xtoken',
  tokenDecimals: 6,
  chainId: 8453,
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  networkName: 'Base',
  isLoadingBalance: false,
  hasInsufficientBalance: true,
  isSameAddress: false,
  isPaymentInProgress: false,
  onPay: jest.fn(),
  onPayFromExternalWallet: jest.fn(),
  resolveEscrowAddress: async () => '0xescrow',
  elsewherePanel: <div>the payment address panel</div>,
  ...overrides,
});
const available = { unavailable: false, countryName: null, overrule: jest.fn() };
/** What can be pressed or read as a button on the screen itself, top to bottom. */
const onScreen = () =>
  screen
    .getAllByRole('button')
    .filter((button) => !/copy/i.test(button.getAttribute('aria-label') ?? ''))
    .map((button) => ({ says: button.textContent, live: !(button as HTMLButtonElement).disabled }));
const openCard = () => fireEvent.click(screen.getByRole('button', { name: /Pay by card or bank transfer/ }));
const openCrypto = () => fireEvent.click(screen.getByRole('button', { name: /Pay with crypto/ }));
const lastModal = () => mockModal.mock.calls[mockModal.mock.calls.length - 1][0];

beforeEach(() => {
  mockModal.mockClear();
  (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 2, currency: 'USD', inTokens: 2 });
  (useCoinbaseAvailability as jest.Mock).mockReturnValue(available);
});

describe('the pay screen, for a USDC payment', () => {
  it('with an empty wallet is two plain choices, both live, and no greyed-out pay button', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    expect(onScreen()).toEqual([
      { says: 'Pay by card or bank transferNo crypto needed', live: true },
      { says: 'Pay with cryptoFrom this wallet or one you already have', live: true },
    ]);
  });

  it('with a wallet that can pay is one prominent button, and the two choices beneath it', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32, balanceFloat: 50, hasInsufficientBalance: false })} />);
    expect(onScreen()).toEqual([
      { says: 'Pay 32 USDC from this wallet', live: true },
      { says: 'Pay by card or bank transferNo crypto needed', live: true },
      { says: 'Pay with cryptoFrom this wallet or one you already have', live: true },
    ]);
  });

  it('names no provider, gives no reason and shows no address until one of them is pressed', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(screen.queryByText(/Coinbase|Kraken|Link/)).toBeNull();
    expect(screen.queryByText(/minimum/)).toBeNull();
    expect(screen.queryByText('the payment address panel')).toBeNull();
    expect(screen.queryByText(/Add funds/)).toBeNull();
  });

  it('keeps the pay button, off, while the balance is still being read', () => {
    render(<PaymentActionPanel {...props({ isLoadingBalance: true })} />);
    expect(screen.getByRole('button', { name: /from this wallet/ })).toBeDisabled();
  });

  /**
   * A seller opening their own request sees what a customer with no money in their wallet gets,
   * and can open it. A preview where nothing responded left them wondering whether the real thing
   * works; one they can look through answers "will my customer manage to pay this?".
   */
  describe('as a seller\'s preview', () => {
    const preview = (overrides: Record<string, unknown> = {}) =>
      props({ amountLabel: '32 USDC', amountInTokens: 32, preview: true, ...overrides });

    it('shows the two choices, live to open, and no pay button', () => {
      render(<PaymentActionPanel {...preview()} />);
      expect(onScreen()).toEqual([
        { says: 'Pay by card or bank transferNo crypto needed', live: true },
        { says: 'Pay with cryptoFrom this wallet or one you already have', live: true },
      ]);
    });

    it("says the wallet shown will be the customer's, and does not show the seller's own", () => {
      render(<PaymentActionPanel {...preview({ balanceFloat: 987.65 })} />);
      expect(screen.getByText('Your customer signs in and sees their own wallet here.')).toBeInTheDocument();
      expect(screen.queryByText(/987\.65/)).toBeNull();
      expect(screen.queryByText(/0x1234/)).toBeNull();
    });

    it('opens the card providers to look at, with none that can be continued with', () => {
      render(<PaymentActionPanel {...preview()} />);
      openCard();
      const providers = screen.getAllByRole('button', { name: /^Continue with/ });
      expect(providers.length).toBeGreaterThan(0);
      providers.forEach((provider) => expect(provider).toBeDisabled());
      expect(screen.getByText(/Your customer chooses one of these and pays on their site/)).toBeInTheDocument();
      // The list is for where the seller is, which is not where their customer is.
      expect(screen.getByText(/Which providers appear depends on where your customer is/)).toBeInTheDocument();
    });

    it('never opens a provider, whatever is pressed', () => {
      mockOpenCoinbase.mockClear();
      render(<PaymentActionPanel {...preview()} />);
      openCard();
      screen.getAllByRole('button', { name: /^Continue with/ }).forEach((provider) => fireEvent.click(provider));
      expect(mockOpenCoinbase).not.toHaveBeenCalled();
    });

    it('opens the address view to look at, with everything in it off, and offers no top-up', () => {
      const onPayFromExternalWallet = jest.fn();
      render(
        <PaymentActionPanel
          {...preview({ onPayFromExternalWallet, elsewherePanel: <button type="button">I have paid</button> })}
        />
      );
      openCrypto();
      expect(screen.queryByRole('button', { name: /In this wallet/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /In another wallet or an exchange/ }));
      expect(screen.getByRole('button', { name: 'I have paid' })).toBeDisabled();
      // Looking is not choosing: nothing is started or recorded.
      expect(onPayFromExternalWallet).not.toHaveBeenCalled();
      expect(mockModal.mock.calls.every(([modalProps]) => !modalProps.isOpen)).toBe(true);
    });

    it('for a token no card can buy, shows how the customer will get it: by buying the one that converts', () => {
      render(<PaymentActionPanel {...preview({ amountLabel: '32 USDT', tokenSymbol: 'USDT' })} />);
      expect(onScreen()).toEqual([
        { says: 'Buy USDC and pay with itBy card or exchange, converted to USDT as they pay', live: false },
        { says: 'Buy USDTNot sold on this network yet', live: false },
        { says: 'Send USDT from another walletFor USDT you already hold elsewhere', live: true },
      ]);
    });
  });
});

describe('behind "Pay by card or bank transfer"', () => {
  it("below Coinbase's minimum, Coinbase is not a button and the reason is given", () => {
    render(<PaymentActionPanel {...props()} />);
    openCard();
    expect(screen.queryByRole('button', { name: /Continue with Coinbase/ })).toBeNull();
    expect(screen.getByText('Coinbase: this amount is below its minimum of 2 USD.')).toBeInTheDocument();
  });

  it('at or above the minimum, Coinbase leads and says what it takes and from how much', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    openCard();
    expect(screen.getByRole('button', { name: /Continue with Coinbase.*Card or bank transfer, from 2 USD/ })).toBeEnabled();
    expect(screen.queryByText(/Coinbase: this amount is below/)).toBeNull();
  });

  it('blocks nothing when the minimum is unknown', () => {
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    render(<PaymentActionPanel {...props()} />);
    openCard();
    expect(screen.getByRole('button', { name: /Continue with Coinbase.*Card or bank transfer$/ })).toBeEnabled();
  });

  describe('where Coinbase cannot take money', () => {
    const overrule = jest.fn();
    beforeEach(() => {
      (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'Venezuela', overrule });
    });

    it('Coinbase is not a button; the reason is given, and the buyer can overrule the country', () => {
      render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
      openCard();
      expect(screen.queryByRole('button', { name: /Continue with Coinbase/ })).toBeNull();
      expect(screen.getByText(/Coinbase can't take card or bank payments in Venezuela/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Not in Venezuela?' }));
      expect(overrule).toHaveBeenCalled();
    });

    it("says that, not Coinbase's minimum, which means nothing to a buyer it cannot serve", () => {
      render(<PaymentActionPanel {...props()} />);
      openCard();
      expect(screen.queryByText(/Coinbase: this amount is below/)).toBeNull();
    });

    it('still offers whoever else can serve', () => {
      render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
      openCard();
      expect(screen.getByRole('button', { name: /Continue with Kraken/ })).toBeEnabled();
    });
  });

  it('choosing Coinbase sends the whole amount straight to the payment, and coming back lands on "I have paid"', async () => {
    mockOpenCoinbase.mockResolvedValue(undefined);
    const onPayFromExternalWallet = jest.fn();
    render(<PaymentActionPanel {...props({ amountLabel: '32.391 USDC', amountInTokens: 32.391, onPayFromExternalWallet })} />);
    openCard();
    fireEvent.click(screen.getByRole('button', { name: /Continue with Coinbase/ }));

    await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
    const options = mockOpenCoinbase.mock.calls[0][0];
    expect(options).toMatchObject({ destinationAddress: '0xescrow', purpose: 'pay-by-card', asset: 'USDC', presetCryptoAmount: 32.4 });
    // Nothing of the address panel yet: the buyer is at Coinbase.
    expect(screen.queryByText('the payment address panel')).toBeNull();

    // Coinbase's window closes: the money may have landed, and pressing "I have paid" secures it.
    act(() => options.onPopupClosed());
    expect(await screen.findByText('the payment address panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue with Coinbase/ })).toBeNull();
    expect(onPayFromExternalWallet).toHaveBeenCalled();
  });

  it('when nobody can serve, says so and offers the other way to pay', () => {
    (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'Venezuela', overrule: jest.fn() });
    render(<PaymentActionPanel {...props({ chainId: 1, networkName: 'Ethereum' })} />);
    openCard();
    expect(screen.getByText('No card provider can take this payment here.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pay with crypto instead' }));
    expect(screen.getByText('Where is your USDC?')).toBeInTheDocument();
  });
});

describe('behind "Pay with crypto"', () => {
  it('asks one question, and offers the three answers', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '10 USDC', amountInTokens: 10, balanceFloat: 4 })} />);
    openCrypto();
    expect(screen.getByText('Where is your USDC?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /In this wallet, but not enough.*You hold 4\.00 USDC\. Add 6\.00 more, then pay from it\./ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /In another wallet or an exchange/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /I don't have any.*Pay by card or bank transfer instead/ })).toBeEnabled();
  });

  it('"in this wallet" tops it up by what is missing', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '10 USDC', amountInTokens: 10, balanceFloat: 4 })} />);
    openCrypto();
    fireEvent.click(screen.getByRole('button', { name: /In this wallet, but not enough/ }));
    expect(lastModal()).toMatchObject({ isOpen: true, tokenSymbol: 'USDC', shortfall: 6 });
  });

  it("names the exchange's minimum when what is missing is less than it", () => {
    render(<PaymentActionPanel {...props()} />);
    openCrypto();
    expect(screen.getByRole('button', { name: /exchange's minimum 2 USD/ })).toBeEnabled();
  });

  it('"in another wallet" shows the payment address, its QR and "I have paid"', () => {
    render(<PaymentActionPanel {...props()} />);
    openCrypto();
    fireEvent.click(screen.getByRole('button', { name: /In another wallet or an exchange/ }));
    expect(screen.getByText('the payment address panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Where is your USDC?')).toBeInTheDocument();
  });

  it('"I don\'t have any" goes to paying by card', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    openCrypto();
    fireEvent.click(screen.getByRole('button', { name: /I don't have any/ }));
    expect(screen.getByRole('button', { name: /Continue with Coinbase/ })).toBeInTheDocument();
  });

  it('offers no top-up to a wallet that already holds enough', () => {
    render(<PaymentActionPanel {...props({ balanceFloat: 5, hasInsufficientBalance: false })} />);
    openCrypto();
    expect(screen.queryByRole('button', { name: /In this wallet/ })).toBeNull();
  });

  it('is not offered where there is no address to pay from elsewhere; topping up stays on the screen', () => {
    render(<PaymentActionPanel {...props({ elsewherePanel: undefined, resolveEscrowAddress: undefined })} />);
    expect(screen.queryByRole('button', { name: /Pay with crypto/ })).toBeNull();
    expect(screen.getByRole('button', { name: "Add funds to this wallet (exchange's minimum transfer = 2 USD)" })).toBeEnabled();
  });
});

describe('a token no card can buy (USDT on Base), with nothing to convert from', () => {
  const SAYS = "Some external suppliers can't support USDT yet. If your option is greyed out, use USDT you already hold or use USDC instead";
  const usdt = (overrides: Record<string, unknown> = {}) =>
    props({ amountLabel: '32 USDT', amountInTokens: 32, tokenSymbol: 'USDT', ...overrides });

  it('has no card route, and the way in for USDT held elsewhere is named for who it is for', () => {
    render(<PaymentActionPanel {...usdt()} />);
    expect(screen.queryByRole('button', { name: /Pay by card/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Send USDT from another wallet.*For USDT you already hold elsewhere/ }));
    // Straight to the address: there is nothing to ask someone who already holds it.
    expect(screen.getByText('the payment address panel')).toBeInTheDocument();
    expect(screen.queryByText(/Where is your/)).toBeNull();
  });

  it('pays the ordinary way when the wallet holds enough', () => {
    render(<PaymentActionPanel {...usdt({ balanceFloat: 50, hasInsufficientBalance: false })} />);
    expect(screen.getByRole('button', { name: 'Pay 32 USDT from this wallet' })).toBeEnabled();
    expect(screen.queryByText(SAYS)).toBeNull();
  });

  it('stays quiet in a seller preview', () => {
    render(<PaymentActionPanel {...usdt({ preview: true })} />);
    expect(screen.queryByText(/can't support USDT yet/)).toBeNull();
  });
});
