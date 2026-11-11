/**
 * A request in a token nobody sells here (USDT on Base) can be paid with the one they do (USDC).
 *
 * The BUTTONS say so, not a paragraph beside them: each has a main line for what happens and a
 * second for the one fact that decides it, and exactly one is prominent: the next thing this
 * buyer can do.
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
  elsewherePanel: <div>the payment address panel</div>,
  conversion: conversion(),
  ...overrides,
});
const lastModal = () => mockModal.mock.calls[mockModal.mock.calls.length - 1][0];

beforeEach(() => {
  mockModal.mockClear();
  (useOnrampMinimum as jest.Mock).mockReturnValue(null);
  (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
});

/** What can be pressed or read as a button, top to bottom, without the copy-address icon. */
const buttons = () =>
  screen
    .getAllByRole('button')
    .filter((button) => !/copy/i.test(button.getAttribute('aria-label') ?? ''))
    .map((button) => ({ says: button.textContent, live: !(button as HTMLButtonElement).disabled }));

describe('a USDT request, wallet holding enough USDC', () => {
  it('offers exactly two things: pay with the USDC, or send USDT held elsewhere', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(buttons()).toEqual([
      { says: 'Pay 20 USDT with your USDCAbout 19.99 USDC, converted as you pay', live: true },
      { says: 'Send USDT from another walletFor USDT you already hold elsewhere', live: true },
    ]);
  });

  it('pays on the click', () => {
    const onPay = jest.fn();
    render(<PaymentActionPanel {...props({ onPay })} />);
    fireEvent.click(screen.getByRole('button', { name: /Pay 20 USDT with your USDC/ }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('rounds the cost up, never down: the figure is not less than what leaves the wallet', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ cost: 20.0101 }) })} />);
    expect(screen.getByRole('button', { name: /About 20\.02 USDC/ })).toBeInTheDocument();
  });

  describe('the balances shown', () => {
    it('always shows the balance of the token asked for: it is what the payment is in', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.getByText('0.0000 USDT')).toBeInTheDocument();
    });

    it('lists the USDC beside it when the wallet holds some that can go towards the payment', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.getByText('25.0000 USDC')).toBeInTheDocument();
    });

    it('does not call the wallet short, in red, when its USDC covers the payment', () => {
      render(<PaymentActionPanel {...props()} />);
      expect(screen.queryByText(/USDT short/)).toBeNull();
    });

    it('holding some of each, shows both', () => {
      render(<PaymentActionPanel {...props({ balanceFloat: 12.5, conversion: conversion({ cost: 7.494 }) })} />);
      expect(screen.getByText('12.5000 USDT')).toBeInTheDocument();
      expect(screen.getByText('25.0000 USDC')).toBeInTheDocument();
    });

    it('holding neither, shows the USDT balance and how short it is, and no empty USDC line', () => {
      render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 0, status: 'short' }) })} />);
      expect(screen.getByText('0.0000 USDT')).toBeInTheDocument();
      expect(screen.getByText(/20\.0000 USDT short/)).toBeInTheDocument();
      expect(screen.queryByText(/0\.0000 USDC/)).toBeNull();
    });

    it('on a USDC request, USDT is not mentioned unless the wallet holds some to pay with', () => {
      const usdc = { amountLabel: '20 USDC', tokenSymbol: 'USDC', tokenAddress: USDC, balanceFloat: 3 };
      const { unmount } = render(
        <PaymentActionPanel {...props({ ...usdc, conversion: conversion({ fromSymbol: 'USDT', fromTokenAddress: USDT, fromBalance: 0, status: 'short' }) })} />
      );
      expect(screen.getByText('3.0000 USDC')).toBeInTheDocument();
      expect(screen.queryByText(/USDT/, { selector: 'p' })).toBeNull();
      unmount();
      render(
        <PaymentActionPanel {...props({ ...usdc, conversion: conversion({ fromSymbol: 'USDT', fromTokenAddress: USDT, fromBalance: 40 }) })} />
      );
      expect(screen.getByText('3.0000 USDC')).toBeInTheDocument();
      expect(screen.getByText('40.0000 USDT')).toBeInTheDocument();
    });
  });

  it('needs no paragraph to explain it', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText(/Add funds first/)).toBeNull();
  });
});

