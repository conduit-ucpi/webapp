/**
 * "I have paid" pressed is logged (pages/api/funding-event) with what the payment's address showed
 * when it was looked at: not funded yet, activated, refunded, or funded but not activated.
 */
import { renderHook, act } from '@testing-library/react';
import { useQrPayment } from '@/hooks/useQrPayment';
import { reportFundingEvent } from '@/lib/reportFundingEvent';

jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));

const fetchAnswering = (body: unknown) => jest.fn().mockResolvedValue({ json: async () => body });

const setUp = (balance: string, answer: unknown) =>
  renderHook(() =>
    useQrPayment({
      authenticatedFetch: fetchAnswering(answer),
      getTokenBalance: jest.fn().mockResolvedValue(balance),
      selectedTokenAddress: '0xToken',
      chainId: 8453,
      requiredAmount: 10,
      requiredAmountMicro: 10_000_000,
      createContract: jest.fn().mockResolvedValue('0xEscrow'),
      onActivated: jest.fn(),
      activation: { endpoint: '/api/chain/activate', buildBody: () => ({}) },
    })
  );

const press = async (balance: string, answer: unknown) => {
  const { result } = setUp(balance, answer);
  await act(async () => {
    await result.current.createContract();
  });
  (reportFundingEvent as jest.Mock).mockClear();
  await act(async () => {
    await result.current.checkAndActivate();
  });
  return (reportFundingEvent as jest.Mock).mock.calls;
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

it.each([
  ['0', { success: false }, 'not-funded'],
  ['10', { success: true }, 'activated'],
  ['10', { success: false, refunded: true }, 'refunded'],
  ['10', { success: false }, 'not-activated'],
])('logs the press with what it found (balance %s)', async (balance, answer, outcome) => {
  expect(await press(balance, answer)).toEqual([
    ['paid-pressed', { wallet: '0xEscrow', amount: '10', route: 'payment', detail: outcome }],
  ]);
});

describe("the page's own looks at the payment's address", () => {
  const polled = () =>
    (reportFundingEvent as jest.Mock).mock.calls.filter(([name]) => name === 'address-polled').map(([, fields]) => fields);

  it('logs each look and what it found', async () => {
    const { result } = setUp('4', { success: false });
    await act(async () => {
      await result.current.createContract();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(polled()).toEqual([
      { wallet: '0xEscrow', amount: '10', route: 'payment', detail: 'check 1, 0s since opening: 4.00 of 10.00, short' },
      { wallet: '0xEscrow', amount: '10', route: 'payment', detail: 'check 2, 10s since opening: 4.00 of 10.00, short' },
    ]);
  });

  it('says when the schedule has run out and the page is waiting for "I have paid"', async () => {
    const { result } = setUp('0', { success: false });
    await act(async () => {
      await result.current.createContract();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(8 * 60_000);
    });
    expect(polled().at(-1)?.detail).toMatch(/: 0\.00 of 10\.00, short, last check: waiting for "I have paid"$/);
  });

  it('says so when the money is there', async () => {
    const { result } = setUp('10', { success: true });
    await act(async () => {
      await result.current.createContract();
    });
    expect(polled()[0].detail).toBe('check 1, 0s since opening: 10.00 of 10.00, arrived');
  });
});

describe("looking at the payment's address when the buyer is back from buying", () => {
  const polled = () =>
    (reportFundingEvent as jest.Mock).mock.calls.filter(([name]) => name === 'address-polled').map(([, fields]) => fields.detail);

  it('says how much is there, and logs the look', async () => {
    const { result } = setUp('4', { success: false });
    await act(async () => {
      await result.current.createContract();
    });
    (reportFundingEvent as jest.Mock).mockClear();
    let held: number | null = null;
    await act(async () => {
      held = await result.current.lookNow();
    });
    expect(held).toBe(4);
    expect(polled()).toEqual(["on the buyer's return: 4.00 of 10.00, short"]);
  });

  it('is null before there is an address to look at', async () => {
    const { result } = setUp('4', { success: false });
    await expect(result.current.lookNow()).resolves.toBeNull();
  });
});
