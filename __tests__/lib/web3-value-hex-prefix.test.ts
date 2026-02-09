/**
 * Test for the double "0x" prefix bug in fundAndSendTransaction
 *
 * Bug: When sending USDC, txParams.value is undefined, which defaults to '0x0' string.
 * Then when converting to RPC params, the code adds another '0x' prefix, resulting in '0x0x0'.
 *
 * Error from logs:
 * "Cannot convert 0x0x0 to a BigInt"
 */

import { Web3Service } from '@/lib/web3';
import { Config } from '@/types';

// Mock ethers
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    BrowserProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockResolvedValue({
        chainId: BigInt(8453),
        name: 'base'
      }),
      getSigner: jest.fn().mockResolvedValue({
        getAddress: jest.fn().mockResolvedValue('0xEC5ec4fB6270DBC83f7f00e7E94E444ae1b64979'),
        signTransaction: jest.fn().mockResolvedValue('0xsignedtx'),
        sendTransaction: jest.fn()
      }),
      getTransactionCount: jest.fn().mockResolvedValue(0),
      estimateGas: jest.fn().mockResolvedValue(BigInt(54810)),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('10000000'), // 0.01 gwei
        maxFeePerGas: BigInt('1000000'), // 0.001 gwei
        maxPriorityFeePerGas: BigInt('1000000') // 0.001 gwei
      }),
      send: jest.fn((method, params) => {
        if (method === 'eth_getTransactionCount') {
          return Promise.resolve('0x0'); // Nonce 0
        }
        if (method === 'eth_sendTransaction') {
          // This should be called with properly formatted params
          const txParams = params[0];

          // CRITICAL: Check for double 0x prefix bug
          if (txParams.value === '0x0x0') {
            throw new Error('Cannot convert 0x0x0 to a BigInt');
          }

          return Promise.resolve('0xtxhash123');
        }
        if (method === 'eth_getTransactionReceipt') {
          return Promise.resolve({
            blockNumber: '0x123',
            status: '0x1'
          });
        }
        return Promise.resolve(null);
      }),
      request: jest.fn((req) => {
        if (req.method === 'eth_sendTransaction') {
          const txParams = req.params[0];

          // CRITICAL: Check for double 0x prefix bug
          if (txParams.value === '0x0x0') {
            throw new Error('Cannot convert 0x0x0 to a BigInt');
          }

          return Promise.resolve('0xtxhash123');
        }
        return Promise.resolve(null);
      })
    }))
  };
});

// Mock fetch for API calls
global.fetch = jest.fn((url: string, options?: any) => {
  if (url.includes('/api/chain/fund-wallet')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Funded' })
    } as Response);
  }

  // RPC calls
  if (options?.body) {
    const body = JSON.parse(options.body);
    if (body.method === 'eth_gasPrice') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: '0x989680' }) // 0.01 gwei in hex
      } as Response);
    }
    if (body.method === 'eth_estimateGas') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: '0xd61a' }) // 54810 gas
      } as Response);
    }
  }

  return Promise.resolve({
    ok: false,
    statusText: 'Not Found'
  } as Response);
}) as jest.Mock;

describe('Web3Service - Double 0x Prefix Bug', () => {
  let web3Service: Web3Service;
  let mockProvider: any;

  const testConfig: Config = {
    chainId: 8453, // Base mainnet
    rpcUrl: 'https://mainnet.base.org',
    usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    contractFactoryAddress: '0xfactory',
    moonPayApiKey: 'test-key',
    minGasWei: '5',
    maxGasPriceGwei: '50',
    maxGasCostGwei: '5000000',
    gasPriceBuffer: '1.2',
    usdcGrantFoundryGas: '54810',
    depositFundsFoundryGas: '61896',
    resolutionVoteFoundryGas: '80000',
    raiseDisputeFoundryGas: '150000',
    claimFundsFoundryGas: '150000',
    basePath: '/',
    explorerBaseUrl: 'https://basescan.org',
    serviceLink: 'https://example.com'
  };

  beforeEach(async () => {
    Web3Service.clearInstance();
    web3Service = Web3Service.getInstance(testConfig);

    // Create mock provider
    const { BrowserProvider } = require('ethers');
    mockProvider = new BrowserProvider({});

    // Initialize Web3Service with mock provider
    await web3Service.initialize(mockProvider);
  });

  afterEach(() => {
    Web3Service.clearInstance();
    jest.clearAllMocks();
  });

  it.skip('should NOT create double 0x prefix when sending USDC (value = 0x0)', async () => {
    // Simulate sending USDC from /wallet page
    // The wallet page calls fundAndSendTransaction with:
    // - to: USDC contract address
    // - data: encoded transfer() call
    // - value: UNDEFINED (defaults to '0x0')

    const usdcTransferData = '0xa9059cbb000000000000000000000000c9d0602a87e55116f633b1a1f95d083eb115f9420000000000000000000000000000000000000000000000000000000001c52fa0';

    // This should NOT throw "Cannot convert 0x0x0 to a BigInt"
    await expect(
      web3Service.fundAndSendTransaction({
        to: testConfig.usdcContractAddress || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        data: usdcTransferData,
        // value is UNDEFINED - will default to '0x0'
      })
    ).resolves.toBe('0xtxhash123');
  });

  it.skip('should NOT create double 0x prefix when sending native token with explicit 0x0 value', async () => {
    // Edge case: Sending 0 value native token

    await expect(
      web3Service.fundAndSendTransaction({
        to: '0xRecipient123',
        data: '0x',
        value: '0x0' // Explicit '0x0' string
      })
    ).resolves.toBe('0xtxhash123');
  });

  it.skip('should handle decimal string value correctly (native token)', async () => {
    // When sending native tokens, wallet.tsx passes:
    // value: ethers.parseEther(amount).toString()
    // This is a DECIMAL string like "1000000000000000000" (not hex!)

    await expect(
      web3Service.fundAndSendTransaction({
        to: '0xRecipient123',
        data: '0x',
        value: '1000000000000000000' // 1 ETH in wei (decimal string)
      })
    ).resolves.toBe('0xtxhash123');
  });

  it.skip('should handle hex string value correctly', async () => {
    // Some callers might pass hex strings

    await expect(
      web3Service.fundAndSendTransaction({
        to: '0xRecipient123',
        data: '0x',
        value: '0xde0b6b3a7640000' // 1 ETH in hex
      })
    ).resolves.toBe('0xtxhash123');
  });
});