describe('a USDT request, wallet holding neither', () => {
  const short = () => props({ conversion: conversion({ fromBalance: 5, status: 'short' }) });

  it('leads with buying USDC, shows that USDT itself cannot be bought, and has no dead pay button', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(buttons()).toEqual([
      // 19.985028 plus 1%, up to the cent, is 20.19; the wallet holds 5.
      { says: 'Buy USDC and pay with itAbout 15.19 USDC by card or exchange, converted to USDT as you pay', live: true },
      { says: 'Buy USDTNot sold on this network yet', live: false },
      { says: 'Send USDT from another walletFor USDT you already hold elsewhere', live: true },
    ]);
  });

  it('buys USDC, not USDT: the cost plus a margin, less what is already held', () => {
    render(<PaymentActionPanel {...short()} />);
    fireEvent.click(screen.getByRole('button', { name: /Buy USDC and pay with it/ }));
    const modal = lastModal();
    expect(modal).toMatchObject({ isOpen: true, tokenSymbol: 'USDC', tokenAddress: USDC, tokenDecimals: 6 });
    expect(modal.shortfall).toBeCloseTo(15.19, 6);
  });

  it("names the exchange's minimum on the button when what is needed is less than it", () => {
    (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 20, currency: 'USD', inTokens: 20 });
    render(<PaymentActionPanel {...short()} />);
    expect(
      screen.getByRole('button', { name: /Buy USDC and pay with it.*By card or exchange \(minimum 20 USD\), converted to USDT as you pay/ })
    ).toBeEnabled();
  });

  it('does not show the routes that send straight to the payment address: nothing could convert what they send', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(screen.queryByRole('button', { name: /Pay by card/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pay with Kraken/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pay with Link/ })).toBeNull();
  });

  it('says nothing in small print that a button already says', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(screen.queryByText(/Some external suppliers can't support USDT yet/)).toBeNull();
    expect(screen.queryByText(/Add funds first/)).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('a USDT request, while the conversion is not known or not possible', () => {
  it('holds one button saying it is checking, and offers no purchase it cannot yet size', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ cost: null, status: 'quoting' }) })} />);
    expect(buttons()).toEqual([
      { says: 'Checking what it costs to convert your USDC…', live: false },
      { says: 'Send USDT from another walletFor USDT you already hold elsewhere', live: true },
    ]);
  });

  it('does not sell USDC for a conversion that cannot be made, and says why the wallet cannot pay', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 0, cost: null, status: 'unavailable' }) })} />);
    expect(buttons()).toEqual([
      { says: 'Pay 20 USDT from this wallet', live: false },
      { says: 'Buy USDTNot sold on this network yet', live: false },
      { says: 'Send USDT from another walletFor USDT you already hold elsewhere', live: true },
    ]);
    expect(screen.getByText(/can't be converted to USDT right now/)).toBeInTheDocument();
  });

  it("a seller's preview is not about the seller's own wallet: no pay button, and nothing live to buy", () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 5, status: 'short' }) })} preview />);
    expect(screen.queryByRole('button', { name: /Pay 20 USDT/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Buy USDC and pay with it/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Buy USDT/ })).toBeDisabled();
  });
});

describe('where it does not apply', () => {
  it('a USDT request the wallet can already pay is one plain button, and the way in for USDT held elsewhere', () => {
    render(<PaymentActionPanel {...props({ balanceFloat: 50, hasInsufficientBalance: false, conversion: undefined })} />);
    expect(screen.getByRole('button', { name: 'Pay 20 USDT from this wallet' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Send USDT from another wallet/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^Buy/ })).toBeNull();
    expect(screen.queryByText('25.0000 USDC')).toBeNull();
  });

  it('a USDC request short of USDC can be paid with USDT held, beside the two ordinary choices', () => {
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
    expect(buttons()).toEqual([
      { says: 'Pay 20 USDC with your USDTAbout 20.01 USDT, converted as you pay', live: true },
      { says: 'Pay by card or bank transferNo crypto needed', live: true },
      { says: 'Pay with cryptoFrom this wallet or one you already have', live: true },
    ]);
    // Topping up buys USDC, the token asked for: nothing needs converting to get it.
    fireEvent.click(screen.getByRole('button', { name: /Pay with crypto/ }));
    fireEvent.click(screen.getByRole('button', { name: /In this wallet, but not enough/ }));
    expect(lastModal()).toMatchObject({ tokenSymbol: 'USDC', shortfall: 20 });
  });
});
