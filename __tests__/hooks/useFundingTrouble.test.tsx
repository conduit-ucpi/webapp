/**
 * The one place that works out a purchase went wrong, for every way of buying: the card window
 * says so itself; anything else is asked about when the buyer comes back, or after a reload; and
 * a purchase on its way for five minutes with nothing arrived is "stuck".
 */
import { act, renderHook } from '@testing-library/react';
import { useFundingTrouble, type LookForPurchase, type TroubledProvider } from '@/hooks/useFundingTrouble';
import { markPurchaseOpened } from '@/lib/purchaseMarker';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const KRAKEN = { logged: 'Kraken', name: 'Kraken', route: 'wallet' as const };
const CARD = { logged: 'Privy', route: 'wallet' as const, inPage: true };

type Given = { off?: boolean; funded?: boolean; look?: LookForPurchase };
const setUp = (props: Given = { funded: false }) =>
  renderHook((given: Given) => useFundingTrouble({ walletAddress: WALLET, ...given }), { initialProps: props });
/** The buyer is away for `ms`, then back on this page. */
const awayFor = (ms: number) => {
  act(() => {
    window.dispatchEvent(new Event('blur'));
    jest.advanceTimersByTime(ms);
    window.dispatchEvent(new Event('focus'));
  });
};
const wait = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
});
afterEach(() => jest.useRealTimers());

describe("a company's own page, which tells us nothing", () => {
  it('asks how it went when the buyer comes back', () => {
    const { result } = setUp();
    act(() => result.current.opened(KRAKEN));
    expect(result.current.current).toBeNull();
    awayFor(60_000);
    wait(1000);
    expect(result.current.current).toEqual({ kind: 'returned', provider: KRAKEN });
  });

  it('does not ask a buyer who was gone a few seconds, and still asks when they have really been', () => {
    const { result } = setUp();
    act(() => result.current.opened(KRAKEN));
    awayFor(2000);
    wait(1000);
    expect(result.current.current).toBeNull();
    awayFor(60_000);
    wait(1000);
    expect(result.current.current?.kind).toBe('returned');
  });

  it('asks nobody when the company says the purchase was made, and waits for it instead', () => {
    const { result } = setUp();
    act(() => result.current.opened(KRAKEN));
    act(() => {
      window.dispatchEvent(new Event('blur'));
      jest.advanceTimersByTime(60_000);
      window.dispatchEvent(new Event('focus'));
      result.current.reportedBack();
    });
    wait(1000);
    expect(result.current.current).toBeNull();
    wait(5 * 60_000);
    expect(result.current.current).toEqual({ kind: 'stuck', provider: KRAKEN });
  });

  it('asks nothing when it could not be opened after all', () => {
    const { result } = setUp();
    act(() => result.current.opened(KRAKEN));
    act(() => result.current.notOpened());
    awayFor(60_000);
    wait(1000);
    expect(result.current.current).toBeNull();
  });
});

describe('the card window, which reports back', () => {
  it.each(['cancelled', 'failed'] as const)('is trouble at once when it ends %s, and nobody is asked on a return', (status) => {
    const { result } = setUp();
    act(() => result.current.opened(CARD));
    awayFor(60_000);
    wait(1000);
    expect(result.current.current).toBeNull();
    act(() => result.current.cardEnded(status));
    expect(result.current.current).toEqual({ kind: status, provider: { logged: 'Privy', route: 'wallet' } });
  });

  it('is stuck when a purchase still processing has not arrived in five minutes', () => {
    const { result } = setUp();
    act(() => result.current.opened(CARD));
    act(() => result.current.cardEnded('processing'));
    wait(5 * 60_000 - 1);
    expect(result.current.current).toBeNull();
    wait(1);
    expect(result.current.current?.kind).toBe('stuck');
  });

  it('is nothing when it completes', () => {
    const { result } = setUp();
    act(() => result.current.opened(CARD));
    act(() => result.current.cardEnded('completed'));
    wait(10 * 60_000);
    expect(result.current.current).toBeNull();
  });
});

it('starts the five minutes when the buyer says a purchase into the wallet went through, not one into the payment', () => {
  const { result } = setUp();
  act(() => result.current.awaitArrival({ logged: 'Kraken', name: 'Kraken', route: 'payment' }));
  wait(5 * 60_000);
  expect(result.current.current).toBeNull();
  act(() => result.current.awaitArrival(KRAKEN));
  wait(5 * 60_000);
  expect(result.current.current?.kind).toBe('stuck');
});

it('ends all of it when the money is in the wallet', () => {
  const { result, rerender } = setUp();
  act(() => result.current.opened(CARD));
  act(() => result.current.cardEnded('failed'));
  expect(result.current.current?.kind).toBe('failed');
  rerender({ funded: true });
  expect(result.current.current).toBeNull();
});

it('is never stuck on a screen that cannot tell whether the money arrived', () => {
  const { result } = setUp({});
  act(() => result.current.opened(CARD));
  act(() => result.current.cardEnded('processing'));
  wait(10 * 60_000);
  expect(result.current.current).toBeNull();
});

