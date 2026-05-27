/**
 * TDD spec for useLazyUserData — the lazy-auth one-shot user-data fetch
 * extracted verbatim from contract-create.tsx and contract-pay.tsx.
 *
 * Behavior being locked (identical in both pages today):
 *  - fires refreshUserData() exactly once, only when a wallet is connected
 *    (isConnected || address) AND there is no user yet
 *  - never fires again once attempted (one-shot guard), even across re-renders
 *  - does NOT fire when user is already present
 *  - swallows refreshUserData rejection (proceeds without user data)
 *
 * The loop-prevention contract (refreshUserData intentionally excluded from the
 * effect deps so its identity churn during the auth flow cannot re-fire the
 * effect) is verified indirectly: re-rendering with a new refreshUserData
 * identity must NOT trigger another call.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useLazyUserData } from '@/hooks/useLazyUserData';

describe('useLazyUserData', () => {
  let refreshUserData: jest.Mock;

  beforeEach(() => {
    refreshUserData = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => jest.clearAllMocks());

  it('fetches once when connected and no user is present', async () => {
    renderHook(() =>
      useLazyUserData({ isConnected: true, address: '0xabc', user: null, refreshUserData })
    );
    await waitFor(() => expect(refreshUserData).toHaveBeenCalledTimes(1));
  });

  it('fetches when address is present even if isConnected is false (lazy auth)', async () => {
    renderHook(() =>
      useLazyUserData({ isConnected: false, address: '0xabc', user: null, refreshUserData })
    );
    await waitFor(() => expect(refreshUserData).toHaveBeenCalledTimes(1));
  });

  it('does not fetch when neither connected nor an address is available', async () => {
    renderHook(() =>
      useLazyUserData({ isConnected: false, address: null, user: null, refreshUserData })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(refreshUserData).not.toHaveBeenCalled();
  });

  it('does not fetch when a user is already present', async () => {
    renderHook(() =>
      useLazyUserData({
        isConnected: true,
        address: '0xabc',
        user: { email: 'x@y.com' },
        refreshUserData,
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(refreshUserData).not.toHaveBeenCalled();
  });

  it('only fetches once across re-renders (one-shot guard)', async () => {
    const { rerender } = renderHook((props) => useLazyUserData(props), {
      initialProps: { isConnected: true, address: '0xabc', user: null, refreshUserData },
    });
    await waitFor(() => expect(refreshUserData).toHaveBeenCalledTimes(1));

    // Re-render with the SAME inputs — must not fetch again.
    rerender({ isConnected: true, address: '0xabc', user: null, refreshUserData });
    await new Promise((r) => setTimeout(r, 50));
    expect(refreshUserData).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch when refreshUserData identity changes (loop-prevention)', async () => {
    const { rerender } = renderHook((props) => useLazyUserData(props), {
      initialProps: { isConnected: true, address: '0xabc', user: null, refreshUserData },
    });
    await waitFor(() => expect(refreshUserData).toHaveBeenCalledTimes(1));

    // Simulate the auth flow recreating refreshUserData. A new identity must
    // NOT re-fire the one-shot fetch (this is the regression that caused 401 storms).
    const newRefresh = jest.fn().mockResolvedValue(undefined);
    rerender({ isConnected: true, address: '0xabc', user: null, refreshUserData: newRefresh });
    await new Promise((r) => setTimeout(r, 50));
    expect(newRefresh).not.toHaveBeenCalled();
    expect(refreshUserData).toHaveBeenCalledTimes(1);
  });

  it('swallows a refreshUserData rejection without throwing', async () => {
    const rejecting = jest.fn().mockRejectedValue(new Error('auth failed'));
    renderHook(() =>
      useLazyUserData({ isConnected: true, address: '0xabc', user: null, refreshUserData: rejecting })
    );
    await waitFor(() => expect(rejecting).toHaveBeenCalledTimes(1));
    // No assertion needed beyond "did not throw" — the test failing/erroring
    // would surface an unhandled rejection.
  });

  it('tolerates an undefined refreshUserData (optional)', async () => {
    renderHook(() =>
      useLazyUserData({ isConnected: true, address: '0xabc', user: null, refreshUserData: undefined })
    );
    await new Promise((r) => setTimeout(r, 50));
    // Reaching here without throwing is the assertion.
    expect(true).toBe(true);
  });
});
