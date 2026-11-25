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
