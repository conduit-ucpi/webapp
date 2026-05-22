/**
 * REGRESSION NET (Phase 0) - wallet.tsx loadChainInfo() network/block/fee reads.
 *
 * Pins the CURRENT wire behavior of pages/wallet.tsx loadChainInfo() (~line
 * 58-128), which uses a READ-ONLY provider and reads:
 *   - getNetwork()      -> Number(network.chainId)
 *   - getBlockNumber()  -> blockNumber (number)
 *   - getFeeData()      -> gasPrice formatted via formatUnits(gasPrice, 'gwei'),
 *                          wrapped in try/catch that sets gasPrice = null on error.
 *
 * Probed RPC methods emitted (ethers v6): getNetwork -> eth_chainId;
 * getBlockNumber -> eth_blockNumber; getFeeData -> eth_getBlockByNumber +
 * eth_gasPrice + eth_maxPriorityFeePerGas.
 *
 * We reproduce the exact read statements and pin the display transforms +
 * null-gas-price fallback. When this moves into lib/rpc/RpcClient these must
 * be preserved.
 */

import { ethers } from 'ethers';
import { installRpcWireMock, RpcWireMock } from '@/test-utils/rpcWireMock';

const RPC_URL = 'https://mainnet.base.org';
const CHAIN_ID_HEX = '0x2105'; // 8453 Base
const BLOCK_HEX = '0x10c8e0'; // 1_100_000
const GAS_PRICE_HEX = '0x186a0'; // 100_000 wei
const PRIORITY_HEX = '0x3d090'; // 250_000 wei

function fakeBlock() {
  return {
    number: BLOCK_HEX,
    baseFeePerGas: GAS_PRICE_HEX,
    gasLimit: '0x1',
    gasUsed: '0x1',
    hash: '0x' + '00'.repeat(32),
    parentHash: '0x' + '00'.repeat(32),
    timestamp: '0x1',
    transactions: [],
    miner: '0x' + '00'.repeat(20),
    extraData: '0x',
    nonce: '0x0000000000000000',
    difficulty: '0x0',
  };
}

/** Reproduce loadChainInfo()'s read statements (pages/wallet.tsx). */
async function loadChainInfoReadsLikeProduction(rpcUrl: string) {
  const readProvider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true,
  });

  const network = await readProvider.getNetwork();
  const chainId = Number(network.chainId);

  const blockNumber = await readProvider.getBlockNumber();

  let gasPrice: string | null = null;
  try {
    const feeData = await readProvider.getFeeData();
    if (feeData.gasPrice) {
      gasPrice = ethers.formatUnits(feeData.gasPrice, 'gwei');
    }
  } catch (error) {
    gasPrice = null;
  }

  return { chainId, blockNumber, gasPrice };
}

describe('Phase 0 regression: wallet.tsx chain-info reads', () => {
  let mock: RpcWireMock;

  afterEach(() => {
    mock?.restore();
    jest.clearAllMocks();
  });

  it('reads chainId as a JS number, block number, and gas price as a gwei string', async () => {
    mock = installRpcWireMock((req) => {
      switch (req.method) {
        case 'eth_chainId':
          return CHAIN_ID_HEX;
        case 'eth_blockNumber':
          return BLOCK_HEX;
        case 'eth_gasPrice':
          return GAS_PRICE_HEX;
        case 'eth_maxPriorityFeePerGas':
          return PRIORITY_HEX;
        case 'eth_getBlockByNumber':
          return fakeBlock();
        default:
          return undefined;
      }
    });

    const info = await loadChainInfoReadsLikeProduction(RPC_URL);

    expect(info.chainId).toBe(8453);
    expect(typeof info.chainId).toBe('number');
    expect(info.blockNumber).toBe(1_100_000);
    // 100_000 wei -> 0.0001 gwei.
    expect(info.gasPrice).toBe('0.0001');
  });

  it('emits eth_blockNumber for the block read', async () => {
    mock = installRpcWireMock((req) => {
      switch (req.method) {
        case 'eth_chainId':
          return CHAIN_ID_HEX;
        case 'eth_blockNumber':
          return BLOCK_HEX;
        case 'eth_gasPrice':
          return GAS_PRICE_HEX;
        case 'eth_maxPriorityFeePerGas':
          return PRIORITY_HEX;
        case 'eth_getBlockByNumber':
          return fakeBlock();
        default:
          return undefined;
      }
    });

    await loadChainInfoReadsLikeProduction(RPC_URL);

    expect(mock.requests.some((r) => r.method === 'eth_blockNumber')).toBe(true);
  });

  it('falls back to gasPrice = null when the fee read fails (chainId + block still read)', async () => {
    mock = installRpcWireMock((req) => {
      switch (req.method) {
        case 'eth_chainId':
          return CHAIN_ID_HEX;
        case 'eth_blockNumber':
          return BLOCK_HEX;
        // No fee-related methods handled -> harness errors them -> getFeeData
        // throws -> production catch sets gasPrice = null.
        default:
          return undefined;
      }
    });

    const info = await loadChainInfoReadsLikeProduction(RPC_URL);

    expect(info.chainId).toBe(8453);
    expect(info.blockNumber).toBe(1_100_000);
    expect(info.gasPrice).toBeNull();
  });
});
