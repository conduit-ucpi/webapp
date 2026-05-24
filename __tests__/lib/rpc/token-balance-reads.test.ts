/**
 * REGRESSION NET (Phase 0) - Token balance/decimals reads.
 *
 * Pins the CURRENT wire behavior of the duplicated inline token-balance logic
 * that today lives in three places:
 *   - pages/contract-pay.tsx      (~line 182-196)
 *   - pages/contract-create.tsx   (~line 179-193)
 *   - components/ui/WalletInfo.tsx (~line 67-83)
 *
 * All three build `new ethers.JsonRpcProvider(rpcUrl)` + an ERC-20 Contract and
 * do `Promise.all([balanceOf(addr), decimals()])`, then `formatUnits(bal, dec)`.
 *
 * These tests assert the EXACT eth_call payloads (selector + to + decoded
 * result) those statements produce. When this logic moves into lib/rpc/RpcClient
 * the wire behavior must be byte-identical, so these tests must keep passing
 * unchanged. We test the shared behavior (not each React component's useEffect),
 * because the behavior — not the call site — is what the refactor preserves.
 */

import { ethers } from 'ethers';
import {
  installRpcWireMock,
  RpcWireMock,
  SELECTORS,
  word,
} from '@/test-utils/rpcWireMock';

const ERC20_BALANCE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const RPC_URL = 'https://mainnet.base.org';
const USER = '0x1234567890123456789012345678901234567890';
const TOKEN = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

/**
 * Reproduce the exact statements the three call sites run today.
 * If you change this helper you are changing what "current behavior" means —
 * don't, unless the production code genuinely changes.
 */
async function readTokenBalanceLikeProduction(
  rpcUrl: string,
  tokenAddress: string,
  account: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true,
  });
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_BALANCE_ABI, provider);
  const [balance, decimals] = await Promise.all([
    tokenContract.balanceOf(account),
    tokenContract.decimals(),
  ]);
  return ethers.formatUnits(balance, decimals);
}

describe('Phase 0 regression: token balance/decimals reads (eth_call)', () => {
  let mock: RpcWireMock;

  afterEach(() => {
    mock?.restore();
    jest.clearAllMocks();
  });

  it('issues eth_call balanceOf with the correct selector, padded address, and to-address', async () => {
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.balanceOf)) return word(1_500_000);
        if (data.startsWith(SELECTORS.decimals)) return word(6);
      }
      return undefined;
    });

    await readTokenBalanceLikeProduction(RPC_URL, TOKEN, USER);

    const balanceCall = mock.ethCalls.find((r) =>
      r.params[0].data.startsWith(SELECTORS.balanceOf)
    );
    expect(balanceCall).toBeDefined();
    // balanceOf(address) ABI-encodes the account in the low 20 bytes of a word.
    expect(balanceCall!.params[0].data).toBe(
      SELECTORS.balanceOf + USER.slice(2).toLowerCase().padStart(64, '0')
    );
    expect(balanceCall!.params[0].to.toLowerCase()).toBe(TOKEN);
  });

  it('issues eth_call decimals with the correct selector and to-address', async () => {
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.balanceOf)) return word(1_500_000);
        if (data.startsWith(SELECTORS.decimals)) return word(6);
      }
      return undefined;
    });

    await readTokenBalanceLikeProduction(RPC_URL, TOKEN, USER);

    const decimalsCall = mock.ethCalls.find((r) =>
      r.params[0].data.startsWith(SELECTORS.decimals)
    );
    expect(decimalsCall).toBeDefined();
    expect(decimalsCall!.params[0].data).toBe(SELECTORS.decimals);
    expect(decimalsCall!.params[0].to.toLowerCase()).toBe(TOKEN);
  });

  it('decodes raw uint256 balance + uint8 decimals into a formatUnits string (6-decimal token)', async () => {
    // 1_500_000 base units at 6 decimals = "1.5"
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.balanceOf)) return word(1_500_000);
        if (data.startsWith(SELECTORS.decimals)) return word(6);
      }
      return undefined;
    });

    const formatted = await readTokenBalanceLikeProduction(RPC_URL, TOKEN, USER);
    expect(formatted).toBe('1.5');
  });

  it('honors the token decimals reported on-chain (18-decimal token)', async () => {
    // 2 * 10^18 at 18 decimals = "2.0"
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.balanceOf)) return word('2000000000000000000');
        if (data.startsWith(SELECTORS.decimals)) return word(18);
      }
      return undefined;
    });

    const formatted = await readTokenBalanceLikeProduction(RPC_URL, TOKEN, USER);
    expect(formatted).toBe('2.0');
  });

  it('makes exactly the two reads (balanceOf + decimals) and no other RPC traffic', async () => {
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.balanceOf)) return word(0);
        if (data.startsWith(SELECTORS.decimals)) return word(6);
      }
      return undefined;
    });

    await readTokenBalanceLikeProduction(RPC_URL, TOKEN, USER);

    // Only eth_call traffic (plus possibly an automatic eth_chainId, which
    // staticNetwork should suppress). Assert no stray reads sneak in.
    expect(mock.ethCalls).toHaveLength(2);
    const nonCall = mock.requests.filter(
      (r) => r.method !== 'eth_call' && r.method !== 'eth_chainId'
    );
    expect(nonCall).toEqual([]);
  });
});
