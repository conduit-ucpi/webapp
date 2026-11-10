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
const link = () => screen.getByRole('button', { name: /Pay with Link/ });

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

  it('sits beside the Coinbase and Kraken card options, not in place of them', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
    expect(screen.getByRole('button', { name: /Pay by card or bank transfer/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Pay with Kraken/ })).toBeEnabled();
    expect(link()).toBeEnabled();
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

  it('is greyed out for a token Link does not deliver, under the one line that says so', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDT', amountInTokens: 32, tokenSymbol: 'USDT' })} />);
    expect(link()).toBeDisabled();
    expect(screen.queryByText(/Link can't deliver/)).toBeNull();
    expect(screen.getAllByText(/can't support USDT yet/)).toHaveLength(1);
  });

  it('is greyed out on a network Link does not deliver to, with the reason', () => {
    render(<PaymentActionPanel {...props({ chainId: 1, networkName: 'Ethereum' })} />);
    expect(link()).toBeDisabled();
    expect(screen.getByText("Link can't deliver USDC on Ethereum yet.")).toBeInTheDocument();
  });

  it('is greyed out outside the United States, says why, and lets the buyer overrule the country', () => {
    const overrule = jest.fn();
    (useLinkAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'United Kingdom', overrule });
    render(<PaymentActionPanel {...props()} />);
    expect(link()).toBeDisabled();
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
