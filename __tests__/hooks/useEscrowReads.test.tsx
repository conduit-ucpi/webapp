/**
 * Reading what escrows will actually pay out.
 *
 * The stored `amount` is the GROSS. The recipient collects `AMOUNT − CREATOR_FEE`, which the
 * escrow exposes as `payoutAmount()`. Every screen that shows a seller the gross overstates
 * what they are owed — and it is the figure they weigh an early-payment offer against, so the
 * error flatters waiting and understates the offer.
 *
 * The behaviour worth pinning is what happens when a read FAILS: an absent entry, never a
 * zero, so the caller can fall back to the gross and say so rather than confidently showing
 * the wrong number — or worse, showing nothing owed at all.
 */

import { renderHook, waitFor } from '@testing-library/react';

const getPayoutAmount = jest.fn();
const getEscrowTerms = jest.fn();
jest.mock('@/lib/rpc/RpcClient', () => ({
  RpcClient: jest.fn().mockImplementation(() => ({ getPayoutAmount, getEscrowTerms })),
}));

import { usePayoutAmounts, useEscrowMaturities } from '@/hooks/useEscrowReads';
import { RpcClient } from '@/lib/rpc/RpcClient';

const A = '0xaaa1111111111111111111111111111111111111';
const B = '0xbbb2222222222222222222222222222222222222';
const RPC = 'https://rpc.example';

describe('usePayoutAmounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('reads the payout for each escrow', async () => {
    getPayoutAmount.mockImplementation(async (address: string) =>
      address === A ? BigInt(99_000_000) : BigInt(49_500_000)
    );

    const { result } = renderHook(() => usePayoutAmounts([A, B], RPC));

    await waitFor(() => expect(Object.keys(result.current.payouts)).toHaveLength(2));
    expect(result.current.payouts[A]).toBe(BigInt(99_000_000));
    expect(result.current.payouts[B]).toBe(BigInt(49_500_000));
    expect(result.current.unavailable).toEqual([]);
  });

  describe('when a read fails', () => {
    it('omits it rather than reporting zero', async () => {
      // A zero here would render as "$0.00 owed to you" on a funded escrow — worse than the
      // gross it replaced, because it is not obviously wrong.
      getPayoutAmount.mockImplementation(async (address: string) => {
        if (address === B) throw new Error('rpc down');
        return BigInt(99_000_000);
      });

      const { result } = renderHook(() => usePayoutAmounts([A, B], RPC));

      await waitFor(() => expect(result.current.unavailable).toEqual([B]));
      expect(result.current.payouts[A]).toBe(BigInt(99_000_000));
      expect(result.current.payouts).not.toHaveProperty(B);
    });

    it('still returns the ones that succeeded', async () => {
      getPayoutAmount.mockRejectedValue(new Error('rpc down'));

      const { result } = renderHook(() => usePayoutAmounts([A, B], RPC));

      await waitFor(() => expect(result.current.unavailable).toHaveLength(2));
      expect(result.current.payouts).toEqual({});
    });
  });

  describe('when it should not read at all', () => {
    it('does nothing without an RPC URL', () => {
      renderHook(() => usePayoutAmounts([A], undefined));

      expect(RpcClient).not.toHaveBeenCalled();
      expect(getPayoutAmount).not.toHaveBeenCalled();
    });

    it('does nothing with no addresses', () => {
      renderHook(() => usePayoutAmounts([], RPC));

      expect(getPayoutAmount).not.toHaveBeenCalled();
    });
  });

  it('does not re-read when the caller passes a new array of the same addresses', async () => {
    // Call sites build this array inline, so a fresh identity arrives every render. Keying the
    // effect on identity would turn one list into an unbounded stream of RPC calls.
    getPayoutAmount.mockResolvedValue(BigInt(99_000_000));

    const { result, rerender } = renderHook(({ addresses }) => usePayoutAmounts(addresses, RPC), {
      initialProps: { addresses: [A] },
    });

    await waitFor(() => expect(result.current.payouts[A]).toBeDefined());
    const callsAfterFirst = getPayoutAmount.mock.calls.length;

    rerender({ addresses: [A] });
    rerender({ addresses: [A] });

    expect(getPayoutAmount.mock.calls.length).toBe(callsAfterFirst);
  });

  it('re-reads when the addresses actually change', async () => {
    getPayoutAmount.mockResolvedValue(BigInt(99_000_000));

    const { rerender } = renderHook(({ addresses }) => usePayoutAmounts(addresses, RPC), {
      initialProps: { addresses: [A] },
    });

    await waitFor(() => expect(getPayoutAmount).toHaveBeenCalledTimes(1));

    rerender({ addresses: [A, B] });

    await waitFor(() => expect(getPayoutAmount).toHaveBeenCalledTimes(3));
  });
});


/**
 * Maturity per escrow.
 *
 * It is the LP's primary risk metric — the remaining dispute window, during which the position
 * can still be taken from them — and it is not on OfferView, because the book indexes the offer
 * and maturity belongs to the escrow underneath.
 */
describe('useEscrowMaturities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('reads the expiry off each escrow', async () => {
    getEscrowTerms.mockImplementation(async (address: string) => ({
      expiryTimestamp: address === A ? BigInt(1_800_000_000) : BigInt(1_900_000_000),
    }));

    const { result } = renderHook(() => useEscrowMaturities([A, B], RPC));

    await waitFor(() => expect(Object.keys(result.current.maturities)).toHaveLength(2));
    expect(result.current.maturities[A]).toBe(1_800_000_000);
    expect(result.current.maturities[B]).toBe(1_900_000_000);
  });

  it('omits an escrow it could not read rather than dating it to the epoch', async () => {
    // A zero here renders as 01/01/1970 — a maturity date that looks like data rather than
    // like an error, on the field an LP prices risk with.
    getEscrowTerms.mockRejectedValue(new Error('rpc down'));

    const { result } = renderHook(() => useEscrowMaturities([A], RPC));

    await waitFor(() => expect(result.current.unavailable).toEqual([A]));
    expect(result.current.maturities).toEqual({});
  });
});
