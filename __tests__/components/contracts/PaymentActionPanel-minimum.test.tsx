/**
 * What an exchange would refuse is never a dead end on the pay screen. The contract address takes
 * the exact amount, so a company below its minimum delivers into the wallet instead, where it
 * buys the minimum and the rest stays; the buyer then presses Pay.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability', () => ({
  useLinkAvailability: () => ({ unavailable: false, countryName: null, overrule: jest.fn() }),
}));
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
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => false, fundWallet: jest.fn() }),
}));

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '1.50 USDC',
  amountInTokens: 1.5,
  balanceFloat: 0,
  tokenSymbol: 'USDC',
  tokenAddress: '0xtoken',
  tokenDecimals: 6,
  chainId: 8453,
  walletAddress: WALLET,
  networkName: 'Base',
  isLoadingBalance: false,
  hasInsufficientBalance: true,
  isSameAddress: false,
  isPaymentInProgress: false,
  onPay: jest.fn(),
  onPayFromExternalWallet: jest.fn(),
  addFundsReturnPath: '/pay?resume=1',
  resolveEscrowAddress: async () => '0xcontract',
  elsewherePanel: <div>the contract address panel</div>,
  ...overrides,
});
const available = { unavailable: false, countryName: null, overrule: jest.fn() };
const provider = (name: RegExp) => screen.queryByRole('button', { name });
const row = (name: RegExp) => provider(name)!.closest('li') as HTMLElement;
/** What the chosen company's row says to do next, or null while it has not been chosen. */
const nextStep = (name: RegExp) =>
  within(row(name)).queryByText('When you have paid there:')?.parentElement ?? null;
const COINBASE = /Continue with Coinbase/;

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenCoinbase.mockResolvedValue(undefined);
  (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 2, currency: 'USD', inTokens: 2 });
  (useCoinbaseAvailability as jest.Mock).mockReturnValue(available);
});

describe("below the exchange's minimum", () => {
  it('says the minimum, and that it is paid from the wallet afterwards', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(row(COINBASE)).toHaveTextContent('Its minimum is 2 USD, so you buy a little extra.');
    fireEvent.click(provider(COINBASE)!);
    expect(nextStep(/Continue with Coinbase/)!).toHaveTextContent(
      'When it arrives, come back to this page and press Pay.'
    );
  });

  it('buys the minimum into the wallet, and comes back to this payment', async () => {
    render(<PaymentActionPanel {...props()} />);
    fireEvent.click(provider(COINBASE)!);
    await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
    expect(mockOpenCoinbase.mock.calls[0][0]).toMatchObject({
      destinationAddress: WALLET,
      purpose: 'add-funds',
      asset: 'USDC',
      presetCryptoAmount: 2,
      returnPath: '/pay?resume=1',
    });
  });

  it('pays the whole amount straight to the payment when that is more than the minimum', async () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32.391 USDC', amountInTokens: 32.391, balanceFloat: 4 })} />);
    expect(row(COINBASE)).not.toHaveTextContent(/minimum/);
    fireEvent.click(provider(COINBASE)!);
    await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
    expect(mockOpenCoinbase.mock.calls[0][0]).toMatchObject({ destinationAddress: '0xcontract', presetCryptoAmount: 32.4 });
  });

  it('blocks nothing when the minimum is unknown', () => {
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    render(<PaymentActionPanel {...props()} />);
    expect(row(COINBASE)).not.toHaveTextContent(/minimum/);
    expect(provider(COINBASE)).toBeEnabled();
  });
});

describe('where Coinbase cannot take money', () => {
  const overrule = jest.fn();
  beforeEach(() => {
    (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'Venezuela', overrule });
  });

  it('Coinbase is set aside with the reason, and the buyer can overrule the country', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    expect(provider(COINBASE)).toBeNull();
    expect(screen.getByText(/Coinbase can't take card or bank payments in Venezuela/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not in Venezuela?' }));
    expect(overrule).toHaveBeenCalled();
  });

  it("says that, not Coinbase's minimum, which means nothing to a buyer it cannot serve", () => {
    render(<PaymentActionPanel {...props()} />);
    expect(screen.queryByText(/Its minimum is 2 USD/)).toBeNull();
    expect(screen.queryByText(/below its minimum of 2 USD/)).toBeNull();
  });

  it('still offers whoever else can serve', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    expect(provider(/Continue with Kraken/)).toBeEnabled();
  });
});

describe("as a seller's preview", () => {
  const preview = (overrides: Record<string, unknown> = {}) =>
    props({ amountLabel: '32 USDC', amountInTokens: 32, preview: true, ...overrides });

  it("says the wallet shown will be the customer's, and does not show the seller's own", () => {
    render(<PaymentActionPanel {...preview({ balanceFloat: 987.65 })} />);
    expect(screen.getByText('Your customer signs in and sees their own wallet here.')).toBeInTheDocument();
    expect(screen.queryByText(/987\.65/)).toBeNull();
    expect(screen.queryByText(/0x1234/)).toBeNull();
  });

  it('for a token no card can buy, shows how the customer will get it: by buying the one that converts', () => {
    render(<PaymentActionPanel {...preview({ amountLabel: '32 USDT', tokenSymbol: 'USDT' })} />);
    // Said once above the companies, and at the head of the two lists under them.
    expect(
      screen.getAllByText('Buys USDC into your wallet here, then one button converts it and pays in USDT.')
    ).toHaveLength(3);
    expect(row(/Continue with Kraken/)).not.toHaveTextContent(/converts/);
    expect(provider(/Continue with Kraken/)).toBeDisabled();
    expect(screen.getByText('None of these work for you? More card services')).toBeInTheDocument();
    expect(screen.queryByText(/can't support USDT yet/)).toBeNull();
  });
});

describe('a token no card can buy (USDT on Base), with nothing to convert from', () => {
  const usdt = (overrides: Record<string, unknown> = {}) =>
    props({ amountLabel: '32 USDT', amountInTokens: 32, tokenSymbol: 'USDT', ...overrides });

  it('has nothing to buy and says why; USDT held elsewhere can be sent straight to the payment', () => {
    render(<PaymentActionPanel {...usdt()} />);
    expect(screen.queryByRole('button', { name: /Card or bank/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Continue with/ })).toBeNull();
    expect(screen.getByText(/Some external suppliers can't support USDT yet/)).toBeInTheDocument();
    expect(screen.getByText('the contract address panel')).toBeInTheDocument();
    expect(screen.queryByText(/to your wallet here, then pay from it/)).toBeNull();
  });

  it('pays the ordinary way when the wallet holds enough', () => {
    render(<PaymentActionPanel {...usdt({ balanceFloat: 50, hasInsufficientBalance: false })} />);
    expect(screen.getByRole('button', { name: 'Pay 32 USDT from this wallet' })).toBeEnabled();
    expect(screen.queryByText(/can't support USDT yet/)).toBeNull();
  });
});
