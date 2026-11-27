/**
 * Which ways of paying a buyer tries, and which one got them funded, each as a funding-event line
 * (pages/api/funding-event): the answer they open, each company they open, Coinbase's window
 * closing (and the server asked how the purchase stands), "check my balance", and the balance
 * rising, put down to the last option opened.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
import { reportOnrampStatus } from '@/lib/reportOnrampStatus';

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
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => false, fundWallet: jest.fn() }),
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
const reported = (event: string) => (reportFundingEvent as jest.Mock).mock.calls.filter(([name]) => name === event).map(([, fields]) => fields);

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenCoinbase.mockResolvedValue(undefined);
  (useOnrampMinimum as jest.Mock).mockReturnValue(null);
  (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
  (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
  jest.spyOn(window, 'open').mockImplementation(() => ({ opener: {}, location: { href: '' }, close: jest.fn() }) as unknown as Window);
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});
afterEach(() => jest.restoreAllMocks());

it('logs the answer the buyer opens', () => {
  render(<PaymentActionPanel {...props()} />);
  fireEvent.click(screen.getByRole('button', { name: /Crypto I already have/ }));
  fireEvent.click(screen.getByRole('button', { name: /Card or bank/ }));
  expect(reported('choice-opened')).toEqual([
    { wallet: WALLET, provider: 'crypto' },
    { wallet: WALLET, provider: 'card' },
  ]);
});

it('logs Coinbase opened and closed, and has the server ask Coinbase how it stands', async () => {
  render(<PaymentActionPanel {...props()} />);
  fireEvent.click(screen.getByRole('button', { name: /Continue with Coinbase/ }));
  await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
  await waitFor(() =>
    expect(reported('coinbase-opened')).toEqual([{ wallet: CONTRACT, amount: '20', provider: 'Coinbase', route: 'payment' }])
  );
  act(() => mockOpenCoinbase.mock.calls[0][0].onPopupClosed());
  expect(reported('coinbase-closed')).toEqual([{ wallet: CONTRACT, amount: '20', provider: 'Coinbase', route: 'payment' }]);
  expect(reportOnrampStatus).toHaveBeenCalledWith('closed');
});

it('logs a company opened from the lists by name, card services apart from exchanges', () => {
  render(<PaymentActionPanel {...props()} />);
  fireEvent.click(screen.getByRole('link', { name: /MoonPay/ }));
  fireEvent.click(screen.getByRole('link', { name: /^Kraken/ }));
  expect(reported('card-service-opened')).toEqual([expect.objectContaining({ wallet: WALLET, provider: 'MoonPay', route: 'wallet' })]);
  expect(reported('exchange-opened')).toEqual([expect.objectContaining({ wallet: WALLET, provider: 'Kraken', route: 'wallet' })]);
});

it('logs "check my balance" with what was last opened, and asks Coinbase when that was Coinbase', async () => {
  render(<PaymentActionPanel {...props({ balanceFloat: 5 })} />);
  fireEvent.click(screen.getByRole('button', { name: /Continue with Coinbase/ }));
  await waitFor(() => expect(mockOpenCoinbase).toHaveBeenCalled());
  act(() => mockOpenCoinbase.mock.calls[0][0].onPopupClosed());
  (reportOnrampStatus as jest.Mock).mockClear();
  // Back to step 1, where the button is, under the other card services.
  fireEvent.click(screen.getByRole('button', { name: /Step 1:/ }));
  fireEvent.click(screen.getAllByRole('button', { name: "I've added it: check my balance" })[0]);
  expect(reported('balance-checked')).toEqual([{ wallet: WALLET, amount: '5', provider: 'Coinbase' }]);
  expect(reportOnrampStatus).toHaveBeenCalledWith('balance-checked');
});

it('logs the wallet funded when the balance rises, put down to the last company opened', () => {
  const { rerender } = render(<PaymentActionPanel {...props({ balanceFloat: 2 })} />);
  fireEvent.click(screen.getByRole('link', { name: /MoonPay/ }));
  rerender(<PaymentActionPanel {...props({ balanceFloat: 2, isLoadingBalance: true })} />);
  rerender(<PaymentActionPanel {...props({ balanceFloat: 22, hasInsufficientBalance: false })} />);
  expect(reported('wallet-funded')).toEqual([
    {
      wallet: WALLET,
      amount: '20.00',
      provider: 'MoonPay',
      detail: 'balance 2.00 -> 22.00 USDC, needs 20.00',
    },
  ]);
});

it('does not call the first balance read, or a fall, funded', () => {
  const { rerender } = render(<PaymentActionPanel {...props({ balanceFloat: 30, hasInsufficientBalance: false })} />);
  rerender(<PaymentActionPanel {...props({ balanceFloat: 10 })} />);
  expect(reported('wallet-funded')).toEqual([]);
});

it("logs nothing for a seller's preview", () => {
  render(<PaymentActionPanel {...props({ preview: true })} />);
  fireEvent.click(screen.getByRole('button', { name: /Crypto I already have/ }));
  expect(reportFundingEvent).not.toHaveBeenCalled();
});
