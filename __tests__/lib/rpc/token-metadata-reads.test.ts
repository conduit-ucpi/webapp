/**
 * REGRESSION NET (Phase 0) - Token metadata reads (symbol/decimals/name).
 *
 * Pins the CURRENT wire behavior of getTokenDetails() in pages/api/config.ts
 * (~line 29-54), which the server runs at startup for each configured token.
 * It builds `new ethers.JsonRpcProvider(rpcUrl)` + an ERC-20 Contract and does
 * `Promise.all([symbol(), decimals(), name()])`, returning
 *   { address, symbol, decimals: Number(decimals), name }
 * or `null` if anything throws.
 *
 * getTokenDetails is not exported, so we reproduce its exact statements here
 * and pin the resulting eth_call payloads, the decoded shape, AND the
 * null-on-error contract (load-bearing: the config endpoint must not crash if
 * a token contract is unreachable). When this moves into lib/rpc/RpcClient the
 * wire behavior and the null fallback must be preserved.
 */

import { ethers } from 'ethers';
import {
  installRpcWireMock,
  RpcWireMock,
  SELECTORS,
  word,
  encodeString,
} from '@/test-utils/rpcWireMock';

const ERC20_METADATA_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
];

const RPC_URL = 'https://mainnet.base.org';
const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // Base USDC

interface TokenDetails {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

/** Reproduce getTokenDetails()'s exact statements (pages/api/config.ts). */
async function getTokenDetailsLikeProduction(
  rpcUrl: string,
  tokenAddress: string
): Promise<TokenDetails | null> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
    });
    const contract = new ethers.Contract(tokenAddress, ERC20_METADATA_ABI, provider);
    const [symbol, decimals, name] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
      contract.name(),
    ]);
    return { address: tokenAddress, symbol, decimals: Number(decimals), name };
  } catch (error) {
    return null;
  }
}

describe('Phase 0 regression: token metadata reads (eth_call symbol/decimals/name)', () => {
  let mock: RpcWireMock;

  afterEach(() => {
    mock?.restore();
    jest.clearAllMocks();
  });

  it('issues all three reads with the correct selectors against the token address', async () => {
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.symbol)) return encodeString('USDC');
        if (data.startsWith(SELECTORS.decimals)) return word(6);
        if (data.startsWith(SELECTORS.name)) return encodeString('USD Coin');
      }
      return undefined;
    });

    await getTokenDetailsLikeProduction(RPC_URL, TOKEN);

    const selectors = mock.ethCalls.map((r) => (r.params[0].data as string).slice(0, 10));
    expect(selectors).toContain(SELECTORS.symbol);
    expect(selectors).toContain(SELECTORS.decimals);
    expect(selectors).toContain(SELECTORS.name);
    // All three target the token contract.
    for (const call of mock.ethCalls) {
      expect(call.params[0].to.toLowerCase()).toBe(TOKEN.toLowerCase());
    }
  });

  it('decodes into { address, symbol, decimals:number, name } with decimals coerced to a JS number', async () => {
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.symbol)) return encodeString('USDC');
        if (data.startsWith(SELECTORS.decimals)) return word(6);
        if (data.startsWith(SELECTORS.name)) return encodeString('USD Coin');
      }
      return undefined;
    });

    const details = await getTokenDetailsLikeProduction(RPC_URL, TOKEN);

    expect(details).toEqual({
      address: TOKEN,
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
    });
    // decimals must be a primitive number, not a bigint (config consumers rely on this).
    expect(typeof details!.decimals).toBe('number');
  });

  it('returns null (does not throw) when a metadata read reverts', async () => {
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.symbol)) return encodeString('USDC');
        // decimals + name intentionally not handled -> harness errors them ->
        // ethers throws -> production catch returns null.
      }
      return undefined;
    });

    const details = await getTokenDetailsLikeProduction(RPC_URL, TOKEN);
    expect(details).toBeNull();
  });
});
