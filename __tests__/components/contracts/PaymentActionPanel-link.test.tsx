/**
 * "Pay with Link": Stripe's Link page, which takes no address from us, so the payment address is
 * copied for the buyer and the panel that shows it is opened. It sits with the other card routes.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability');
jest.mock('@/components/contracts/AddFundsModal', () => () => null);
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p' } }),
}));

const ESCROW = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';
const onPayFromExternalWallet = jest.fn();
const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '5.25 USDC',
  amountInTokens: 5.251,
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
  onPayFromExternalWallet,
  resolveEscrowAddress: async () => ESCROW,
  ...overrides,
});
/** Providers live behind "Pay by card or bank transfer": open it, then look. */
const openCard = () => {
  if (!screen.queryByRole('dialog')) fireEvent.click(screen.getByRole('button', { name: /Pay by card or bank transfer/ }));
};
const offered = (name: RegExp) => {
  openCard();
  return screen.queryByRole('button', { name });
};
const link = () => offered(/Continue with Link by Stripe/)!;

describe('PaymentActionPanel: pay with Link', () => {
  let tab: { opener: unknown; location: { href: string }; close: jest.Mock };
  let open: jest.SpyInstance;
  const writeText = jest.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    jest.clearAllMocks();
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
    (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
    tab = { opener: {}, location: { href: '' }, close: jest.fn() };
    open = jest.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);
    Object.assign(navigator, { clipboard: { writeText } });
  });
  afterEach(() => open.mockRestore());

  it('is offered beside Coinbase and Kraken, best first, each with the fact that tells it apart', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    openCard();
    const within = screen.getByRole('dialog');
    const names = Array.from(within.querySelectorAll('button'))
      .map((button) => button.textContent)
      .filter((text) => /^Continue with/.test(text ?? ''));
    expect(names).toEqual([
      'Continue with CoinbaseCard or bank transfer',
      'Continue with KrakenCard, from 11 USD. Come back here and press "I have paid".',
      "Continue with Link by StripeCard. You paste this payment's address there (copied for you).",
    ]);
  });

  it('asks Link for the whole amount in tokens, copies the payment address, and shows the panel that has it', async () => {
    render(<PaymentActionPanel {...props()} />);
    fireEvent.click(link());

    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(tab.location.href).toContain('https://crypto.link.com/?'));
    const url = new URL(tab.location.href);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      destination_currency: 'usdc',
      destination_network: 'base',
      destination_amount: '5.26',
    });
    expect(writeText).toHaveBeenCalledWith(ESCROW);
    expect(tab.opener).toBeNull();
    expect(onPayFromExternalWallet).toHaveBeenCalled();
  });

  it('still opens when the clipboard is blocked: the address is on screen', async () => {
    writeText.mockRejectedValueOnce(new Error('blocked'));
    render(<PaymentActionPanel {...props()} />);
    fireEvent.click(link());
    await waitFor(() => expect(tab.location.href).toContain('crypto.link.com'));
    expect(onPayFromExternalWallet).toHaveBeenCalled();
  });

  it('is not shown at all for a token it can never deliver (USDT): it sends straight to the payment address', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDT', amountInTokens: 32, tokenSymbol: 'USDT' })} />);
    expect(screen.queryByRole('button', { name: /Pay by card/ })).toBeNull();
    expect(screen.queryByText(/Link/)).toBeNull();
  });

  it('is not a button on a network Link does not deliver to, and the reason is given', () => {
    render(<PaymentActionPanel {...props({ chainId: 1, networkName: 'Ethereum' })} />);
    expect(offered(/Continue with Link/)).toBeNull();
    expect(screen.getByText("Link can't deliver USDC on Ethereum yet.")).toBeInTheDocument();
  });

  it('is not a button outside the United States; the reason is given, and the buyer can overrule the country', () => {
    const overrule = jest.fn();
    (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'United Kingdom', overrule });
    render(<PaymentActionPanel {...props()} />);
    expect(offered(/Continue with Link/)).toBeNull();
    expect(screen.getByText(/Link only sells in the United States, not in United Kingdom/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not in United Kingdom?' }));
    expect(overrule).toHaveBeenCalled();
  });

  it('closes the tab when the payment address cannot be prepared', async () => {
    render(<PaymentActionPanel {...props({ resolveEscrowAddress: async () => null })} />);
    fireEvent.click(link());
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(onPayFromExternalWallet).not.toHaveBeenCalled();
  });
});
