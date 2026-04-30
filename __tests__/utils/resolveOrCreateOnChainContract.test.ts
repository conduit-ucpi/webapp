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
        return {
          ok: result.ok ?? true,
          json: async () => result.body
        } as Response;
      }
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('resolveOrCreateOnChainContract', () => {
  beforeEach(() => jest.clearAllMocks());

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

  it('throws when escrow was deployed but contractservice has no address recorded', async () => {
    const fetchMock = makeFetch({
      '/api/contracts/pending-id-1': () => ({ ok: true, body: { id: 'pending-id-1' } }),
      '/api/chain/create-contract': () => ({
        ok: true,
        body: { contractAddress: ORPHAN_ADDRESS, transactionHash: '0xtx' }
      })
    });

    await expect(
      resolveOrCreateOnChainContract(baseParams, {
        authenticatedFetch: fetchMock,
        getWeb3Service: mockGetWeb3Service
      })
    ).rejects.toThrow(/orphaned/i);
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
