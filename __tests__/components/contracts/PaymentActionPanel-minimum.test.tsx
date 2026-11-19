/**
 * What an exchange would refuse is never a dead end on the pay screen. Straight to the payment
 * a provider below its minimum drops out, because the contract address takes the exact amount;
 * topping up the wallet buys the minimum, and the rest stays there.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const topUp = () => screen.getByRole('button', { name: /Add USD[CT] to this wallet, then pay/ });
const openTopUp = () => fireEvent.click(topUp());
const coinbase = () => screen.getByRole('button', { name: /Add from Coinbase/ });

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenCoinbase.mockResolvedValue(undefined);
  (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 2, currency: 'USD', inTokens: 2 });
  (useCoinbaseAvailability as jest.Mock).mockReturnValue(available);
});

describe("below the exchange's minimum", () => {
  it('topping up says the minimum, and that it is paid from the wallet afterwards', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(topUp()).toHaveTextContent("Add more to this wallet (exchange's minimum 2 USD), then pay from it.");
  });

  it('buys the minimum into the wallet, and comes back to this payment', async () => {
    render(<PaymentActionPanel {...props()} />);
    openTopUp();
    fireEvent.click(coinbase());
    await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
    expect(mockOpenCoinbase.mock.calls[0][0]).toMatchObject({
      destinationAddress: WALLET,
      purpose: 'add-funds',
      asset: 'USDC',
      presetCryptoAmount: 2,
      returnPath: '/pay?resume=1',
    });
  });

  it('buys what is short when that is more than the minimum', async () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32.391 USDC', amountInTokens: 32.391, balanceFloat: 4 })} />);
    expect(topUp()).toHaveTextContent('You hold 4.00 USDC. Add 28.40 more, then pay from it.');
    openTopUp();
    fireEvent.click(coinbase());
    await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
    expect(mockOpenCoinbase.mock.calls[0][0]).toMatchObject({ presetCryptoAmount: 28.4 });
  });

  it('blocks nothing when the minimum is unknown', () => {
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    render(<PaymentActionPanel {...props()} />);
    expect(topUp()).not.toHaveTextContent(/exchange's minimum/);
    openTopUp();
    expect(coinbase()).toBeEnabled();
  });
});

describe('topping up where Coinbase cannot take money', () => {
  const overrule = jest.fn();
  beforeEach(() => {
    (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'Venezuela', overrule });
  });

  it('Coinbase is greyed out with the reason, and the buyer can overrule the country', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    openTopUp();
    expect(coinbase()).toBeDisabled();
    expect(screen.getByText(/Coinbase can't take card or bank payments in Venezuela/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not in Venezuela?' }));
    expect(overrule).toHaveBeenCalled();
  });

  it("says that, not Coinbase's minimum, which means nothing to a buyer it cannot serve", () => {
    render(<PaymentActionPanel {...props()} />);
    expect(topUp()).not.toHaveTextContent(/exchange's minimum/);
  });

  it('still offers whoever else can serve', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    openTopUp();
    expect(screen.getByRole('button', { name: /Add from Kraken/ })).toBeEnabled();
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
    expect(topUp()).toHaveTextContent('Add USDC to this wallet, then pay');
    expect(topUp()).toHaveTextContent('By card or exchange, converted to USDT as they pay');
    expect(screen.queryByRole('button', { name: /Pay by card or bank transfer/ })).toBeNull();
    expect(screen.queryByText(/can't support USDT yet/)).toBeNull();
  });
});

describe('a token no card can buy (USDT on Base), with nothing to convert from', () => {
  const usdt = (overrides: Record<string, unknown> = {}) =>
    props({ amountLabel: '32 USDT', amountInTokens: 32, tokenSymbol: 'USDT', ...overrides });

  it('has nothing to buy and says why; USDT held elsewhere can be sent straight to the payment', () => {
    render(<PaymentActionPanel {...usdt()} />);
    expect(screen.queryByRole('button', { name: /Pay by card or bank transfer/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /to this wallet, then pay/ })).toBeNull();
    expect(screen.getByText(/Some external suppliers can't support USDT yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pay from another wallet/ }));
    expect(screen.getByText('the contract address panel')).toBeInTheDocument();
  });

  it('pays the ordinary way when the wallet holds enough', () => {
    render(<PaymentActionPanel {...usdt({ balanceFloat: 50, hasInsufficientBalance: false })} />);
    expect(screen.getByRole('button', { name: 'Pay 32 USDT from this wallet' })).toBeEnabled();
    expect(screen.queryByText(/can't support USDT yet/)).toBeNull();
  });
});
