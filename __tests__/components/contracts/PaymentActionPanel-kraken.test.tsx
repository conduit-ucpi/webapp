/**
 * Paying through Kraken: its purchase sent straight to the payment address. It is one of the
 * providers behind "Pay by card or bank transfer": a button there when Kraken can deliver this
 * token here and the amount reaches its minimum, and otherwise a line saying why not.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/components/contracts/AddFundsModal', () => () => null);
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p' } }),
}));

const ESCROW = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';
const onPayFromExternalWallet = jest.fn();
const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '32.39 USDC',
  amountInTokens: 32.391,
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
  elsewherePanel: <div>the payment address panel</div>,
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
const kraken = () => offered(/Continue with Kraken/)!;

describe('PaymentActionPanel: pay with Kraken', () => {
  let tab: { opener: unknown; location: { href: string }; close: jest.Mock };
  let open: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
    tab = { opener: {}, location: { href: '' }, close: jest.fn() };
    open = jest.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);
  });
  afterEach(() => open.mockRestore());

  it('sends the whole amount, in tokens, to the payment address, then shows the panel that settles it', async () => {
    render(<PaymentActionPanel {...props()} />);
    fireEvent.click(kraken());

    // Opened during the click, before the address is known, so the browser does not block it.
    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(tab.location.href).toContain('https://ramp.kraken.com/entry?'));
    const url = new URL(tab.location.href);
    expect(url.searchParams.get('wallet_address')).toBe(ESCROW);
    expect(url.searchParams.get('crypto')).toBe('USDC');
    expect(url.searchParams.get('network')).toBe('Base');
    expect(url.searchParams.get('amount_type')).toBe('crypto');
    expect(url.searchParams.get('amount')).toBe('32.4');
    // The new tab cannot reach back into this page.
    expect(tab.opener).toBeNull();
    expect(onPayFromExternalWallet).toHaveBeenCalled();
    // Where "I have paid" is: pressing it is what secures the money.
    expect(await screen.findByText('the payment address panel')).toBeInTheDocument();
  });

  it('is offered beside Coinbase, not in place of it, with the fact that tells them apart', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(offered(/Continue with Coinbase.*Card or bank transfer/)).toBeEnabled();
    expect(offered(/Continue with Kraken.*Card, from 11 USD/)).toBeEnabled();
  });

  it("is not a button below Kraken's minimum, and the reason is given", () => {
    render(<PaymentActionPanel {...props({ amountLabel: '5 USDC', amountInTokens: 5 })} />);
    expect(offered(/Continue with Kraken/)).toBeNull();
    expect(screen.getByText('Kraken: this amount is below its minimum of 11 USD.')).toBeInTheDocument();
  });

  it('is offered at exactly the minimum', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '11 USDC', amountInTokens: 11 })} />);
    expect(kraken()).toBeEnabled();
  });

  it('is not shown at all for a token it can never deliver (USDT): it sends straight to the payment address', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '32 USDT', amountInTokens: 32, tokenSymbol: 'USDT' })} />);
    // No card route at all: none of them could deliver it.
    expect(screen.queryByRole('button', { name: /Pay by card/ })).toBeNull();
    expect(screen.queryByText(/Kraken/)).toBeNull();
  });

  it('is not a button on a network Kraken does not deliver to, and the reason is given', () => {
    render(<PaymentActionPanel {...props({ chainId: 1, networkName: 'Ethereum' })} />);
    expect(offered(/Continue with Kraken/)).toBeNull();
    expect(screen.getByText("Kraken can't deliver USDC on Ethereum yet.")).toBeInTheDocument();
  });

  it('closes the tab and says so when the payment address cannot be prepared', async () => {
    render(<PaymentActionPanel {...props({ resolveEscrowAddress: async () => null })} />);
    fireEvent.click(kraken());
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.href).toBe('');
    expect(onPayFromExternalWallet).not.toHaveBeenCalled();
  });

  it('is not offered where there is no payment address to send to', () => {
    render(<PaymentActionPanel {...props({ resolveEscrowAddress: undefined })} />);
    expect(screen.queryByRole('button', { name: /Pay by card/ })).toBeNull();
  });
});
