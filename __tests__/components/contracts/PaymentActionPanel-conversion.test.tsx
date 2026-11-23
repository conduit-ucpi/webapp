/**
 * A request in a token nobody sells here (USDT on Base) can be paid with the one they do (USDC).
 *
 * A wallet holding enough USDC gets one button that says so. One holding too little of both is
 * offered, under "Card or bank", the companies that sell USDC into it, and told it is converted
 * as they pay.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import PaymentActionPanel, { type PaymentConversion } from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/hooks/useLinkAvailability', () => ({
  useLinkAvailability: () => ({ unavailable: false, countryName: null, overrule: jest.fn() }),
}));
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453 } }),
}));
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => false, fundWallet: jest.fn() }),
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
  resolveEscrowAddress: async () => '0xcontract',
  elsewherePanel: <div>the payment address panel</div>,
  conversion: conversion(),
  ...overrides,
});

beforeEach(() => {
  (useOnrampMinimum as jest.Mock).mockReturnValue(null);
  (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
});

const provider = (name: RegExp) => screen.queryByRole('button', { name });
const row = (name: RegExp) => provider(name)!.closest('li') as HTMLElement;
/** What the chosen company's row says to do next, or null while it has not been chosen. */
const nextStep = (name: RegExp) =>
  within(row(name)).queryByText('When you have paid there:')?.parentElement ?? null;

/** What can be pressed or read as a button, top to bottom, without the copy-address icon. */
const buttons = () =>
  screen
    .getAllByRole('button')
    .filter((button) => !/copy/i.test(button.getAttribute('aria-label') ?? ''))
    .map((button) => ({ says: button.textContent, live: !(button as HTMLButtonElement).disabled }));

