/**
 * REGRESSION NET (Phase 0) - FarcasterSyntheticProvider read behavior.
 *
 * FarcasterSyntheticProvider (components/auth/farcasterAuth.tsx ~line 36-115)
 * is not exported and the module pulls in heavy wagmi/Farcaster deps, so we
 * pin its read behavior by reproducing its exact statements.
 *
 * Two distinct read paths:
 *   1. Thin ethers passthroughs over an internal JsonRpcProvider:
 *        getNetwork()          -> eth_chainId
 *        getBlockNumber()      -> eth_blockNumber
 *        getTransactionCount() -> eth_getTransactionCount
 *        call(tx)              -> eth_call
 *      (interceptable at JsonRpcProvider._send)
 *
 *   2. A DELIBERATE raw fetch in getFeeData() that bypasses ethers'
 *      provider.getFeeData() "to avoid inflated gas values", calling
 *      eth_gasPrice directly and FALLING BACK to a hardcoded 1 gwei
 *      (1_000_000_000n) when the RPC is unavailable / returns no result.
 *      (interceptable at global.fetch)
 *
 * The getFeeData quirk + its 1-gwei fallback is LOAD-BEARING. When this moves
 * into lib/rpc/RpcClient, both branches must be preserved exactly.
 */

import { ethers } from 'ethers';
import { installRpcWireMock, RpcWireMock } from '@/test-utils/rpcWireMock';

const RPC_URL = 'https://mainnet.base.org';
const ADDR = '0x1234567890123456789012345678901234567890';

// ---- Path 1: thin ethers passthroughs (reproduce exact statements) ----
function makeInternalProvider(rpcUrl: string) {
  return new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
}

// ---- Path 2: the deliberate raw-fetch getFeeData (reproduce verbatim) ----
async function farcasterGetFeeDataLikeProduction(rpcUrl: string) {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.result) {
        return {
          gasPrice: BigInt(result.result),
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        };
      }
    }
  } catch (error) {
    // swallow, fall through to fallback
  }
  return {
    gasPrice: BigInt('1000000000'), // 1 gwei fallback
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
  };
}

describe('Phase 0 regression: FarcasterSyntheticProvider reads', () => {
  describe('thin ethers passthroughs (eth_chainId / blockNumber / txCount / call)', () => {
    let mock: RpcWireMock;
    afterEach(() => {
      mock?.restore();
      jest.clearAllMocks();
    });

    it('getNetwork/getBlockNumber/getTransactionCount/call emit the expected methods', async () => {
      mock = installRpcWireMock((req) => {
        switch (req.method) {
          case 'eth_chainId':
            return '0x2105';
          case 'eth_blockNumber':
            return '0x10c8e0';
          case 'eth_getTransactionCount':
            return '0x5';
          case 'eth_call':
            return '0x' + '00'.repeat(31) + '01';
          default:
            return undefined;
        }
      });

      const p = makeInternalProvider(RPC_URL);
      const net = await p.getNetwork();
      const block = await p.getBlockNumber();
      const nonce = await p.getTransactionCount(ADDR);
      const callResult = await p.call({ to: ADDR, data: '0x' });

      expect(Number(net.chainId)).toBe(8453);
      expect(block).toBe(1_100_000);
      expect(nonce).toBe(5);
      expect(callResult).toBe('0x' + '00'.repeat(31) + '01');

      const methods = mock.requests.map((r) => r.method);
      expect(methods).toContain('eth_blockNumber');
      expect(methods).toContain('eth_getTransactionCount');
      expect(methods).toContain('eth_call');
    });
  });

  describe('getFeeData() deliberate raw eth_gasPrice fetch + 1-gwei fallback', () => {
    let originalFetch: typeof global.fetch;
    const mockFetch = jest.fn();

    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = mockFetch as unknown as typeof global.fetch;
    });
    afterEach(() => {
      global.fetch = originalFetch;
      jest.clearAllMocks();
    });

    it('sends a raw eth_gasPrice JSON-RPC POST and returns gasPrice as a BigInt (maxFee fields null)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x186a0' }), // 100_000 wei
      });

      const fee = await farcasterGetFeeDataLikeProduction(RPC_URL);

      expect(mockFetch).toHaveBeenCalledWith(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        }),
      });
      expect(fee.gasPrice).toBe(BigInt(100000));
      expect(fee.maxFeePerGas).toBeNull();
      expect(fee.maxPriorityFeePerGas).toBeNull();
    });

    it('falls back to exactly 1 gwei when the RPC throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network down'));

      const fee = await farcasterGetFeeDataLikeProduction(RPC_URL);

      expect(fee.gasPrice).toBe(BigInt('1000000000')); // 1 gwei
      expect(fee.maxFeePerGas).toBeNull();
      expect(fee.maxPriorityFeePerGas).toBeNull();
    });

    it('falls back to 1 gwei when the response has no result field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1 }), // no `result`
      });

      const fee = await farcasterGetFeeDataLikeProduction(RPC_URL);

      expect(fee.gasPrice).toBe(BigInt('1000000000'));
    });

    it('falls back to 1 gwei when the HTTP response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ result: '0x186a0' }),
      });

      const fee = await farcasterGetFeeDataLikeProduction(RPC_URL);

      expect(fee.gasPrice).toBe(BigInt('1000000000'));
    });
  });
});
