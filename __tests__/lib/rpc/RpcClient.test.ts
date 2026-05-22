/**
 * Unit tests for lib/rpc/RpcClient — the single owner of read RPC.
 *
 * RpcClient centralizes every read against our own rpcUrl. These tests pin its
 * behavior at the wire level (intercepting JsonRpcProvider._send) so it stays
 * byte-identical to the inline logic it replaces. They mirror the Phase 0
 * regression net (token-balance-reads, token-metadata-reads, etc.), but assert
 * against the RpcClient API rather than reproduced statements.
 */

import {
  installRpcWireMock,
  RpcWireMock,
  SELECTORS,
  word,
  encodeString,
} from '@/test-utils/rpcWireMock';
import { RpcClient } from '@/lib/rpc/RpcClient';

const RPC_URL = 'https://mainnet.base.org';
const USER = '0x1234567890123456789012345678901234567890';
const SPENDER = '0x000000000000000000000000000000000000dEaD';
const TOKEN = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const CONTRACT = '0x1111111111111111111111111111111111111111';

describe('RpcClient', () => {
  let mock: RpcWireMock;

  afterEach(() => {
    mock?.restore();
    jest.clearAllMocks();
  });

  describe('getTokenBalance', () => {
    it('reads balanceOf + decimals and returns the formatUnits string', async () => {
      mock = installRpcWireMock((req) => {
        if (req.method === 'eth_call') {
          const data: string = req.params[0].data;
          if (data.startsWith(SELECTORS.balanceOf)) return word(1_500_000);
          if (data.startsWith(SELECTORS.decimals)) return word(6);
        }
        return undefined;
      });

      const client = new RpcClient(RPC_URL);
      const balance = await client.getTokenBalance(USER, TOKEN);

      expect(balance).toBe('1.5');
      const balCall = mock.ethCalls.find((r) => r.params[0].data.startsWith(SELECTORS.balanceOf));
      expect(balCall!.params[0].to.toLowerCase()).toBe(TOKEN);
      expect(balCall!.params[0].data).toBe(
        SELECTORS.balanceOf + USER.slice(2).toLowerCase().padStart(64, '0')
      );
    });

    it('honors on-chain decimals (18-decimal token)', async () => {
      mock = installRpcWireMock((req) => {
        if (req.method === 'eth_call') {
          const data: string = req.params[0].data;
          if (data.startsWith(SELECTORS.balanceOf)) return word('2000000000000000000');
          if (data.startsWith(SELECTORS.decimals)) return word(18);
        }
        return undefined;
      });

      const client = new RpcClient(RPC_URL);
      expect(await client.getTokenBalance(USER, TOKEN)).toBe('2.0');
    });
  });

  describe('getNativeBalance', () => {
    it('reads eth_getBalance and formats as ether', async () => {
      mock = installRpcWireMock((req) => {
        if (req.method === 'eth_getBalance') return word('1500000000000000000'); // 1.5 ETH
        return undefined;
      });

      const client = new RpcClient(RPC_URL);
      const balance = await client.getNativeBalance(USER);

      expect(balance).toBe('1.5');
      const balCall = mock.requests.find((r) => r.method === 'eth_getBalance');
      expect(balCall!.params[0].toLowerCase()).toBe(USER.toLowerCase());
    });
  });

  describe('getTokenMetadata', () => {
    it('reads symbol/decimals/name and coerces decimals to number', async () => {
      mock = installRpcWireMock((req) => {
        if (req.method === 'eth_call') {
          const data: string = req.params[0].data;
          if (data.startsWith(SELECTORS.symbol)) return encodeString('USDC');
          if (data.startsWith(SELECTORS.decimals)) return word(6);
          if (data.startsWith(SELECTORS.name)) return encodeString('USD Coin');
        }
        return undefined;
      });

      const client = new RpcClient(RPC_URL);
      const meta = await client.getTokenMetadata(TOKEN);

      expect(meta).toEqual({ address: TOKEN, symbol: 'USDC', decimals: 6, name: 'USD Coin' });
      expect(typeof meta.decimals).toBe('number');
    });
  });

  describe('getTokenAllowance', () => {
    it('reads allowance + decimals and returns the formatUnits string', async () => {
      mock = installRpcWireMock((req) => {
        if (req.method === 'eth_call') {
          const data: string = req.params[0].data;
          if (data.startsWith(SELECTORS.allowance)) return word(5_000_000);
          if (data.startsWith(SELECTORS.decimals)) return word(6);
        }
        return undefined;
      });

      const client = new RpcClient(RPC_URL);
      const allowance = await client.getTokenAllowance(USER, SPENDER, TOKEN);

      expect(allowance).toBe('5.0');
      const allowCall = mock.ethCalls.find((r) => r.params[0].data.startsWith(SELECTORS.allowance));
      expect(allowCall!.params[0].to.toLowerCase()).toBe(TOKEN);
    });
  });

  describe('getContractInfo', () => {
    it('decodes the escrow getContractInfo tuple with USDC 6-decimal amount and numeric fields', async () => {
      // Encode the 7-field tuple the ABI declares.
      const { ethers } = require('ethers');
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256', 'bytes32', 'uint8', 'uint256'],
        [
          USER,
          SPENDER,
          BigInt(1_500_000), // 1.5 USDC at 6 decimals
          BigInt(1_900_000_000), // expiry
          '0x' + 'cd'.repeat(32),
          2, // currentState
          BigInt(1_800_000_000), // currentTimestamp
        ]
      );

      mock = installRpcWireMock((req) => {
        if (req.method === 'eth_call') return encoded;
        return undefined;
      });

      const client = new RpcClient(RPC_URL);
      const info = await client.getContractInfo(CONTRACT);

      expect(info.buyer.toLowerCase()).toBe(USER.toLowerCase());
      expect(info.seller.toLowerCase()).toBe(SPENDER.toLowerCase());
      expect(info.amount).toBe('1.5');
      expect(info.expiryTimestamp).toBe(1_900_000_000);
      expect(info.descriptionHash).toBe('0x' + 'cd'.repeat(32));
      expect(info.currentState).toBe(2);
      expect(info.currentTimestamp).toBe(1_800_000_000);
    });
  });

  describe('getContractState', () => {
    it('reads the seven boolean state flags in parallel', async () => {
      // Each bool getter returns its own value; map by selector.
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
      const sel = (name: string) => iface.getFunction(name)!.selector;
      const boolWord = (b: boolean) => word(b ? 1 : 0);
      const bySelector: Record<string, string> = {
        [sel('isExpired')]: boolWord(true),
        [sel('canClaim')]: boolWord(false),
        [sel('canDispute')]: boolWord(true),
        [sel('isFunded')]: boolWord(true),
        [sel('canDeposit')]: boolWord(false),
        [sel('isDisputed')]: boolWord(false),
        [sel('isClaimed')]: boolWord(false),
      };

      mock = installRpcWireMock((req) => {
        if (req.method === 'eth_call') {
          const selector = (req.params[0].data as string).slice(0, 10);
          return bySelector[selector];
        }
        return undefined;
      });

      const client = new RpcClient(RPC_URL);
      const state = await client.getContractState(CONTRACT);

      expect(state).toEqual({
        isExpired: true,
        canClaim: false,
        canDispute: true,
        isFunded: true,
        canDeposit: false,
        isDisputed: false,
        isClaimed: false,
      });
      expect(mock.ethCalls).toHaveLength(7);
    });
  });
});
