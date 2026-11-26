/**
 * The "add funds" list (/wallet, /buy-token) gives the same help as the pay page when a purchase
 * does not go through: it shares the routes (useWalletFunding) and so the trouble that comes with them.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import FundingOptions from '@/components/funding/FundingOptions';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { reportFundingEvent } from '@/lib/reportFundingEvent';

jest.mock('@/hooks/useLinkAvailability');
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/reportOnrampStatus', () => ({ reportOnrampStatus: jest.fn() }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));
jest.mock('@/lib/coinbaseOnramp', () => ({ ONRAMP_RETURN_MESSAGE: 'coinbase-onramp-return', openCoinbaseOnramp: jest.fn() }));
let mockRpcUrl: string | undefined;
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453, rpcUrl: mockRpcUrl } }),
}));
const mockWalletBalance = jest.fn();
jest.mock('@/lib/web3', () => ({
  Web3Service: { getInstance: () => ({ getTokenBalance: (...args: unknown[]) => mockWalletBalance(...args) }) },
}));
const mockFundWallet = jest.fn();
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => true, fundWallet: (options: unknown) => mockFundWallet(options) }),
}));

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const onFunded = jest.fn();
const show = (overrides: Record<string, unknown> = {}) =>
  render(
    <FundingOptions
      walletAddress={WALLET}
      tokenSymbol="USDC"
      tokenAddress="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      chainId={8453}
      networkName="Base"
      amount={20}
      onFunded={onFunded}
      {...overrides}
    />
  );
const shown = () => (reportFundingEvent as jest.Mock).mock.calls.filter(([name]) => name === 'trouble-shown').map(([, fields]) => fields);

beforeEach(() => {
  jest.clearAllMocks();
  mockRpcUrl = undefined;
  window.localStorage.clear();
  (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
  jest.spyOn(window, 'open').mockImplementation(() => null);
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('says so when the card window is closed without buying, with the other ways and the question', async () => {
  mockFundWallet.mockResolvedValue({ status: 'cancelled', detail: 'User exited flow' });
  show();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Add funds with a card/ }));
  });
  expect(screen.getByRole('heading', { name: "Didn't manage to buy your USDC?" })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try Coinbase' })).toBeInTheDocument();
  expect(screen.getByText('What stopped you? One tap helps us fix it.')).toBeInTheDocument();
  expect(shown()).toEqual([{ wallet: WALLET, provider: 'Privy', route: 'wallet', detail: 'cancelled' }]);
});

// With no way to read the wallet (no RPC in config): then, and only then, it asks outright.
it('asks a visitor back from Kraken how it went when it cannot look, and has the page look again on a yes', async () => {
  jest.useFakeTimers();
  show();
  fireEvent.click(screen.getByRole('button', { name: /Kraken/ }));
  act(() => {
    window.dispatchEvent(new Event('blur'));
    jest.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('focus'));
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole('heading', { name: 'Welcome back. Did your purchase at Kraken go through?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, I paid' }));
  expect(onFunded).toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('The USDC will show in your wallet when it arrives');
});

it('gives no help where nobody can buy: a preview', async () => {
  mockFundWallet.mockResolvedValue({ status: 'cancelled' });
  show({ lookOnly: true });
  expect(screen.queryByRole('heading', { name: /Didn't manage|Welcome back/ })).not.toBeInTheDocument();
});

describe('checking the wallet before saying anything (the list reads it itself)', () => {
  const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const buyAtKrakenAndComeBack = async () => {
    jest.useFakeTimers();
    mockRpcUrl = 'https://rpc.example';
    show({ amount: undefined });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Kraken/ }));
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

  it('says nothing when more has arrived in the wallet', async () => {
    mockWalletBalance.mockResolvedValueOnce('5').mockResolvedValue('55');
    await buyAtKrakenAndComeBack();
    expect(mockWalletBalance).toHaveBeenCalledWith(WALLET, TOKEN);
    expect(screen.queryByRole('heading', { name: /Welcome back|can't see/ })).not.toBeInTheDocument();
    expect(shown()).toEqual([]);
  });

  it('says it checked the wallet and cannot see the purchase, not "did it go through?"', async () => {
    mockWalletBalance.mockResolvedValue('5');
    await buyAtKrakenAndComeBack();
    expect(screen.getByRole('heading', { name: "We can't see your purchase from Kraken yet" })).toBeInTheDocument();
    expect(screen.getByText('We checked your wallet: it has 5.00 USDC, the same as before.')).toBeInTheDocument();
    expect(screen.queryByText(/Did your purchase/)).not.toBeInTheDocument();
    expect(shown()).toEqual([{ wallet: WALLET, provider: 'Kraken', route: 'wallet', detail: 'returned: 5.00 held' }]);
  });
});
