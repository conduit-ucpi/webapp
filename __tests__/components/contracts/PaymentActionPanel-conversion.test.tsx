/**
 * A request in a token nobody sells here (USDT on Base) can be paid with the one they do (USDC).
 *
 * It is shown as three steps in a row, all on screen from the start: 1 buy USDC -> 2 convert and
 * pay -> 3 protected, with the one the buyer is on opened beneath. Pressing a step opens it,
 * whether or not it can be done yet: step 2 shows the real button, greyed and not pressable, with
 * what it is waiting for. A wallet already holding enough USDC lands with step 1 ticked and step 2
 * open and live.
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
  onRefreshBalance: jest.fn(),
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
/** The three steps across the top, in order. */
const steps = () => within(screen.getByRole('list', { name: 'The three steps to pay this' })).getAllByRole('button');
const step = (n: 1 | 2 | 3) => steps()[n - 1];
const current = () => steps().filter((button) => button.getAttribute('aria-current') === 'step').map((button) => button.textContent);
const opened = () => steps().filter((button) => button.getAttribute('aria-expanded') === 'true').map((button) => button.textContent);
const convertAndPay = () => screen.getByRole('button', { name: /Pay 20 USDT with your USDC/ });
const WHY = "USDT can't be bought by card or bank on Base, so you buy USDC and it is converted as you pay.";
const row = (name: RegExp) => provider(name)!.closest('li') as HTMLElement;
/** The steps and whatever is opened beneath them. */
const stepBody = () => screen.getByRole('list', { name: 'The three steps to pay this' }).parentElement as HTMLElement;

/** What can be pressed or read as a button, top to bottom, without the copy-address icon. */
const buttons = () =>
  screen
    .getAllByRole('button')
    .filter((button) => !/copy/i.test(button.getAttribute('aria-label') ?? ''))
    .map((button) => ({ says: button.textContent, live: !(button as HTMLButtonElement).disabled }));

