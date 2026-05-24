/**
 * REGRESSION NET (Phase 0) - block-search transaction fallback.
 *
 * Web3Service.findTransactionByNonce() (lib/web3.ts ~line 1587-1675) is the
 * fallback used when a wallet returns an unreliable tx hash: it walks recent
 * blocks looking for a transaction matching (from, nonce). The audit found NO
 * dedicated coverage, yet it issues raw provider.send calls in a specific
 * order that the RpcClient must reproduce:
 *
 *   eth_blockNumber  -> latest block (hex, parsed base-16)
 *   eth_getBlockByNumber [blockHex, false]  -> block with `transactions` hashes
 *   eth_getTransactionByHash [hash]  -> tx; match on from (lowercased) + nonce
 *
 * Quirks pinned here:
 *   - latest block parsed via parseInt(hex, 16)
 *   - block requested as 0x-prefixed hex, with the `false` (hashes-only) flag
 *   - nonce compared after parsing hex-or-number
 *   - from compared case-insensitively
 *   - returns the matching txData.hash
 *
 * findTransactionByNonce is private; we drive it via (instance as any) and a
 * fake provider injected onto the singleton, matching the convention in
 * web3-gas-estimation-simple.test.ts.
 */

import { Web3Service } from '@/lib/web3';

const mockConfig = {
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  usdcContractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  moonPayApiKey: 'test-key',
  minGasWei: '5',
  maxGasPriceGwei: '0.001',
  basePath: '',
  explorerBaseUrl: 'https://base.blockscout.com',
  serviceLink: 'http://localhost:3000',
} as any;

const FROM = '0xAbCdef0000000000000000000000000000000001';
const TARGET_HASH = '0x' + 'ab'.repeat(32);

describe('Phase 0 regression: block-search tx fallback (findTransactionByNonce)', () => {
  let web3Service: Web3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    (Web3Service as any).clearInstance?.();
    web3Service = (Web3Service as any).getInstance(mockConfig);
  });

  it('walks eth_blockNumber -> eth_getBlockByNumber -> eth_getTransactionByHash and returns the matching hash', async () => {
    const calls: Array<{ method: string; params: any[] }> = [];

    const fakeProvider = {
      send: jest.fn(async (method: string, params: any[]) => {
        calls.push({ method, params });
        if (method === 'eth_blockNumber') return '0x10'; // 16
        if (method === 'eth_getBlockByNumber') {
          // Only the latest block (0x10) holds our tx.
          if (params[0] === '0x10') {
            return { number: '0x10', transactions: [TARGET_HASH] };
          }
          return { number: params[0], transactions: [] };
        }
        if (method === 'eth_getTransactionByHash') {
          return {
            hash: TARGET_HASH,
            from: FROM.toLowerCase(),
            nonce: '0x5', // hex nonce -> must parse to 5
          };
        }
        throw new Error('unexpected ' + method);
      }),
    };
    (web3Service as any).provider = fakeProvider;

    const found = await (web3Service as any).findTransactionByNonce(FROM, 5, 1, 0, 20);

    expect(found).toBe(TARGET_HASH);

    // First call is the latest-block read.
    expect(calls[0]).toEqual({ method: 'eth_blockNumber', params: [] });
    // Block requested as 0x-prefixed hex, hashes-only (false) flag.
    const blockCall = calls.find((c) => c.method === 'eth_getBlockByNumber');
    expect(blockCall!.params).toEqual(['0x10', false]);
    // Tx looked up by hash.
    const txCall = calls.find((c) => c.method === 'eth_getTransactionByHash');
    expect(txCall!.params).toEqual([TARGET_HASH]);
  });

  it('does not match when the from-address differs, and throws after exhausting attempts', async () => {
    const fakeProvider = {
      send: jest.fn(async (method: string, params: any[]) => {
        if (method === 'eth_blockNumber') return '0x10';
        if (method === 'eth_getBlockByNumber') {
          return params[0] === '0x10'
            ? { number: '0x10', transactions: [TARGET_HASH] }
            : { number: params[0], transactions: [] };
        }
        if (method === 'eth_getTransactionByHash') {
          return {
            hash: TARGET_HASH,
            from: '0x9999999999999999999999999999999999999999', // different sender
            nonce: '0x5',
          };
        }
        throw new Error('unexpected ' + method);
      }),
    };
    (web3Service as any).provider = fakeProvider;

    await expect(
      (web3Service as any).findTransactionByNonce(FROM, 5, 1, 0, 20)
    ).rejects.toThrow(/Transaction not found/);
  });

  it('does not match when the nonce differs', async () => {
    const fakeProvider = {
      send: jest.fn(async (method: string, params: any[]) => {
        if (method === 'eth_blockNumber') return '0x10';
        if (method === 'eth_getBlockByNumber') {
          return params[0] === '0x10'
            ? { number: '0x10', transactions: [TARGET_HASH] }
            : { number: params[0], transactions: [] };
        }
        if (method === 'eth_getTransactionByHash') {
          return { hash: TARGET_HASH, from: FROM.toLowerCase(), nonce: '0x9' }; // nonce 9, not 5
        }
        throw new Error('unexpected ' + method);
      }),
    };
    (web3Service as any).provider = fakeProvider;

    await expect(
      (web3Service as any).findTransactionByNonce(FROM, 5, 1, 0, 20)
    ).rejects.toThrow(/Transaction not found/);
  });

  it('throws immediately if no provider with send is available', async () => {
    (web3Service as any).provider = null;
    await expect(
      (web3Service as any).findTransactionByNonce(FROM, 5, 1, 0, 20)
    ).rejects.toThrow(/No provider available for transaction search/);
  });
});
