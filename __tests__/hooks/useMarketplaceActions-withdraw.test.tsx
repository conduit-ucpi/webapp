import { renderHook } from '@testing-library/react';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';

/**
 * Returning an LP's capital must stay RELAYED and must stay signature-free.
 *
 * ⚠️ THE REGRESSION THIS GUARDS IS INVISIBLE AND EXPENSIVE. `withdraw()` is permissionless —
 *    no arguments, destination fixed to the vault's own `lp` — which is the only reason the
 *    platform may send it. Quietly routing it back through the user's wallet would still
 *    "work": the money would move, the tests would pass, and every LP would be asked for a
 *    signature and gas for a transaction that chooses nothing. Half of them would never come
 *    back to give it, which is the exact failure the relay exists to end.
 */

const VAULT = '0x1111111111111111111111111111111111111111';

const fundAndSendTransaction = jest.fn();

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    getWeb3Service: jest.fn(async () => ({ fundAndSendTransaction }))
  })
}));

describe('withdrawing an offer is relayed, not signed', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('posts the vault to chainservice and never touches the wallet', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, transactionHash: '0xabc' })
    });

    const { result } = renderHook(() => useMarketplaceActions());
    const outcome = await result.current.withdrawOffer(VAULT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chain/marketplace/withdraw-offer');
    // The vault and nothing else: a destination or an amount in this body would mean the
    // caller was choosing something, which is precisely what makes the call unsafe to relay.
    expect(JSON.parse(init.body)).toEqual({ vaultAddress: VAULT });

    // No signature, no gas, no wallet prompt.
    expect(fundAndSendTransaction).not.toHaveBeenCalled();

    expect(outcome).toEqual({ success: true, transactionHash: '0xabc', error: undefined });
  });

  it('reports a refusal rather than throwing', async () => {
    // ⚠️ "Not withdrawable" is an ordinary answer, not an exception: the keeper sweep may have
    //    got there first, or the offer is still standing. Callers must be able to show it as a
    //    message and re-read the row, so the result carries it instead of a thrown error.
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, notWithdrawable: true, error: 'still standing' })
    });

    const { result } = renderHook(() => useMarketplaceActions());
    const outcome = await result.current.withdrawOffer(VAULT);

    expect(outcome.success).toBe(false);
    expect(outcome.error).toBe('still standing');
  });

  it('does not tell chainservice the offer ended — it sent the transaction itself', async () => {
    // `offer-ended` exists for wallet-sent actions chainservice cannot observe. This one is
    // chainservice's own: it records the ending and indexes the receipt as it lands, so a
    // second, later claim about the same cache would only be able to make it wrong.
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const { result } = renderHook(() => useMarketplaceActions());
    await result.current.withdrawOffer(VAULT);

    const endpoints = fetchMock.mock.calls.map(([url]) => url);
    expect(endpoints).not.toContain('/api/chain/marketplace/offer-ended');
    expect(endpoints).toEqual(['/api/chain/marketplace/withdraw-offer']);
  });
});

/**
 * The reserve settles the same way, and for the same reason: the funder was fixed at deployment,
 * the beneficiary is read live off the escrow, and the split comes out of the escrow's final
 * state. Neither party has a decision to sign for.
 */
describe('releasing a reserve is relayed, not signed', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('posts the vault to chainservice and never touches the wallet', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, transactionHash: '0xdef' })
    });

    const { result } = renderHook(() => useMarketplaceActions());
    const outcome = await result.current.releaseHoldback(VAULT);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chain/marketplace/release-holdback');
    expect(JSON.parse(init.body)).toEqual({ vaultAddress: VAULT });
    expect(fundAndSendTransaction).not.toHaveBeenCalled();
    expect(outcome.success).toBe(true);
  });

  it('reports a refusal rather than throwing', async () => {
    // The other party may have released it first, or the escrow may not have settled yet.
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, notReleasable: true, error: 'not settled' })
    });

    const { result } = renderHook(() => useMarketplaceActions());
    const outcome = await result.current.releaseHoldback(VAULT);

    expect(outcome.success).toBe(false);
    expect(outcome.error).toBe('not settled');
  });
});
