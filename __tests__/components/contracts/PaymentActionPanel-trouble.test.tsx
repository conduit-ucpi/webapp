/**
 * What the pay page does when a purchase does not go through, whichever company it was with: the
 * help box (FundingTrouble) over the steps. A cancelled or failed card window also goes back to
 * step 1; a company's own page is asked about when the buyer comes back, or after a reload.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
import { markPurchaseOpened, takePurchaseLeftOpen } from '@/lib/purchaseMarker';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability');
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/reportOnrampStatus', () => ({ reportOnrampStatus: jest.fn() }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));
const mockOpenCoinbase = jest.fn();
jest.mock('@/lib/coinbaseOnramp', () => ({
  ONRAMP_RETURN_MESSAGE: 'coinbase-onramp-return',
  openCoinbaseOnramp: (options: unknown) => mockOpenCoinbase(options),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453 } }),
}));
const mockFundWallet = jest.fn();
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => true, fundWallet: (options: unknown) => mockFundWallet(options) }),
}));

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const CONTRACT = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';
const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '20 USDC',
  amountInTokens: 20,
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
  onPayFromExternalWallet: jest.fn(),
  onRefreshBalance: jest.fn(),
  resolveEscrowAddress: async () => CONTRACT,
  elsewherePanel: <div>the contract address panel</div>,
  ...overrides,
});
const CARD = /Continue with Card, Apple Pay or Google Pay/;
const shown = () => (reportFundingEvent as jest.Mock).mock.calls.filter(([name]) => name === 'trouble-shown').map(([, fields]) => fields.detail);
const openCard = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: CARD }));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockOpenCoinbase.mockResolvedValue(undefined);
  (useOnrampMinimum as jest.Mock).mockReturnValue(null);
  (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
  (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
  jest.spyOn(window, 'open').mockImplementation(() => ({ opener: {}, location: { href: '' }, close: jest.fn() }) as unknown as Window);
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('puts a buyer who closed the card window back on step 1, with the next ways and the question', async () => {
  mockFundWallet.mockResolvedValue({ status: 'cancelled', detail: 'User exited flow' });
  render(<PaymentActionPanel {...props()} />);
  await openCard();
  expect(screen.getByRole('heading', { name: "Didn't manage to buy your USDC?" })).toBeInTheDocument();
  // Step 1 is open again: the companies are there to choose from, the card among them.
  expect(screen.getByRole('button', { name: CARD })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try Coinbase' })).toBeInTheDocument();
  expect(screen.getByText('What stopped you? One tap helps us fix it.')).toBeInTheDocument();
  expect(shown()).toEqual(['cancelled']);
});

it('says so when the card window reports a failure', async () => {
  mockFundWallet.mockRejectedValue(new Error('Your card was declined'));
  render(<PaymentActionPanel {...props()} />);
  await openCard();
  expect(screen.getByRole('heading', { name: "That card purchase didn't go through" })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Your card was declined');
  expect(shown()).toEqual(['failed']);
});

it('opens the next way from the box, and takes the box away', async () => {
  mockFundWallet.mockResolvedValue({ status: 'cancelled' });
  render(<PaymentActionPanel {...props()} />);
  await openCard();
  fireEvent.click(screen.getByRole('button', { name: 'Try Coinbase' }));
  await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
  expect(screen.queryByRole('heading', { name: "Didn't manage to buy your USDC?" })).not.toBeInTheDocument();
});

it('opens the card window again from the box', async () => {
  mockFundWallet.mockResolvedValue({ status: 'cancelled' });
  render(<PaymentActionPanel {...props()} />);
  await openCard();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Open the card window again' }));
  });
  expect(mockFundWallet).toHaveBeenCalledTimes(2);
});

it('says what is happening when a purchase has been processing for five minutes with nothing arrived', async () => {
  jest.useFakeTimers();
  mockFundWallet.mockResolvedValue({ status: 'processing', detail: 'submitted' });
  render(<PaymentActionPanel {...props()} />);
  await openCard();
  expect(screen.queryByRole('heading', { name: 'Still waiting for your purchase' })).not.toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(5 * 60_000);
  });
  expect(screen.getByRole('heading', { name: 'Still waiting for your purchase' })).toBeInTheDocument();
  expect(shown()).toEqual(['stuck']);
});

it('leaves a note when the card window opens, and clears it when the window reports back', async () => {
  let finish: (result: unknown) => void = () => undefined;
  mockFundWallet.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  render(<PaymentActionPanel {...props()} />);
  await openCard();
  expect(window.localStorage.length).toBe(1);
  await act(async () => {
    finish({ status: 'cancelled' });
  });
  expect(takePurchaseLeftOpen(WALLET)).toBeNull();
});

it('asks a buyer whose page was reloaded while the card window was open how it went', async () => {
  jest.useFakeTimers();
  markPurchaseOpened(WALLET, { logged: 'Privy', route: 'wallet' });
  const onRefreshBalance = jest.fn();
  render(<PaymentActionPanel {...props({ onRefreshBalance })} />);
  // A page just loaded gives itself a few tries at looking before it asks.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10_000);
  });
  expect(screen.getByRole('heading', { name: 'Welcome back. Did your card purchase go through?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, I paid' }));
  expect(onRefreshBalance).toHaveBeenCalled();
  expect(screen.getByText(/checking your wallet every 30 seconds/)).toBeInTheDocument();
});

it("shows none of it on a seller's preview", () => {
  markPurchaseOpened(WALLET, { logged: 'Privy', route: 'wallet' });
  render(<PaymentActionPanel {...props({ preview: true })} />);
  expect(screen.queryByRole('heading', { name: 'Welcome back. Did your card purchase go through?' })).not.toBeInTheDocument();
});

describe('the companies that open their own page', () => {
  /** The buyer is away at the company for a minute, then back on this page, and the page has looked. */
  const awayAndBack = async () => {
    act(() => {
      window.dispatchEvent(new Event('blur'));
      jest.advanceTimersByTime(60_000);
      window.dispatchEvent(new Event('focus'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
  };

  // No reader here, as in a browser where the wallet cannot be read: then, and only then, it asks outright.
  it('asks a buyer back from a card service in the list how it went there, when it cannot look', async () => {
    jest.useFakeTimers();
    render(<PaymentActionPanel {...props()} />);
    fireEvent.click(screen.getByRole('link', { name: /MoonPay/ }));
    expect(screen.queryByRole('heading', { name: /Welcome back/ })).not.toBeInTheDocument();
    await awayAndBack();
    expect(screen.getByRole('heading', { name: 'Welcome back. Did your purchase at MoonPay go through?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "No, it didn't work" }));
    expect(screen.getByRole('button', { name: 'Open MoonPay again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Card, Apple Pay or Google Pay' })).toBeInTheDocument();
    expect(shown()).toEqual(['returned']);
  });

  it('asks a buyer back from Coinbase, bought straight into the payment, and points a yes at "I have paid"', async () => {
    jest.useFakeTimers();
    render(<PaymentActionPanel {...props()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue with Coinbase/ }));
    });
    expect(mockOpenCoinbase).toHaveBeenCalled();
    await awayAndBack();
    expect(screen.getByRole('heading', { name: 'Welcome back. Did your purchase at Coinbase go through?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I paid' }));
    expect(screen.getByText(/looking for it at the payment's address/)).toBeInTheDocument();
  });

  it('asks nobody once the balance covers the payment', async () => {
    jest.useFakeTimers();
    const { rerender } = render(<PaymentActionPanel {...props()} />);
    fireEvent.click(screen.getByRole('link', { name: /MoonPay/ }));
    rerender(<PaymentActionPanel {...props({ balanceFloat: 25, hasInsufficientBalance: false })} />);
    await awayAndBack();
    expect(screen.queryByRole('heading', { name: /Welcome back/ })).not.toBeInTheDocument();
  });
});

describe('looking before asking (the pay page can read the wallet and the payment)', () => {
  const buyAtMoonPayAndComeBack = async (readHeld: jest.Mock) => {
    jest.useFakeTimers();
    render(<PaymentActionPanel {...props({ readHeld })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: /MoonPay/ }));
    });
    act(() => {
      window.dispatchEvent(new Event('blur'));
      jest.advanceTimersByTime(60_000);
      window.dispatchEvent(new Event('focus'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
  };

  it('offers no help when the money has arrived', async () => {
    const readHeld = jest.fn().mockResolvedValueOnce(0).mockResolvedValue(20);
    await buyAtMoonPayAndComeBack(readHeld);
    expect(readHeld).toHaveBeenCalledWith('wallet');
    expect(screen.queryByRole('heading', { name: /Welcome back|arrived, but/ })).not.toBeInTheDocument();
    expect(shown()).toEqual([]);
  });

  it('says how much is still needed when it arrived short', async () => {
    await buyAtMoonPayAndComeBack(jest.fn().mockResolvedValueOnce(0).mockResolvedValue(19.2));
    expect(screen.getByRole('heading', { name: 'Your purchase arrived, but it is 0.80 USDC short' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open MoonPay again' })).toBeInTheDocument();
    expect(shown()).toEqual(['short: 19.20 of 20.00']);
  });

  it('says it cannot see it yet and asks how it went when nothing has arrived', async () => {
    await buyAtMoonPayAndComeBack(jest.fn().mockResolvedValue(0));
    expect(screen.getByRole('heading', { name: "We can't see your purchase from MoonPay yet" })).toBeInTheDocument();
    expect(screen.getByText('We checked your wallet: it has 0.00 of the 20.00 USDC this payment needs.')).toBeInTheDocument();
    expect(screen.getByText('How did it go at MoonPay?')).toBeInTheDocument();
    expect(shown()).toEqual(['returned: 0.00 of 20.00']);
  });
});