describe('a USDT request, wallet holding enough USDC', () => {
  it('offers one thing: swap the USDC and pay, on one button', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(buttons()).toEqual([
      { says: 'Pay 20 USDT with your USDCAbout 19.99 USDC, converted as you pay', live: true },
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

    it('holding neither, shows the USDT balance quietly at the foot, not as a failure, and no empty USDC line', () => {
      render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 0, status: 'short' }) })} />);
      expect(screen.getByText('Your wallet here:').closest('p')).toHaveTextContent('0.0000 USDT');
      expect(screen.queryByText(/short/)).toBeNull();
      expect(screen.queryByText(/0\.0000 USDC/)).toBeNull();
    });

    it('holding a little USDC, lists it beside the USDT at the foot', () => {
      render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 5, status: 'short' }) })} />);
      expect(screen.getByText('Your wallet here:').closest('p')).toHaveTextContent('0.0000 USDT, 5.0000 USDC');
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
  let open: jest.SpyInstance;
  beforeEach(() => {
    open = jest.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => open.mockRestore());

  it('explains that USDC must be added first, then swapped and paid here, and has no dead pay button', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(
      screen.getByText(
        "USDT can't be bought by card or bank on Base. Add USDC to your wallet with one of the ways below, then come back to this page: one button will swap it and pay in USDT."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /from this wallet$/ })).toBeNull();
    // 19.985028 plus 1%, up to the cent, is 20.19; the wallet holds 5.
    expect(screen.getByText('About 15.19 USDC by card or exchange, converted to USDT as you pay')).toBeInTheDocument();
    // Nothing goes straight to the payment: nobody sells USDT, and nothing could convert what they send.
    // The companies say what they need, in a line each; what is bought and why is said once, above.
    expect(row(/Continue with Kraken/)).toHaveTextContent('Card. Needs a Kraken account.');
    expect(row(/Continue with Coinbase/)).toHaveTextContent('Card or bank transfer. Needs a Coinbase account.');
  });

  it('USDT held elsewhere can still be sent straight to the payment', () => {
    render(<PaymentActionPanel {...short()} />);
    fireEvent.click(screen.getByRole('button', { name: /Crypto I already have.*USDT on Base/ }));
    expect(screen.getByText('the payment address panel')).toBeInTheDocument();
    expect(screen.getByText('Or add USDC to your wallet here, then pay from it')).toBeInTheDocument();
  });

  it('buys USDC, not USDT: the cost plus a margin, less what is already held', () => {
    render(<PaymentActionPanel {...short()} />);
    fireEvent.click(provider(/Continue with Kraken/)!);
    const url = new URL(open.mock.calls[0][0]);
    expect(url.searchParams.get('crypto')).toBe('USDC');
    expect(url.searchParams.get('amount')).toBe('15.19');
    expect(nextStep(/Continue with Kraken/)!).toHaveTextContent(
      'When it arrives, come back to this page: one button will swap your USDC and pay in USDT.'
    );
  });

  it("names the exchange's minimum when what is needed is less than it", () => {
    (useOnrampMinimum as jest.Mock).mockReturnValue({ amount: 20, currency: 'USD', inTokens: 20 });
    render(<PaymentActionPanel {...short()} />);
    expect(screen.getByText('By card or exchange (minimum 20 USD), converted to USDT as you pay')).toBeInTheDocument();
  });

  it('says nothing in small print that the screen already says', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(screen.queryByText(/Some external suppliers can't support USDT yet/)).toBeNull();
    expect(screen.queryByText(/Add funds first/)).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('a USDT request, while the conversion is not known or not possible', () => {
  it('holds one button saying it is checking, and offers no purchase it cannot yet size', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ cost: null, status: 'quoting' }) })} />);
    expect(buttons()).toEqual([{ says: 'Checking what it costs to convert your USDC…', live: false }]);
    // What it holds elsewhere can be sent meanwhile: the one answer there is, so no tiles.
    expect(screen.getByText('the payment address panel')).toBeInTheDocument();
  });

  it('does not sell USDC for a conversion that cannot be made, and says why the wallet cannot pay', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 0, cost: null, status: 'unavailable' }) })} />);
    expect(buttons()).toEqual([{ says: 'Pay 20 USDT from this wallet', live: false }]);
    expect(screen.getByText(/can't be converted to USDT right now/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Continue with/ })).toBeNull();
    expect(screen.getByText('the payment address panel')).toBeInTheDocument();
  });

  it("a seller's preview is not about the seller's own wallet: no pay button, and nothing live to buy", () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 5, status: 'short' }) })} preview />);
    expect(screen.queryByRole('button', { name: /Pay 20 USDT/ })).toBeNull();
    expect(provider(/Continue with Kraken/)).toBeDisabled();
  });
});

describe('where it does not apply', () => {
  it('a USDT request the wallet can already pay is one plain button', () => {
    render(<PaymentActionPanel {...props({ balanceFloat: 50, hasInsufficientBalance: false, conversion: undefined })} />);
    expect(screen.getByRole('button', { name: 'Pay 20 USDT from this wallet' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^Buy/ })).toBeNull();
    expect(screen.queryByText('25.0000 USDC')).toBeNull();
  });

  it('a USDC request short of USDC can be paid with USDT held: one button, and nothing to add', () => {
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
    ]);
  });

  it('a USDC request short of both is shown the ways to add USDC, the token asked for', () => {
    render(
      <PaymentActionPanel
        {...props({
          amountLabel: '20 USDC',
          tokenSymbol: 'USDC',
          tokenAddress: USDC,
          conversion: conversion({ fromSymbol: 'USDT', fromTokenAddress: USDT, fromBalance: 0, status: 'short' }),
        })}
      />
    );
    expect(screen.getByRole('button', { name: /Card or bank/ })).toHaveAttribute('aria-pressed', 'true');
    expect(row(/Continue with Kraken/)).toHaveTextContent('Card. Needs a Kraken account.');
    expect(screen.queryByText(/converts it and pays/)).toBeNull();
  });
});
