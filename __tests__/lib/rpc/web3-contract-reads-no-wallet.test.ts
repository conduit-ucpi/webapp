/**
 * BEHAVIOR-CHANGE test (Phase 1, task #8).
 *
 * getContractInfo / getContractState / getUSDCAllowance historically read
 * through Web3Service.provider — the WALLET BrowserProvider — and threw
 * "Provider not initialized" when no wallet was connected. They are reads;
 * routing them through the read-only RpcClient lets them work WITHOUT a
 * connected wallet (a latent-bug fix) while producing identical decoded output.
 *
 * This test pins BOTH halves of that change:
 *   1. AFTER: each read succeeds on a Web3Service with NO wallet provider
 *      (this.provider === null) — the previously-thrown guard is gone.
 *   2. SAME OUTPUT: the decoded shapes match what the wallet-provider path
 *      produced (USDC 6-decimal amount/allowance, numeric fields, 7 bools).
 *
 * Reads are intercepted at JsonRpcProvider._send so ethers does the real ABI
 * decoding. The Web3Service singleton is constructed with a valid rpcUrl but
 * NEVER initialized with a wallet.
 */

import { Web3Service } from '@/lib/web3';
import { installRpcWireMock, RpcWireMock, word } from '@/test-utils/rpcWireMock';

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

const USER = '0x1234567890123456789012345678901234567890';
const SPENDER = '0x000000000000000000000000000000000000dEaD';
const CONTRACT = '0x1111111111111111111111111111111111111111';

describe('Phase 1 behavior change: contract reads no longer require a wallet', () => {
  let web3Service: Web3Service;
  let mock: RpcWireMock;

  beforeEach(() => {
    jest.clearAllMocks();
    (Web3Service as any).clearInstance?.();
    web3Service = (Web3Service as any).getInstance(mockConfig);
    // Critical: never call initialize(); there is NO wallet provider.
    expect((web3Service as any).provider).toBeFalsy();
  });

  afterEach(() => {
    mock?.restore();
  });

  it('getContractInfo decodes the tuple without a connected wallet', async () => {
    const { ethers } = require('ethers');
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint256', 'uint256', 'bytes32', 'uint8', 'uint256'],
      [USER, SPENDER, BigInt(1_500_000), BigInt(1_900_000_000), '0x' + 'cd'.repeat(32), 2, BigInt(1_800_000_000)]
    );
    mock = installRpcWireMock((req) => (req.method === 'eth_call' ? encoded : undefined));

    const info = await web3Service.getContractInfo(CONTRACT);

    expect(info.buyer.toLowerCase()).toBe(USER.toLowerCase());
    expect(info.seller.toLowerCase()).toBe(SPENDER.toLowerCase());
    expect(info.amount).toBe('1.5'); // USDC 6-decimal
    expect(info.expiryTimestamp).toBe(1_900_000_000);
    expect(info.descriptionHash).toBe('0x' + 'cd'.repeat(32));
    expect(info.currentState).toBe(2);
    expect(info.currentTimestamp).toBe(1_800_000_000);
  });

  it('getContractState reads the seven booleans without a connected wallet', async () => {
    const { ethers } = require('ethers');
    const iface = new ethers.Interface([
      'function isExpired() view returns (bool)',
      'function canClaim() view returns (bool)',
      'function canDispute() view returns (bool)',
      'function isFunded() view returns (bool)',
      'function canDeposit() view returns (bool)',
      'function isDisputed() view returns (bool)',
      'function isClaimed() view returns (bool)',
    ]);
    const sel = (n: string) => iface.getFunction(n)!.selector;
    const map: Record<string, string> = {
      [sel('isExpired')]: word(1),
      [sel('canClaim')]: word(0),
      [sel('canDispute')]: word(1),
      [sel('isFunded')]: word(1),
      [sel('canDeposit')]: word(0),
      [sel('isDisputed')]: word(0),
      [sel('isClaimed')]: word(0),
    };
    mock = installRpcWireMock((req) =>
      req.method === 'eth_call' ? map[(req.params[0].data as string).slice(0, 10)] : undefined
    );

    const state = await web3Service.getContractState(CONTRACT);

    expect(state).toEqual({
      isExpired: true,
      canClaim: false,
      canDispute: true,
      isFunded: true,
      canDeposit: false,
      isDisputed: false,
      isClaimed: false,
    });
  });

  it('getUSDCAllowance reads allowance + decimals without a connected wallet', async () => {
    const { SELECTORS } = require('@/test-utils/rpcWireMock');
    mock = installRpcWireMock((req) => {
      if (req.method === 'eth_call') {
        const data: string = req.params[0].data;
        if (data.startsWith(SELECTORS.allowance)) return word(5_000_000);
        if (data.startsWith(SELECTORS.decimals)) return word(6);
      }
      return undefined;
    });

    const allowance = await web3Service.getUSDCAllowance(USER, SPENDER);
    expect(allowance).toBe('5.0'); // USDC 6-decimal
  });
});
