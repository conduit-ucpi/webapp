/**
 * One component for the payment screen and /buy-token: told what is needed, it opens every route
 * for exactly the shortfall; told nothing, it asks. The exchange list comes below either way.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import FundingOptions from '@/components/funding/FundingOptions';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453 } }),
}));
const fundWallet = jest.fn();
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => true, fundWallet }),
}));
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));

const options = (extra: Record<string, unknown> = {}) => (
  <FundingOptions walletAddress={WALLET} tokenSymbol="USDC" tokenAddress={USDC} chainId={8453} networkName="Base" {...extra} />
);
const krakenAmount = (open: jest.SpyInstance) => new URL(open.mock.calls[0][0]).searchParams.get('amount');

describe('FundingOptions', () => {
  let open: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    fundWallet.mockResolvedValue({ status: 'cancelled' });
    open = jest.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => open.mockRestore());

  it('asks how much when it is not told', () => {
    render(options());
    expect(screen.getByLabelText('How much USDC do you need?')).toHaveValue(50);
    fireEvent.click(screen.getByRole('button', { name: /Add from Kraken/ }));
    expect(krakenAmount(open)).toBe('50');
  });

  it('does not ask when it is told, and opens each route for that amount', () => {
    render(options({ amount: 32.391 }));
    expect(screen.queryByLabelText('How much USDC do you need?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add from Kraken/ }));
    expect(krakenAmount(open)).toBe('32.4');
  });

  it('opens for what the balance leaves short', () => {
    render(options({ amount: 100, balance: 60 }));
    fireEvent.click(screen.getByRole('button', { name: /Add from Kraken/ }));
    expect(krakenAmount(open)).toBe('40');
  });

  it('asks the wallet provider for the shortfall, in tokens', () => {
    render(options({ amount: 100, balance: 60 }));
    fireEvent.click(screen.getByRole('button', { name: /Add funds with a card/ }));
    expect(fundWallet).toHaveBeenCalledWith({ amount: '40.00', asset: 'USDC', chainId: 8453 });
  });

  // The card window opens on money to spend, and the seller's fee comes out of it ($100 bought 95.88 USDC).
  it('tells the buyer, on the card option, to check they will receive what they need', () => {
    render(options({ amount: 100, balance: 60 }));
    expect(screen.getByRole('button', { name: /Add funds with a card/ })).toHaveTextContent(
      'Check what you will receive before you pay. The seller takes its fee out of the amount, so raise it there until you receive at least 40.00 USDC.'
    );
  });

  it('fills in the links that can carry the purchase, in the list of more places to buy', () => {
    render(options({ amount: 100, balance: 60 }));
    const moonPay = new URL(screen.getByRole('link', { name: /MoonPay/ }).getAttribute('href')!);
    expect(moonPay.searchParams.get('currencyCode')).toBe('usdc_base');
    expect(moonPay.searchParams.get('quoteCurrencyAmount')).toBe('40');
    expect(screen.getByRole('link', { name: /Transak/ })).toHaveAttribute('href', 'https://global.transak.com');
  });

  it('asks how much when the balance already covers it', () => {
    render(options({ amount: 20, balance: 60 }));
    expect(screen.getByLabelText('How much USDC do you need?')).toBeInTheDocument();
  });

  it('puts the exact amount in the transfer link when it is known', () => {
    render(options({ amount: 9.57 }));
    fireEvent.click(screen.getByRole('button', { name: /Transfer from another wallet/ }));
    expect(screen.getByText('9.5700 USDC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy payment link' })).toBeInTheDocument();
  });

  it('keeps the exchange list closed until asked, unless told to open it', () => {
    const { unmount } = render(options());
    expect(screen.getByText('More places to buy USDC').closest('details')).not.toHaveAttribute('open');
    unmount();
    render(options({ exchangesOpen: true }));
    expect(screen.getByText('More places to buy USDC').closest('details')).toHaveAttribute('open');
  });
});
