/**
 * Test: useSimpleEthers should minimize provider access calls
 *
 * Issue: On mobile with external wallets (MetaMask), multiple rapid calls to getEthersProvider()
 * cause multiple signing/connection prompts which confuse users
 *
 * Root Cause: getNativeBalance() calls getEthersProvider() TWICE:
 *   1. Once in getWeb3Service() to initialize Web3Service
 *   2. Again directly to get the provider for balance reading
 *
 * Expected: Each balance load should reuse the provider from Web3Service
 * Actual (before fix): getNativeBalance calls getEthersProvider twice
 */

import { renderHook } from '@testing-library/react';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('@/components/auth');
jest.mock('@/components/auth/ConfigProvider');

describe('useSimpleEthers - Provider Access Optimization', () => {
  let mockGetEthersProvider: jest.Mock;
  let callCount: number;

  beforeEach(async () => {
    jest.clearAllMocks();
    callCount = 0;

    // Clear Web3Service singleton to ensure fresh state
    const { Web3Service } = await import('@/lib/web3');
    Web3Service.clearInstance();

    // Track calls to getEthersProvider
    mockGetEthersProvider = jest.fn(async () => {
      callCount++;
      console.log(`getEthersProvider call #${callCount}`);

      // Return a mock provider
      return {
        getBalance: jest.fn(() => Promise.resolve(ethers.parseEther('1.5'))),
        getNetwork: jest.fn(() => Promise.resolve({ chainId: BigInt(8453), name: 'base' })),
        send: jest.fn()
      };
    });

    (useAuth as jest.Mock).mockReturnValue({
      isConnected: true,
      getEthersProvider: mockGetEthersProvider,
      authenticatedFetch: jest.fn()
    });

    (useConfig as jest.Mock).mockReturnValue({
      config: {
        chainId: 8453,
        rpcUrl: 'https://mainnet.base.org',
        usdcContractAddress: '0xUSDC',
        maxGasPriceGwei: '10',
        maxGasCostGwei: '1000',
        usdcGrantFoundryGas: '100000',
        gasPriceBuffer: '1.2'
      }
    });
  });

  it('should call getEthersProvider ZERO times when loading native balance', async () => {
    const { result } = renderHook(() => useSimpleEthers());

    const testAddress = '0x1234567890123456789012345678901234567890';
    await result.current.getNativeBalance(testAddress);

    // CRITICAL: Should NEVER call getEthersProvider for read-only balance operations!
    // Before fix: Called wallet provider (triggered MetaMask on mobile)
    // After fix: Uses READ-ONLY RPC provider (no wallet access!)
    console.log(`Total getEthersProvider calls: ${callCount}`);
    expect(callCount).toBe(0);
    expect(mockGetEthersProvider).toHaveBeenCalledTimes(0);
  });

  it('should call getEthersProvider ZERO times when loading both balances', async () => {
    const { result } = renderHook(() => useSimpleEthers());

    const testAddress = '0x1234567890123456789012345678901234567890';
    await Promise.all([
      result.current.getNativeBalance(testAddress),
      result.current.getUSDCBalance(testAddress)
    ]);

    // Before fix: Multiple calls to wallet provider
    // After fix: ZERO calls - uses READ-ONLY RPC provider!
    console.log(`Total getEthersProvider calls for both balances: ${callCount}`);
    expect(callCount).toBe(0);
    expect(mockGetEthersProvider).toHaveBeenCalledTimes(0);
  });
});
