/**
 * Options the exchange would refuse are greyed out, with the reason, and the wallet route stays open.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/components/contracts/AddFundsModal', () => () => null);
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p' } }),
}));

const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '1.50 USDC',
  amountInTokens: 1.5,
  balanceFloat: 0,
  tokenSymbol: 'USDC',
  tokenAddress: '0xtoken',
  tokenDecimals: 6,
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  networkName: 'Base',
  isLoadingBalance: false,
  hasInsufficientBalance: true,
  isSameAddress: false,
  isPaymentInProgress: false,
  onPay: jest.fn(),
  onPayFromExternalWallet: jest.fn(),
  resolveEscrowAddress: async () => '0xescrow',
  ...overrides,
});
const card = () => screen.getByRole('button', { name: /Pay by card/ });
const available = { unavailable: false, countryName: null, overrule: jest.fn() };

describe('PaymentActionPanel and the exchange minimum', () => {
  beforeEach(() => {
    (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 2, currency: 'USD', inTokens: 2 });
    (useCoinbaseAvailability as jest.Mock).mockReturnValue(available);
  });

  describe('where Coinbase cannot take money', () => {
    const overrule = jest.fn();
    beforeEach(() => {
      (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: true, countryName: 'Venezuela', overrule });
    });

    it('greys out paying by card, says why, and lets the buyer overrule the country', () => {
      render(<PaymentActionPanel {...props({ amountLabel: '32 USDC', amountInTokens: 32 })} />);
      expect(card()).toBeDisabled();
      expect(screen.getByText(/Coinbase can't take card or bank payments in Venezuela/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Not in Venezuela?' }));
      expect(overrule).toHaveBeenCalled();
    });

    it("leaves the other routes open, without Coinbase's minimum on them", () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.getByRole('button', { name: 'Add funds to this wallet' })).toBeEnabled();
      expect(screen.getByRole('button', { name: /external wallet/ })).toBeEnabled();
      expect(screen.queryByText(/below the exchange's minimum/)).toBeNull();
    });

    it('stays quiet in a seller preview', () => {
      render(<PaymentActionPanel {...props({ preview: true })} />);
      expect(screen.queryByText(/Venezuela/)).toBeNull();
    });
  });

  it('greys out paying by card below the minimum, with the reason', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(card()).toBeDisabled();
    expect(screen.getByText(/below the exchange's minimum transfer of 2 USD/)).toBeInTheDocument();
  });

  it('keeps funding the wallet open, and names the minimum on its button', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(screen.getByRole('button', { name: "Add funds to this wallet (exchange's minimum transfer = 2 USD)" })).toBeEnabled();
  });

  it('offers both at or above the minimum, without the note', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '2 USDC', amountInTokens: 2 })} />);
    expect(card()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add funds to this wallet' })).toBeEnabled();
    expect(screen.queryByText(/below the exchange's minimum/)).toBeNull();
  });

  it('names the minimum when only the top-up is small, and leaves the card route open', () => {
    render(<PaymentActionPanel {...props({ amountLabel: '10 USDC', amountInTokens: 10, balanceFloat: 9 })} />);
    expect(card()).toBeEnabled();
    expect(screen.getByRole('button', { name: /minimum transfer = 2 USD/ })).toBeEnabled();
  });

  it('does not block anything when the minimum is unknown', () => {
    (useOnrampMinimum as jest.Mock).mockReturnValue(null);
    render(<PaymentActionPanel {...props()} />);
    expect(card()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add funds to this wallet' })).toBeEnabled();
  });

  it('explains the greyed-out wallet buttons', () => {
    const { unmount } = render(<PaymentActionPanel {...props()} />);
    expect(screen.getByText('You need 1.5000 USDC more. Add funds first.')).toBeInTheDocument();
    unmount();
    render(<PaymentActionPanel {...props({ balanceFloat: 5, hasInsufficientBalance: false })} />);
    expect(screen.getByText('Your wallet already has enough to pay.')).toBeInTheDocument();
  });

  it('gives no reasons in a seller preview', () => {
    render(<PaymentActionPanel {...props({ preview: true })} />);
    expect(screen.queryByText(/below the exchange's minimum/)).toBeNull();
    expect(screen.queryByText(/You need/)).toBeNull();
  });
});
