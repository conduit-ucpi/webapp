/**
 * TDD spec for usePayableContract — pay's fetch-contract-by-id effect extracted
 * from contract-pay.tsx. Returns { contract, isLoadingContract, contractError }.
 *
 * Behavior locked (verbatim from the prior inline effect):
 *  - no contractId / not connected / no authenticatedFetch → no fetch, loading
 *    cleared to false
 *  - happy path → GET /api/contracts/:id, sets contract
 *  - already-paid (response has contractAddress) → contractError, contract null
 *  - expired (expiryTimestamp in the past, non-zero) → contractError
 *  - non-ok response → contractError from the error body
 *  - one-shot per contractId: re-render with same id does NOT refetch
 *  - loop-prevention: a new authenticatedFetch identity does NOT refetch
 */

import { renderHook, waitFor } from '@testing-library/react';
import { usePayableContract } from '@/hooks/usePayableContract';

const ok = (body: any) => ({ ok: true, json: async () => body });
const notOk = (body: any) => ({ ok: false, json: async () => body });

const future = Math.floor(Date.now() / 1000) + 86400;
const past = Math.floor(Date.now() / 1000) - 86400;

const validContract = {
  id: 'c1',
  sellerAddress: '0xSeller',
  amount: 10_000_000,
  expiryTimestamp: future,
  description: 'Test',
  currency: 'microUSDC',
};

describe('usePayableContract', () => {
  let authenticatedFetch: jest.Mock;

  const params = (overrides = {}) => ({
    contractId: 'c1',
    isConnected: true,
    address: '0xBuyer',
    authenticatedFetch,
    ...overrides,
  });

  beforeEach(() => {
    authenticatedFetch = jest.fn().mockResolvedValue(ok(validContract));
  });

  afterEach(() => jest.clearAllMocks());

  it('does not fetch and clears loading when contractId is absent', async () => {
    const { result } = renderHook(() => usePayableContract(params({ contractId: undefined })));
    await waitFor(() => expect(result.current.isLoadingContract).toBe(false));
    expect(authenticatedFetch).not.toHaveBeenCalled();
    expect(result.current.contract).toBeNull();
  });

  it('does not fetch when neither connected nor an address is available', async () => {
    const { result } = renderHook(() =>
      usePayableContract(params({ isConnected: false, address: null }))
    );
    await waitFor(() => expect(result.current.isLoadingContract).toBe(false));
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when authenticatedFetch is unavailable', async () => {
    const { result } = renderHook(() => usePayableContract(params({ authenticatedFetch: undefined })));
    await waitFor(() => expect(result.current.isLoadingContract).toBe(false));
  });

  it('fetches the contract and exposes it on the happy path', async () => {
    const { result } = renderHook(() => usePayableContract(params()));
    await waitFor(() => expect(result.current.contract).toEqual(validContract));
    expect(authenticatedFetch).toHaveBeenCalledWith('/api/contracts/c1', { method: 'GET' });
    expect(result.current.contractError).toBeNull();
    expect(result.current.isLoadingContract).toBe(false);
  });

  it('does not decide whether a deployed contract is already paid', async () => {
    // This endpoint returns the stored record, which has no status field — only
    // `state`, which is "OK" for everything. Guessing from the presence of a
    // chain address called a funded-but-unswept escrow "paid" and hid the only
    // route to the sweep. Whether the money landed is a chain fact, read by the
    // page from the escrow itself.
    const deployed = { ...validContract, chainAddress: '0xdeployed' };
    authenticatedFetch.mockResolvedValue(ok(deployed));

    const { result } = renderHook(() => usePayableContract(params()));

    await waitFor(() => expect(result.current.contract).toEqual(deployed));
    expect(result.current.contractError).toBeNull();
  });

  it('lets a deployed contract through while it is still awaiting funds', async () => {
    // The escrow exists but the money is not in it yet, or is in it unswept —
    // both routes deploy first and fund after. Calling that "paid" stranded the
    // payer with funds sitting in a contract and no way to reach the sweep.
    const awaitingFunding = { ...validContract, chainAddress: '0xdeployed', status: 'AWAITING_FUNDING' };
    authenticatedFetch.mockResolvedValue(ok(awaitingFunding));

    const { result } = renderHook(() => usePayableContract(params()));

    await waitFor(() => expect(result.current.contract).toEqual(awaitingFunding));
    expect(result.current.contractError).toBeNull();
  });



  it('reports "expired" when expiryTimestamp is in the past', async () => {
    authenticatedFetch.mockResolvedValue(ok({ ...validContract, expiryTimestamp: past }));
    const { result } = renderHook(() => usePayableContract(params()));
    await waitFor(() => expect(result.current.contractError).toBe('This payment request has expired.'));
    expect(result.current.contract).toBeNull();
  });

  it('does NOT treat an instant-payment contract (expiry 0) as expired', async () => {
    authenticatedFetch.mockResolvedValue(ok({ ...validContract, expiryTimestamp: 0 }));
    const { result } = renderHook(() => usePayableContract(params()));
    await waitFor(() => expect(result.current.contract).not.toBeNull());
    expect(result.current.contractError).toBeNull();
  });

  it('surfaces the error body message on a non-ok response', async () => {
    authenticatedFetch.mockResolvedValue(notOk({ error: 'Not found' }));
    const { result } = renderHook(() => usePayableContract(params()));
    await waitFor(() => expect(result.current.contractError).toBe('Not found'));
  });

  it('only fetches once per contractId across re-renders (one-shot guard)', async () => {
    const { result, rerender } = renderHook((props) => usePayableContract(props), {
      initialProps: params(),
    });
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(1));
    rerender(params());
    await new Promise((r) => setTimeout(r, 30));
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when only authenticatedFetch identity changes (loop-prevention)', async () => {
    const { rerender } = renderHook((props) => usePayableContract(props), {
      initialProps: params(),
    });
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(1));

    const newFetch = jest.fn().mockResolvedValue(ok(validContract));
    rerender(params({ authenticatedFetch: newFetch }));
    await new Promise((r) => setTimeout(r, 30));
    expect(newFetch).not.toHaveBeenCalled();
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
  });
});
