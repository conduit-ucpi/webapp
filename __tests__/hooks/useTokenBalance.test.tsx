/**
 * TDD spec for useTokenBalance — the read-only token-balance fetch extracted
 * from contract-create.tsx and contract-pay.tsx.
 *
 * Behavior being locked (identical in both pages, modulo the enable gate):
 *  - when enabled (address + tokenAddress + rpc present, page-specific gate),
 *    fetches the balance via getTokenBalance and exposes it as a string
 *  - exposes isLoadingBalance around the fetch
 *  - on error, sets balance to '0' (never throws)
 *  - does NOT fetch while disabled
 *  - re-renders that only change getTokenBalance identity do NOT re-fetch
 *    (loop-prevention: getTokenBalance excluded from deps)
 *  - refetch() re-runs the fetch on demand
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useTokenBalance } from '@/hooks/useTokenBalance';

describe('useTokenBalance', () => {
  let getTokenBalance: jest.Mock;

  const params = (overrides = {}) => ({
    enabled: true,
    address: '0xUser',
    tokenAddress: '0xToken',
    getTokenBalance,
    ...overrides,
  });

  beforeEach(() => {
    getTokenBalance = jest.fn().mockResolvedValue('42.5');
  });

  afterEach(() => jest.clearAllMocks());

  it('fetches and exposes the balance when enabled', async () => {
    const { result } = renderHook(() => useTokenBalance(params()));
    await waitFor(() => expect(result.current.tokenBalance).toBe('42.5'));
    expect(getTokenBalance).toHaveBeenCalledWith('0xUser', '0xToken');
  });

  it('starts with a "0" balance before the fetch resolves', () => {
    getTokenBalance.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useTokenBalance(params()));
    expect(result.current.tokenBalance).toBe('0');
  });

  it('does not fetch when disabled', async () => {
    renderHook(() => useTokenBalance(params({ enabled: false })));
    await new Promise((r) => setTimeout(r, 50));
    expect(getTokenBalance).not.toHaveBeenCalled();
  });

  it('does not fetch when address or tokenAddress is missing', async () => {
    renderHook(() => useTokenBalance(params({ address: undefined })));
    await new Promise((r) => setTimeout(r, 50));
    expect(getTokenBalance).not.toHaveBeenCalled();
  });

  it('sets balance to "0" and does not throw when the fetch rejects', async () => {
    getTokenBalance.mockRejectedValue(new Error('rpc down'));
    const { result } = renderHook(() => useTokenBalance(params()));
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalled());
    expect(result.current.tokenBalance).toBe('0');
  });

  it('exposes isLoadingBalance=false after the fetch settles', async () => {
    const { result } = renderHook(() => useTokenBalance(params()));
    await waitFor(() => expect(result.current.isLoadingBalance).toBe(false));
    expect(result.current.tokenBalance).toBe('42.5');
  });

  it('does not re-fetch when only getTokenBalance identity changes (loop-prevention)', async () => {
    const { rerender } = renderHook((props) => useTokenBalance(props), {
      initialProps: params(),
    });
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(1));

    // useSimpleEthers returns a fresh object every render — a new getTokenBalance
    // identity must NOT re-trigger the effect (that was the balance-flash loop).
    const newGetBalance = jest.fn().mockResolvedValue('42.5');
    rerender(params({ getTokenBalance: newGetBalance }));
    await new Promise((r) => setTimeout(r, 50));
    expect(newGetBalance).not.toHaveBeenCalled();
    expect(getTokenBalance).toHaveBeenCalledTimes(1);
  });

  it('refetch() triggers a fresh balance read', async () => {
    const { result } = renderHook(() => useTokenBalance(params()));
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(1));

    getTokenBalance.mockResolvedValue('100');
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.tokenBalance).toBe('100');
    expect(getTokenBalance).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when the gating inputs change (e.g. tokenAddress)', async () => {
    const { rerender } = renderHook((props) => useTokenBalance(props), {
      initialProps: params(),
    });
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(1));

    rerender(params({ tokenAddress: '0xOtherToken' }));
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(2));
    expect(getTokenBalance).toHaveBeenLastCalledWith('0xUser', '0xOtherToken');
  });
});
