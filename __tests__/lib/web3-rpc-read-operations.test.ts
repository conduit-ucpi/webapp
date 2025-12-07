/**
 * Test: Web3Service should use RPC provider for read-only operations
 *
 * Problem: During contract creation on mobile, Web3Service makes unnecessary
 * calls to the wallet provider (this.provider) for read-only operations like:
 * - getNetwork()
 * - getFeeData()
 * - getTransactionCount()
 *
 * This causes MetaMask to popup/flicker on mobile as it switches between apps.
 *
 * Solution: Use this.readProvider (RPC) for all read-only operations.
 * Only use this.provider (wallet) when actually signing transactions.
 *
 * This test verifies that read-only operations use RPC, not wallet provider.
 */

import { Web3Service } from '@/lib/web3';
import { Config } from '@/types';
import { ethers } from 'ethers';

describe('Web3Service - RPC for read-only operations', () => {
  let mockConfig: Config;
  let mockWalletProvider: any;
  let web3Service: Web3Service;
  let getNetworkSpy: jest.SpyInstance;
  let getFeeDataSpy: jest.SpyInstance;
  let getTransactionCountSpy: jest.SpyInstance;

  beforeEach(() => {
    // Clear singleton before each test
    Web3Service.clearInstance();

    mockConfig = {
      chainId: 84532, // Base Sepolia
      rpcUrl: 'https://sepolia.base.org',
      usdcContractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      contractFactoryAddress: '0x1234567890123456789012345678901234567890',
      serviceLink: 'https://test.conduit-ucpi.com',
      minGasWei: '10000000000',
      maxGasPriceGwei: '50',
      maxGasCostGwei: '500000',
      usdcGrantFoundryGas: '100000',
      depositFundsFoundryGas: '200000',
      gasPriceBuffer: '1.2',
      tokenSymbol: 'USDC',
      defaultTokenSymbol: 'USDC',
      web3AuthClientId: 'test-client-id',
      web3AuthNetwork: 'sapphire_devnet',
      moonPayApiKey: 'test-moonpay-key',
      basePath: 'https://test.conduit-ucpi.com',
      explorerBaseUrl: 'https://sepolia.basescan.org'
    };

    // Create a mock wallet provider with spies
    mockWalletProvider = {
      getNetwork: jest.fn().mockResolvedValue({
        chainId: BigInt(84532),
        name: 'base-sepolia'
      }),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt(1000000000), // 1 gwei
        maxFeePerGas: BigInt(2000000000), // 2 gwei
        maxPriorityFeePerGas: BigInt(1000000000) // 1 gwei
      }),
      getTransactionCount: jest.fn().mockResolvedValue(5),
      getSigner: jest.fn().mockResolvedValue({
        getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
        signTransaction: jest.fn().mockResolvedValue('0xsignedtx'),
        signMessage: jest.fn().mockResolvedValue('0xsignature')
      }),
      send: jest.fn(),
      request: jest.fn()
    };

    // Setup spies
    getNetworkSpy = jest.spyOn(mockWalletProvider, 'getNetwork');
    getFeeDataSpy = jest.spyOn(mockWalletProvider, 'getFeeData');
    getTransactionCountSpy = jest.spyOn(mockWalletProvider, 'getTransactionCount');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Web3Service.clearInstance();
  });

  describe('Initialization', () => {
    it('should call wallet provider.getNetwork() ONLY during initialization (one-time is acceptable)', async () => {
      // Initialization happens once during wallet connection, so one getNetwork() call is acceptable
      // We only want to avoid repeated calls during page rendering and transaction prep

      web3Service = Web3Service.getInstance(mockConfig);
      await web3Service.initialize(mockWalletProvider);

      // Verify wallet provider was called EXACTLY ONCE during initialization
      expect(getNetworkSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transaction Preparation', () => {
    beforeEach(async () => {
      web3Service = Web3Service.getInstance(mockConfig);
      await web3Service.initialize(mockWalletProvider);

      // Clear spies after initialization
      getNetworkSpy.mockClear();
      getFeeDataSpy.mockClear();
      getTransactionCountSpy.mockClear();
    });

    it('should call wallet provider.getNetwork() ONLY ONCE for network validation before transaction', async () => {
      // Network validation before transaction MUST check wallet's network (one call is acceptable)
      // This ensures wallet is on correct chain before signing
      // We only want to avoid repeated calls during page rendering

      // Mock fetch for funding wallet
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, message: 'Wallet funded' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: '0x186a0' }) // 100000 gas estimate
        } as Response);

      try {
        await web3Service.fundAndSendTransaction({
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          value: '0'
        });
      } catch (error) {
        // Transaction will fail, but we only care that getNetwork() was called ONCE
      }

      // Verify wallet provider was called EXACTLY ONCE for network validation (acceptable)
      expect(getNetworkSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT call wallet provider.getFeeData() when getting gas prices', async () => {
      // RED PHASE: This test should FAIL because current code calls provider.getFeeData()
      // at line 1014 of web3.ts in fundAndSendTransaction

      // Mock fetch for funding wallet
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, message: 'Wallet funded' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: '0x186a0' }) // 100000 gas estimate
        } as Response);

      try {
        await web3Service.fundAndSendTransaction({
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          value: '0'
        });
      } catch (error) {
        // Transaction will fail, but we only care about getFeeData() not being called
      }

      // Verify wallet provider was NOT called for gas fee data
      expect(getFeeDataSpy).not.toHaveBeenCalled();
    });
  });
});