it('asks on a page loaded while a way of buying was open, naming it', () => {
  markPurchaseOpened(WALLET, KRAKEN);
  const { result } = setUp();
  expect(result.current.current).toEqual({ kind: 'returned', provider: KRAKEN });
});

it('does nothing at all when off', () => {
  markPurchaseOpened(WALLET, KRAKEN);
  const { result } = setUp({ off: true, funded: false });
  expect(result.current.current).toBeNull();
  act(() => result.current.opened(KRAKEN));
  awayFor(60_000);
  wait(1000);
  expect(result.current.current).toBeNull();
});

describe('looking before asking, where the screen can look', () => {
  /** What is there at each look, in order: the first is the look when it is opened. */
  const lookFinding = (...held: (number | null)[]) => {
    const look = jest.fn(async () => {
      const next = held.length > 1 ? held.shift()! : held[0];
      return next === null ? null : { held: next, needed: 20 };
    });
    return look as unknown as LookForPurchase & jest.Mock;
  };
  /** Away a minute and back, and everything the page then does has settled. */
  const backAfterBuying = async () => {
    awayFor(60_000);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
  };
  const open = async (result: { current: ReturnType<typeof useFundingTrouble> }, provider: TroubledProvider = KRAKEN) => {
    await act(async () => {
      result.current.opened(provider);
    });
  };

  it('says nothing at all when the money is there', async () => {
    const { result } = setUp({ funded: false, look: lookFinding(0, 20) });
    await open(result);
    await backAfterBuying();
    expect(result.current.current).toBeNull();
  });

  it('says it arrived short, with the figures, when more is there than before but not enough', async () => {
    const { result } = setUp({ funded: false, look: lookFinding(2, 19.2) });
    await open(result);
    await backAfterBuying();
    expect(result.current.current).toEqual({ kind: 'short', provider: KRAKEN, seen: { held: 19.2, needed: 20 } });
  });

  it('asks how it went, saying it is not there yet, when nothing new has arrived', async () => {
    const { result } = setUp({ funded: false, look: lookFinding(2, 2) });
    await open(result);
    await backAfterBuying();
    expect(result.current.current).toEqual({ kind: 'returned', provider: KRAKEN, seen: { held: 2, needed: 20 } });
  });

  it('asks without figures when it could not look', async () => {
    const { result } = setUp({ funded: false, look: lookFinding(0, null) });
    await open(result);
    await backAfterBuying();
    expect(result.current.current).toEqual({ kind: 'returned', provider: KRAKEN, seen: undefined });
  });

  it("takes anything at a payment's own address as arrived, with nothing to compare it with", async () => {
    const PAYMENT = { logged: 'Kraken', name: 'Kraken', route: 'payment' as const };
    const { result } = setUp({ funded: false, look: lookFinding(null, 19.2) });
    await open(result, PAYMENT);
    await backAfterBuying();
    expect(result.current.current?.kind).toBe('short');
  });

  it('waits for a purchase the company says was made and that is not here yet, and says so when it arrives short', async () => {
    // Opened (0), reported back (0), opened again (0), reported back (19.2).
    const { result } = setUp({ funded: false, look: lookFinding(0, 0, 0, 19.2) });
    await open(result);
    await act(async () => {
      result.current.reportedBack();
    });
    expect(result.current.current).toBeNull();
    wait(5 * 60_000);
    expect(result.current.current?.kind).toBe('stuck');
    await open(result);
    await act(async () => {
      result.current.reportedBack();
    });
    expect(result.current.current?.kind).toBe('short');
  });

  describe('with no payment to measure against (/wallet)', () => {
    const walletHolding = (...held: number[]) =>
      jest.fn(async () => ({ held: held.length > 1 ? held.shift()! : held[0] })) as unknown as LookForPurchase;

    it('says nothing when more is in the wallet than before: it arrived', async () => {
      const { result } = setUp({ look: walletHolding(5, 55) });
      await open(result);
      await backAfterBuying();
      expect(result.current.current).toBeNull();
    });

    it('says it cannot see it when the wallet holds what it did', async () => {
      const { result } = setUp({ look: walletHolding(5, 5) });
      await open(result);
      await backAfterBuying();
      expect(result.current.current).toEqual({ kind: 'returned', provider: KRAKEN, seen: { held: 5 } });
    });
  });

  it('on a page just loaded, keeps trying to look until it can, and compares with what the note says was held', async () => {
    markPurchaseOpened(WALLET, KRAKEN, 2);
    const look = lookFinding(null, null, 19.2);
    const { result } = setUp({ funded: false, look });
    expect(result.current.current).toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4000);
    });
    expect(look).toHaveBeenCalledTimes(3);
    expect(result.current.current).toEqual({ kind: 'short', provider: KRAKEN, seen: { held: 19.2, needed: 20 } });
  });

  it('drops what it was working out when the money turns up meanwhile', async () => {
    markPurchaseOpened(WALLET, KRAKEN, 2);
    const { result, rerender } = setUp({ funded: false, look: lookFinding(null) });
    rerender({ funded: true, look: lookFinding(null) });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.current).toBeNull();
  });
});
