/**
 * useFeeQuote asks the escrow factory for its fee (via /api/fee-quote) and never works one out.
 */
import { act, renderHook } from '@testing-library/react';
import { useFeeQuote } from '@/hooks/useFeeQuote';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      supportedTokens: [
        { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      ],
    },
  }),
}));

const answer = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe('useFeeQuote', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => jest.useRealTimers());

  async function settle() {
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
  }

  it("asks for the amount in the token's base units and shows the factory's fee", async () => {
    fetchMock.mockResolvedValue(answer(200, { success: true, creatorFee: '25000000', amountTooSmall: false }));
    const { result } = renderHook(() => useFeeQuote(2500, 'USDC'));
    expect(result.current.state).toBe('loading');

    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/fee-quote$/);
    expect(JSON.parse(init.body)).toEqual({
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amount: '2500000000',
    });
    expect(result.current).toEqual({ state: 'quoted', fee: 25 });
  });

  it('says too small where the factory would refuse the escrow', async () => {
    fetchMock.mockResolvedValue(answer(200, { success: true, creatorFee: null, amountTooSmall: true }));
    const { result } = renderHook(() => useFeeQuote(0.2, 'USDC'));
    await settle();
    expect(result.current).toEqual({ state: 'tooSmall' });
  });

  it('shows no figure at all when the chain cannot be asked', async () => {
    fetchMock.mockResolvedValue(answer(503, { success: false, error: 'timeout' }));
    const { result } = renderHook(() => useFeeQuote(100, 'USDC'));
    await settle();
    expect(result.current).toEqual({ state: 'unavailable' });
  });

  it('asks once for a run of keystrokes, not once per key', async () => {
    fetchMock.mockResolvedValue(answer(200, { success: true, creatorFee: '12500000', amountTooSmall: false }));
    const { rerender } = renderHook(({ amount }) => useFeeQuote(amount, 'USDC'), {
      initialProps: { amount: 1 as number | null },
    });
    rerender({ amount: 12 });
    rerender({ amount: 125 });
    rerender({ amount: 1250 });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).amount).toBe('1250000000');
  });

  it('asks nothing for an empty amount', async () => {
    const { result } = renderHook(() => useFeeQuote(null, 'USDC'));
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ state: 'idle' });
  });
});
