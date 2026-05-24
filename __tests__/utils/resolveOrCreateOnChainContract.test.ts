/**
 * Tests for resolveOrCreateOnChainContract
 *
 * Regression: a user paid the wrong escrow address from a QR code because the
 * webapp called create-contract twice for the same pending contract. The second
 * call deployed an orphan escrow whose address was returned to the webapp even
 * though contractservice rejected the notification (already deployed). The QR
 * encoded the orphan address.
 *
 * The fix: never deploy a second escrow for the same pending contract, and
 * always trust the address contractservice stores over the address chainservice
 * returns.
 */

import { resolveOrCreateOnChainContract } from '@/utils/contractTransactionSequence';

const STORED_ADDRESS = '0x8cbf35c0e7b889f05b7ebb66172010bc63820737';
const ORPHAN_ADDRESS = '0xafcca2b1aa5b8277b224417b29341a7b70eecc6b';

const baseParams = {
  contractserviceId: 'pending-id-1',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  buyer: '0xBuyer',
  seller: '0xSeller',
  amount: 1000,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
  description: 'Test'
};

const mockGetWeb3Service = jest.fn().mockResolvedValue({
  waitForTransaction: jest.fn().mockResolvedValue({ blockNumber: 1, status: 1 })
});

function makeFetch(handlers: Record<string, (init?: RequestInit) => any>) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        const result = handler(init);
        const ok = result.ok ?? true;
        return {
          ok,
          status: result.status ?? (ok ? 200 : 500),
          json: async () => result.body
        } as Response;
      }
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('resolveOrCreateOnChainContract', () => {
  let setTimeoutSpy: jest.SpyInstance | undefined;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    setTimeoutSpy?.mockRestore();
    setTimeoutSpy = undefined;
  });

  // The post-create re-fetch backs off with real setTimeout delays. Collapse
  // those delays to 0 so retry tests don't wait wall-clock seconds (we are
  // testing retry COUNT/behavior, not the actual backoff durations).
  const collapseBackoff = () => {
    const realSetTimeout = global.setTimeout;
    setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: any) => realSetTimeout(fn, 0)) as any);
  };

  it('skips create-contract when contractservice already has an address', async () => {
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => ({ ok: true, body: { id: 'pending-id-1', contractAddress: STORED_ADDRESS } }),
      '/api/chain/create-contract': () => { throw new Error('should not be called'); }
    });

    const result = await resolveOrCreateOnChainContract(baseParams, {
      authenticatedFetch: fetchMock,
      getWeb3Service: mockGetWeb3Service
    });

    expect(result.contractAddress).toBe(STORED_ADDRESS);
    expect(result.alreadyExisted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/contracts/pending-id-1');
  });

  it('returns contractservice address when chainservice returns an orphan', async () => {
    let pendingFetchCount = 0;
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => {
        pendingFetchCount++;
        // First fetch: no address stored yet. Second fetch (after create): stored.
        return pendingFetchCount === 1
          ? { ok: true, body: { id: 'pending-id-1' } }
          : { ok: true, body: { id: 'pending-id-1', contractAddress: STORED_ADDRESS } };
      },
      '/api/chain/create-contract': () => ({
        ok: true,
        body: { contractAddress: ORPHAN_ADDRESS, transactionHash: '0xtx' }
      })
    });

    const result = await resolveOrCreateOnChainContract(baseParams, {
      authenticatedFetch: fetchMock,
      getWeb3Service: mockGetWeb3Service
    });

    expect(result.contractAddress).toBe(STORED_ADDRESS);
    expect(result.contractAddress).not.toBe(ORPHAN_ADDRESS);
    expect(result.alreadyExisted).toBe(false);
  });

  it('falls back to chainservice address when contractservice has not yet recorded one', async () => {
    // Notification can race with the response in some configs; if contractservice
    // hasn't stored the address yet, trust what chainservice just returned. The
    // pre-create GET (test above) is the real protection against orphans.
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => ({ ok: true, body: { id: 'pending-id-1' } }),
      '/api/chain/create-contract': () => ({
        ok: true,
        body: { contractAddress: STORED_ADDRESS, transactionHash: '0xtx' }
      })
    });

    const result = await resolveOrCreateOnChainContract(baseParams, {
      authenticatedFetch: fetchMock,
      getWeb3Service: mockGetWeb3Service
    });

    expect(result.contractAddress).toBe(STORED_ADDRESS);
    expect(result.alreadyExisted).toBe(false);
  });

  it('throws when neither contractservice nor chainservice provides an address', async () => {
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => ({ ok: true, body: { id: 'pending-id-1' } }),
      '/api/chain/create-contract': () => ({ ok: true, body: { transactionHash: '0xtx' } })
    });

    await expect(
      resolveOrCreateOnChainContract(baseParams, {
        authenticatedFetch: fetchMock,
        getWeb3Service: mockGetWeb3Service
      })
    ).rejects.toThrow(/no address/i);
  });

  it('passes arbiter address through when present', async () => {
    let createBody: any = null;
    let pendingFetchCount = 0;
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => {
        pendingFetchCount++;
        return pendingFetchCount === 1
          ? { ok: true, body: { id: 'pending-id-1' } }
          : { ok: true, body: { id: 'pending-id-1', contractAddress: STORED_ADDRESS } };
      },
      '/api/chain/create-contract': (init?: RequestInit) => {
        createBody = JSON.parse((init?.body as string) ?? '{}');
        return { ok: true, body: { contractAddress: STORED_ADDRESS, transactionHash: '0xtx' } };
      }
    });

    await resolveOrCreateOnChainContract(
      { ...baseParams, arbiterAddress: '0xArbiter' },
      { authenticatedFetch: fetchMock, getWeb3Service: mockGetWeb3Service }
    );

    expect(createBody.arbiter).toBe('0xArbiter');
    expect(createBody.arbiterAddress).toBeUndefined();
  });

  it('omits arbiter from wire body when not provided', async () => {
    let createBody: any = null;
    let pendingFetchCount = 0;
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => {
        pendingFetchCount++;
        return pendingFetchCount === 1
          ? { ok: true, body: { id: 'pending-id-1' } }
          : { ok: true, body: { id: 'pending-id-1', contractAddress: STORED_ADDRESS } };
      },
      '/api/chain/create-contract': (init?: RequestInit) => {
        createBody = JSON.parse((init?.body as string) ?? '{}');
        return { ok: true, body: { contractAddress: STORED_ADDRESS, transactionHash: '0xtx' } };
      }
    });

    await resolveOrCreateOnChainContract(baseParams, {
      authenticatedFetch: fetchMock,
      getWeb3Service: mockGetWeb3Service
    });

    expect('arbiter' in createBody).toBe(false);
  });

  it('retries the post-create re-fetch on a transient 500, then uses the stored address', async () => {
    collapseBackoff();
    // Immediately after the on-chain create confirms, contractservice is still
    // processing the chain event and 500s briefly before recording the address.
    let pendingFetchCount = 0;
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => {
        pendingFetchCount++;
        if (pendingFetchCount === 1) return { ok: true, body: { id: 'pending-id-1' } }; // pre-create
        if (pendingFetchCount === 2) return { ok: false, status: 500, body: { error: 'busy' } }; // transient
        return { ok: true, body: { id: 'pending-id-1', contractAddress: STORED_ADDRESS } }; // recovered
      },
      '/api/chain/create-contract': () => ({
        ok: true,
        body: { contractAddress: ORPHAN_ADDRESS, transactionHash: '0xtx' }
      })
    });

    const result = await resolveOrCreateOnChainContract(baseParams, {
      authenticatedFetch: fetchMock,
      getWeb3Service: mockGetWeb3Service
    });

    expect(result.contractAddress).toBe(STORED_ADDRESS);
    expect(pendingFetchCount).toBeGreaterThanOrEqual(3); // pre-create + 500 + retry
  });

  it('falls back to the chainservice address when the post-create re-fetch keeps 500ing', async () => {
    collapseBackoff();
    // The on-chain create succeeded; a persistently-slow contractservice must
    // NOT fail the whole payment — we already have a usable candidate address.
    let pendingFetchCount = 0;
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => {
        pendingFetchCount++;
        if (pendingFetchCount === 1) return { ok: true, body: { id: 'pending-id-1' } }; // pre-create OK
        return { ok: false, status: 500, body: { error: 'still busy' } }; // every re-fetch 500s
      },
      '/api/chain/create-contract': () => ({
        ok: true,
        body: { contractAddress: STORED_ADDRESS, transactionHash: '0xtx' }
      })
    });

    const result = await resolveOrCreateOnChainContract(baseParams, {
      authenticatedFetch: fetchMock,
      getWeb3Service: mockGetWeb3Service
    });

    // Did not throw; fell back to the address chainservice returned.
    expect(result.contractAddress).toBe(STORED_ADDRESS);
    expect(result.alreadyExisted).toBe(false);
  });

  it('still fails fast (no retry) when the PRE-create fetch errors', async () => {
    // A 500 before we create anything is a real error — surface it immediately,
    // do not retry (retries only protect the post-create eventual-consistency
    // window).
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => ({ ok: false, status: 500, body: { error: 'down' } }),
      '/api/chain/create-contract': () => { throw new Error('should not be called'); }
    });

    await expect(
      resolveOrCreateOnChainContract(baseParams, {
        authenticatedFetch: fetchMock,
        getWeb3Service: mockGetWeb3Service
      })
    ).rejects.toThrow(/Failed to load pending contract/);
  });

  it('throws when chainservice create-contract fails', async () => {
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => ({ ok: true, body: { id: 'pending-id-1' } }),
      '/api/chain/create-contract': () => ({ ok: false, body: { error: 'boom' } })
    });

    await expect(
      resolveOrCreateOnChainContract(baseParams, {
        authenticatedFetch: fetchMock,
        getWeb3Service: mockGetWeb3Service
      })
    ).rejects.toThrow('boom');
  });
});
