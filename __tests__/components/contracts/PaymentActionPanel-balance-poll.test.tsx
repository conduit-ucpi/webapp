/**
 * Once a purchase into the wallet is under way (Privy says "processing", or any other way of buying
 * into the wallet is opened), the page reads the balance every 30 seconds by itself until the
 * balance covers the payment or half an hour has gone, and logs each read and what it found
 * (balance-polled), with the provider it is waiting on.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { reportFundingEvent } from '@/lib/reportFundingEvent';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability');
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/reportOnrampStatus', () => ({ reportOnrampStatus: jest.fn() }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));
jest.mock('@/lib/coinbaseOnramp', () => ({ ONRAMP_RETURN_MESSAGE: 'coinbase-onramp-return', openCoinbaseOnramp: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453 } }),
}));
const mockFundWallet = jest.fn();
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => true, fundWallet: (options: unknown) => mockFundWallet(options) }),
}));

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
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
  onRefreshBalance,
  ...overrides,
});
const onRefreshBalance = jest.fn();
const polledLines = () => (reportFundingEvent as jest.Mock).mock.calls.filter(([name]) => name === 'balance-polled').map(([, fields]) => fields);
const polled = () => polledLines().map((fields) => fields.detail);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (useOnrampMinimum as jest.Mock).mockReturnValue(null);
  (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
  (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const startCard = async (status: string, overrides: Record<string, unknown> = {}) => {
  mockFundWallet.mockResolvedValue({ status, detail: 'submitted' });
  const view = render(<PaymentActionPanel {...props(overrides)} />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Continue with Card, Apple Pay or Google Pay/ }));
  });
  onRefreshBalance.mockClear();
  return view;
};
/** Thirty seconds pass, and the read the page asked for comes back with `balance`. */
const tick = (rerender: (ui: React.ReactElement) => void, balance: number) => {
  act(() => {
    jest.advanceTimersByTime(30_000);
  });
  rerender(<PaymentActionPanel {...props({ balanceFloat: 0, isLoadingBalance: true })} />);
  rerender(<PaymentActionPanel {...props({ balanceFloat: balance, hasInsufficientBalance: balance < 20 })} />);
};

it('reads the balance every 30 seconds once Privy says processing, logging each read, and stops once covered', async () => {
  const { rerender } = await startCard('processing');
  expect(onRefreshBalance).not.toHaveBeenCalled();

  tick(rerender, 0);
  expect(onRefreshBalance).toHaveBeenCalledTimes(1);
  tick(rerender, 22);
  expect(onRefreshBalance).toHaveBeenCalledTimes(2);
  expect(polled()).toEqual(['check 1 of 60: 0.00 USDC, needs 20.00, short', 'check 2 of 60: 22.00 USDC, needs 20.00, covered']);
  expect(polledLines()[0]).toEqual(expect.objectContaining({ wallet: WALLET, amount: '0.00', provider: 'Privy', route: 'wallet' }));

  act(() => {
    jest.advanceTimersByTime(5 * 60_000);
  });
  expect(onRefreshBalance).toHaveBeenCalledTimes(2);
});

it('gives up after half an hour, and says so', async () => {
  const { rerender } = await startCard('processing');
  for (let i = 0; i < 61; i++) tick(rerender, 0);
  expect(onRefreshBalance).toHaveBeenCalledTimes(60);
  expect(polled().at(-1)).toBe('check 60 of 60: 0.00 USDC, needs 20.00, short, giving up');
});

it('waits on any company opened from the lists, named in each line', () => {
  const { rerender } = render(<PaymentActionPanel {...props()} />);
  fireEvent.click(screen.getByRole('link', { name: /MoonPay/ }));
  tick(rerender, 0);
  expect(onRefreshBalance).toHaveBeenCalledTimes(1);
  expect(polledLines()).toEqual([expect.objectContaining({ provider: 'MoonPay', detail: 'check 1 of 60: 0.00 USDC, needs 20.00, short' })]);
});

it("polls nothing on a seller's preview", () => {
  render(<PaymentActionPanel {...props({ preview: true })} />);
  act(() => {
    jest.advanceTimersByTime(5 * 60_000);
  });
  expect(onRefreshBalance).not.toHaveBeenCalled();
});

it('does not poll when Privy reports anything but processing', async () => {
  await startCard('cancelled');
  act(() => {
    jest.advanceTimersByTime(5 * 60_000);
  });
  expect(onRefreshBalance).not.toHaveBeenCalled();
});
