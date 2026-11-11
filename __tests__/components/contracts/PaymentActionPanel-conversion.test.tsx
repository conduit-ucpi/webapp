/**
 * A request in a token nobody sells here (USDT on Base) can be paid with the one they do (USDC):
 * the panel shows that plainly, buys USDC, and pays by converting it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import PaymentActionPanel, { type PaymentConversion } from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability', () => ({
  useLinkAvailability: () => ({ unavailable: false, countryName: null, overrule: jest.fn() }),
}));
const mockModal = jest.fn();
jest.mock('@/components/contracts/AddFundsModal', () => (modalProps: any) => {
  mockModal(modalProps);
  return null;
});
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p' } }),
}));

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const conversion = (overrides: Partial<PaymentConversion> = {}): PaymentConversion => ({
  fromSymbol: 'USDC',
  fromTokenAddress: USDC,
  fromTokenDecimals: 6,
  fromBalance: 25,
  cost: 19.985028,
  status: 'ready',
  ...overrides,
});
const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '20 USDT',
  amountInTokens: 20,
  balanceFloat: 0,
  tokenSymbol: 'USDT',
  tokenAddress: USDT,
  tokenDecimals: 6,
  chainId: 8453,
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  networkName: 'Base',
  isLoadingBalance: false,
  hasInsufficientBalance: true,
  isSameAddress: false,
  isPaymentInProgress: false,
  onPay: jest.fn(),
  onPayFromExternalWallet: jest.fn(),
  resolveEscrowAddress: async () => '0xescrow',
  conversion: conversion(),
  ...overrides,
});
const lastModal = () => mockModal.mock.calls[mockModal.mock.calls.length - 1][0];

beforeEach(() => {
  mockModal.mockClear();
  (useOnrampMinimum as jest.Mock).mockReturnValue(null);
  (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
});

describe('with enough USDC to cover a USDT request', () => {
  it('offers to pay using it, with the cost rounded up, and pays on the click', () => {
    const onPay = jest.fn();
    render(<PaymentActionPanel {...props({ onPay })} />);
    const pay = screen.getByRole('button', { name: 'Pay 20 USDT using your USDC (about 19.99 USDC)' });
    expect(pay).toBeEnabled();
    fireEvent.click(pay);
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('shows what the wallet holds of both, and says where the conversion happens', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(screen.getByText('0.0000 USDT')).toBeInTheDocument();
    expect(screen.getByText('25.0000 USDC')).toBeInTheDocument();
    expect(screen.getByText(/converted to USDT in your own wallet on Uniswap, then paid/)).toBeInTheDocument();
    expect(screen.queryByText(/Add funds first/)).toBeNull();
  });

  it('has nothing to add, so adding funds is off', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(screen.getByRole('button', { name: 'Add USDC to this wallet' })).toBeDisabled();
  });
});

describe('short of both', () => {
  const short = () => props({ conversion: conversion({ fromBalance: 5, status: 'short' }) });

  it('shows both ways of buying, the direct one unavailable and the conversion chosen', () => {
    render(<PaymentActionPanel {...short()} />);
    const [direct, viaUsdc] = screen.getAllByRole('radio');
    expect(direct).toHaveTextContent('Buy USDT directly');
    expect(direct).toHaveTextContent('No supplier sells USDT on this network yet');
    expect(direct).toHaveAttribute('aria-disabled', 'true');
    expect(direct).toHaveAttribute('aria-checked', 'false');
    expect(viaUsdc).toHaveTextContent('Buy USDC and convert it to USDT when you pay');
    expect(viaUsdc).toHaveAttribute('aria-checked', 'true');
  });

  it('cannot pay yet, and says how much more USDC is needed', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(screen.getByRole('button', { name: /Pay 20 USDT from this wallet/ })).toBeDisabled();
    expect(screen.getByText('You need about 14.99 more USDC to pay this. Add USDC first.')).toBeInTheDocument();
  });

  it('adds USDC, not USDT: the cost plus a margin, less what is already held', () => {
    render(<PaymentActionPanel {...short()} />);
    const add = screen.getByRole('button', { name: 'Add USDC to this wallet' });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    const modal = lastModal();
    expect(modal).toMatchObject({ isOpen: true, tokenSymbol: 'USDC', tokenAddress: USDC, tokenDecimals: 6 });
    // 19.985028 plus 1%, up to the cent, is 20.19; the wallet holds 5.
    expect(modal.shortfall).toBeCloseTo(15.19, 6);
  });

  it('buys for the amount owed plus the margin when there is no quote to go on', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 0, cost: null, status: 'unavailable' }) })} />);
    expect(lastModal().shortfall).toBeCloseTo(20.2, 6);
    expect(screen.getByText(/can't be converted to USDT right now/)).toBeInTheDocument();
  });

  it('keeps the routes that send straight to the payment address off, and says why', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(screen.getByRole('button', { name: /Pay by card/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Pay with Kraken/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Pay with Link/ })).toBeDisabled();
    expect(screen.getByText(/send straight to the payment address, so nothing can convert what they send to USDT/)).toBeInTheDocument();
    expect(screen.queryByText(/Some external suppliers can't support USDT yet/)).toBeNull();
  });

  it('says it is checking while the cost is not known', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ cost: null, status: 'quoting' }) })} />);
    expect(screen.getByRole('button', { name: /Pay 20 USDT from this wallet/ })).toBeDisabled();
    expect(screen.getByText('Checking what it costs to convert your USDC…')).toBeInTheDocument();
  });

  it('shows none of it in a seller preview', () => {
    render(<PaymentActionPanel {...short()} preview />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});

describe('where it does not apply', () => {
  it('pays the ordinary way when the wallet holds enough of the token asked for', () => {
    render(<PaymentActionPanel {...props({ balanceFloat: 50, hasInsufficientBalance: false })} />);
    expect(screen.getByRole('button', { name: 'Pay 20 USDT from this wallet' })).toBeEnabled();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText('25.0000 USDC')).toBeNull();
  });

  it('a USDC request short of USDC still buys USDC, and can be paid with USDT held', () => {
    render(
      <PaymentActionPanel
        {...props({
          amountLabel: '20 USDC',
          tokenSymbol: 'USDC',
          tokenAddress: USDC,
          conversion: conversion({ fromSymbol: 'USDT', fromTokenAddress: USDT, cost: 20.01 }),
        })}
      />
    );
    expect(screen.getByRole('button', { name: 'Pay 20 USDC using your USDT (about 20.01 USDT)' })).toBeEnabled();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add funds to this wallet' }));
    expect(lastModal()).toMatchObject({ tokenSymbol: 'USDC', shortfall: 20 });
  });
});