describe('a USDT request, wallet holding enough USDC', () => {
  it('lands on step 2: the USDC is already there, and one button swaps it and pays', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(steps().map((button) => button.textContent)).toEqual([
      '✓Step 1: Buy USDC',
      '2Step 2: Convert and pay',
      '3Step 3: Payment protected',
    ]);
    expect(current()).toEqual(['2Step 2: Convert and pay']);
    // The current step is opened beneath: the button that pays, and nothing to buy.
    expect(convertAndPay()).toBeEnabled();
    expect(convertAndPay()).toHaveTextContent('About 19.99 USDC, converted as you pay');
    expect(screen.queryByRole('button', { name: /^Continue with/ })).toBeNull();
  });

  it('pressing a step opens it: step 1 is done, step 3 follows by itself', () => {
    render(<PaymentActionPanel {...props()} />);
    expect(opened()).toEqual(['2Step 2: Convert and pay']);

    fireEvent.click(step(1));
    expect(opened()).toEqual(['✓Step 1: Buy USDC']);
    expect(screen.getByText('Done: you hold 25.00 USDC, enough to pay this.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay 20 USDT/ })).toBeNull();

    fireEvent.click(step(3));
    expect(screen.getByText('Nothing to do here: once step 2 is done, the payment is held until the release date above.')).toBeInTheDocument();

    // Still on step 2, whatever is open to look at; going back to it brings the button back.
    expect(current()).toEqual(['2Step 2: Convert and pay']);
    fireEvent.click(step(2));
    expect(convertAndPay()).toBeEnabled();
  });

  it('pressing step 2 only opens it: paying takes the button', () => {
    const onPay = jest.fn();
    render(<PaymentActionPanel {...props({ onPay })} />);
    fireEvent.click(step(2));
    expect(onPay).not.toHaveBeenCalled();
    fireEvent.click(convertAndPay());
    expect(onPay).toHaveBeenCalledTimes(1);
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

  /*
   * The second step used to be a sentence until the money arrived: the buyer set off having to
   * trust that the next thing would be revealed. All three are on screen from the start.
   */
  it('shows the whole way before the buyer sets off: buy USDC, convert and pay, protected', () => {
    render(<PaymentActionPanel {...short()} />);
    expect(screen.getByText(WHY)).toBeInTheDocument();
    expect(steps().map((button) => button.textContent)).toEqual([
      '1Step 1: Buy USDC',
      '2Step 2: Convert and pay',
      '3Step 3: Payment protected',
    ]);
    expect(current()).toEqual(['1Step 1: Buy USDC']);
    // The current step is opened beneath. 19.985028 plus 1%, up to the cent, is 20.19; the wallet holds 5.
    expect(screen.getByText('About 15.19 USDC by card or exchange, converted to USDT as you pay')).toBeInTheDocument();
    expect(provider(/Continue with Kraken/)).toBeEnabled();
    expect(row(/Continue with Kraken/)).toHaveTextContent('Card. Needs a Kraken account.');
    expect(row(/Continue with Coinbase/)).toHaveTextContent('Card or bank transfer. Needs a Coinbase account.');
    // Nothing goes straight to the payment: nobody sells USDT, and nothing could convert what they send.
    expect(screen.queryByText(/straight to this payment/i)).toBeNull();
    // Paying is not the open step, so the button that pays is not offered yet.
    expect(screen.queryByRole('button', { name: /Pay 20 USDT/ })).toBeNull();
  });

  /*
   * The whole way can be looked at before any of it is done. Step 2 opens to show the button that
   * will pay, exactly as it will be, greyed and not pressable, with what it is waiting for.
   */
  it('step 2 can be opened and looked at before it can be done: the real button, greyed, with why', () => {
    const onPay = jest.fn();
    render(<PaymentActionPanel {...short()} onPay={onPay} />);
    steps().forEach((button) => expect(button).toBeEnabled());
    expect(opened()).toEqual(['1Step 1: Buy USDC']);

    fireEvent.click(step(2));
    expect(opened()).toEqual(['2Step 2: Convert and pay']);
    expect(convertAndPay()).toBeDisabled();
    expect(convertAndPay()).toHaveTextContent('Your USDC is converted as you pay');
    expect(screen.getByRole('status')).toHaveTextContent('Finish step 1 first. This button works once the USDC is in your wallet.');
    fireEvent.click(convertAndPay());
    expect(onPay).not.toHaveBeenCalled();
    // The companies belong to step 1, which is still where the buyer is.
    expect(provider(/Continue with Kraken/)).toBeNull();
    expect(current()).toEqual(['1Step 1: Buy USDC']);

    fireEvent.click(step(3));
    expect(screen.getByText(/once step 2 is done, the payment is held until the release date above/)).toBeInTheDocument();

    fireEvent.click(step(1));
    expect(provider(/Continue with Kraken/)).toBeEnabled();
  });

  it('moves the buyer on to step 2, live, when the USDC arrives, whatever they had open', () => {
    const onPay = jest.fn();
    const { rerender } = render(<PaymentActionPanel {...short()} onPay={onPay} />);
    fireEvent.click(step(3));

    rerender(<PaymentActionPanel {...props({ onPay })} />);
    expect(step(1)).toHaveTextContent('✓');
    expect(current()).toEqual(['2Step 2: Convert and pay']);
    expect(opened()).toEqual(['2Step 2: Convert and pay']);
    expect(screen.queryByText(/Finish step 1 first/)).toBeNull();
    fireEvent.click(convertAndPay());
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  /*
   * Under "Crypto I already have" a USDT request can be paid with either coin. It used to offer
   * only "send USDT", with USDC as a collapsed line beneath: a buyer holding USDC and no USDT was
   * shown nothing they could do.
   */
  describe('with crypto they already hold', () => {
    const crypto = () => fireEvent.click(screen.getByRole('button', { name: /Crypto I already have/ }));
    const holds = (token: 'USDT' | 'USDC') =>
      within(screen.getByRole('group', { name: 'Which do you hold?' })).getByRole('button', { name: token });

    it('says on the answer itself that either coin will do', () => {
      render(<PaymentActionPanel {...short()} />);
      expect(screen.getByRole('button', { name: /Crypto I already have/ })).toHaveTextContent('USDT or USDC on Base');
    });

    it('asks which they hold, both in plain sight, and starts on USDT: sent straight to the payment', () => {
      render(<PaymentActionPanel {...short()} />);
      crypto();
      expect(steps().map((button) => button.textContent)).toEqual([
        '1Step 1: Send USDT or USDC',
        '2Step 2: I have paid',
        '3Step 3: Payment protected',
      ]);
      expect(holds('USDT')).toHaveAttribute('aria-pressed', 'true');
      expect(holds('USDC')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('the payment address panel')).toBeInTheDocument();
      // Not a collapsed line any more.
      expect(screen.queryByText(/Or add USDC to your wallet here/)).toBeNull();
    });

    it('holding USDC: it goes to this wallet, and step 2 is the button that converts and pays', () => {
      render(<PaymentActionPanel {...short()} />);
      crypto();
      fireEvent.click(holds('USDC'));

      expect(steps()[1]).toHaveTextContent('Step 2: Convert and pay');
      // 19.985028 plus 1%, up to the cent, is 20.19; the wallet holds 5.
      expect(
        screen.getByText('Send about 15.19 USDC to your wallet here. Then, in step 2, one button converts it and pays in USDT.')
      ).toBeInTheDocument();
      expect((within(stepBody()).getByLabelText('Your wallet address') as HTMLInputElement).value).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(screen.getByText('Send only USDC on Base. Funds sent on another network may be lost.')).toBeInTheDocument();
      // The payment's own address takes USDT only: it is not shown to someone sending USDC.
      expect(screen.queryByText('the payment address panel')).toBeNull();

      fireEvent.click(step(2));
      expect(convertAndPay()).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent('Finish step 1 first. This button works once the USDC is in your wallet.');
      expect(screen.getByRole('button', { name: "I've added it: check my balance" })).toBeInTheDocument();
      expect(screen.queryByText('the payment address panel')).toBeNull();
    });

    it('going back to USDT brings back the payment address and "I have paid"', () => {
      render(<PaymentActionPanel {...short()} />);
      crypto();
      fireEvent.click(holds('USDC'));
      fireEvent.click(holds('USDT'));
      expect(steps()[1]).toHaveTextContent('Step 2: I have paid');
      expect(screen.getByText('the payment address panel')).toBeInTheDocument();
    });
  });

  it('buys USDC, not USDT: the cost plus a margin, less what is already held', () => {
    render(<PaymentActionPanel {...short()} />);
    fireEvent.click(provider(/Continue with Kraken/)!);
    const url = new URL(open.mock.calls[0][0]);
    expect(url.searchParams.get('crypto')).toBe('USDC');
    expect(url.searchParams.get('amount')).toBe('15.19');
    // On to step 2: the button that will convert and pay, greyed, and where the USDC has to land.
    expect(opened()).toEqual(['2Step 2: Convert and pay']);
    expect(convertAndPay()).toBeDisabled();
    expect(stepBody()).toHaveTextContent('Finish step 1 first. This button works once the USDC is in your wallet.');
    expect((within(stepBody()).getByLabelText('Your wallet address') as HTMLInputElement).value).toBe('0x1234567890abcdef1234567890abcdef12345678');
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
  it('says it is checking the price, and offers no purchase it cannot yet size', () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ cost: null, status: 'quoting' }) })} />);
    expect(screen.getByText('Checking what it costs to convert your USDC…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Continue with/ })).toBeNull();
    fireEvent.click(step(2));
    expect(convertAndPay()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Checking what it costs to convert your USDC…');
    // One row of steps on screen at a time: what it holds elsewhere is the other answer, beside this one.
    expect(screen.getAllByRole('list', { name: 'The three steps to pay this' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Crypto I already have/ }));
    expect(screen.getByText('the payment address panel')).toBeInTheDocument();
  });

  it('does not sell USDC for a conversion that cannot be made, and says why the wallet cannot pay', () => {
    const onPay = jest.fn();
    render(<PaymentActionPanel {...props({ onPay, conversion: conversion({ fromBalance: 0, cost: null, status: 'unavailable' }) })} />);
    expect(screen.getByText(/can't be converted to USDT right now/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Continue with/ })).toBeNull();
    // Opened, step 2 gives the real reason, not "buy USDC first": buying more would not help.
    fireEvent.click(step(2));
    expect(convertAndPay()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/can't be converted to USDT right now/);
    expect(screen.getAllByRole('list', { name: 'The three steps to pay this' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Crypto I already have/ }));
    expect(screen.getByText('the payment address panel')).toBeInTheDocument();
  });

  it("a seller's preview shows the three steps with nothing live in them", () => {
    render(<PaymentActionPanel {...props({ conversion: conversion({ fromBalance: 5, status: 'short' }) })} preview />);
    expect(screen.getByText(WHY)).toBeInTheDocument();
    // A seller can open each step to see it; nothing inside one does anything.
    expect(provider(/Continue with Kraken/)).toBeDisabled();
    fireEvent.click(step(2));
    expect(convertAndPay()).toBeDisabled();
    expect(screen.queryByRole('status')).toBeNull();
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
