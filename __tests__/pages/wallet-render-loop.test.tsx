/**
 * Test to detect render loops in the Wallet page
 *
 * This test should FAIL with the current code that has loadBalances in the useEffect deps
 * and PASS after we remove it from the dependency array.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import Wallet from '@/pages/wallet';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';

// Mock all the dependencies
jest.mock('@/components/auth');
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/hooks/useWalletAddress');
jest.mock('@/components/farcaster/FarcasterDetectionProvider');
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: jest.fn()
}));

// Mock Dynamic SDK
jest.mock('@dynamic-labs/sdk-react-core', () => ({
  ...jest.requireActual('@dynamic-labs/sdk-react-core'),
  DynamicEmbeddedWidget: jest.fn(() => (
    <div data-testid="dynamic-embedded-widget">Dynamic Embedded Widget Mock</div>
  )),
  useDynamicContext: jest.fn(),
}));

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

describe('Wallet Page - Render Loop Detection', () => {
  const mockUser = {
    userId: 'test-user',
    email: 'test@example.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
    authProvider: 'dynamic'
  };

  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    dynamicEnvironmentId: 'test-dynamic-env-id',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerBaseUrl: 'https://basescan.org',
    usdcContractAddress: USDC_ADDRESS,
    usdtContractAddress: USDT_ADDRESS,
    contractFactoryAddress: '0xFactory',
    moonPayApiKey: 'test-key',
    minGasWei: '1000000000',
    maxGasPriceGwei: '100',
    maxGasCostGwei: '1000',
    usdcGrantFoundryGas: '100000',
    depositFundsFoundryGas: '200000',
    gasPriceBuffer: '1.2',
    basePath: 'https://test.conduit-ucpi.com',
    serviceLink: 'https://test.conduit-ucpi.com'
  };

  const mockDynamicContext = {
    primaryWallet: {
      address: mockUser.walletAddress,
      key: 'dynamic-embedded-wallet',
      connector: {
        name: 'Embedded Wallet',
        key: 'embedded'
      }
    },
    user: mockUser
  };

  const mockState = {
    isConnected: true,
    providerName: 'dynamic'
  };

  let getNativeBalanceMock: jest.Mock;
  let getUSDCBalanceMock: jest.Mock;
  let getUserAddressMock: jest.Mock;

  beforeEach(() => {
    // Create spies to track how many times functions are called
    getNativeBalanceMock = jest.fn().mockResolvedValue('0.5000');
    getUSDCBalanceMock = jest.fn().mockResolvedValue('100.00');
    getUserAddressMock = jest.fn().mockReturnValue(mockUser.walletAddress);

    // Mock useAuth
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      state: mockState,
      isLoading: false,
      getEthersProvider: jest.fn().mockResolvedValue({
        getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(8453) }),
        getBlockNumber: jest.fn().mockResolvedValue(12345),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000) // 1 gwei
        })
      }),
      showWalletUI: jest.fn()
    });

    // Mock useConfig
    (useConfig as jest.Mock).mockReturnValue({
      config: mockConfig,
      isLoading: false
    });

    // Mock useDynamicContext
    (useDynamicContext as jest.Mock).mockReturnValue(mockDynamicContext);

    // Mock useWalletAddress
    (useWalletAddress as jest.Mock).mockReturnValue({
      walletAddress: mockUser.walletAddress,
      isLoading: false
    });

    // Mock useFarcaster
    (useFarcaster as jest.Mock).mockReturnValue({
      isInFarcaster: false
    });

    // Mock useSimpleEthers with our spy functions
    (useSimpleEthers as jest.Mock).mockReturnValue({
      fundAndSendTransaction: jest.fn(),
      getUSDCBalance: getUSDCBalanceMock,
      getNativeBalance: getNativeBalanceMock,
      getUserAddress: getUserAddressMock
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('🔴 SHOULD FAIL: Detects excessive balance loading calls (render loop)', async () => {
    // Render the component
    render(<Wallet />);

    // Wait for initial render and effects to run
    await waitFor(() => {
      expect(getNativeBalanceMock).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Get the initial call count
    const initialNativeBalanceCalls = getNativeBalanceMock.mock.calls.length;
    const initialUSDCBalanceCalls = getUSDCBalanceMock.mock.calls.length;

    console.log('📊 Initial balance loading calls:', {
      nativeBalance: initialNativeBalanceCalls,
      usdcBalance: initialUSDCBalanceCalls
    });

    // Wait a bit to see if there are additional unnecessary calls
    await new Promise(resolve => setTimeout(resolve, 500));

    const finalNativeBalanceCalls = getNativeBalanceMock.mock.calls.length;
    const finalUSDCBalanceCalls = getUSDCBalanceMock.mock.calls.length;

    console.log('📊 Final balance loading calls after 500ms:', {
      nativeBalance: finalNativeBalanceCalls,
      usdcBalance: finalUSDCBalanceCalls,
      additionalNativeCalls: finalNativeBalanceCalls - initialNativeBalanceCalls,
      additionalUSDCCalls: finalUSDCBalanceCalls - initialUSDCBalanceCalls
    });

    // CRITICAL: Balance functions should only be called ONCE after initial render
    // If there's a render loop, they'll be called multiple times

    // Allow for 1 initial call, but no more than 2 total calls
    // (accounting for React 18 strict mode double render in dev)
    const MAX_ACCEPTABLE_CALLS = 2;

    if (finalNativeBalanceCalls > MAX_ACCEPTABLE_CALLS || finalUSDCBalanceCalls > MAX_ACCEPTABLE_CALLS) {
      console.error('❌ RENDER LOOP DETECTED!');
      console.error(`   Native balance called ${finalNativeBalanceCalls} times (expected ≤ ${MAX_ACCEPTABLE_CALLS})`);
      console.error(`   USDC balance called ${finalUSDCBalanceCalls} times (expected ≤ ${MAX_ACCEPTABLE_CALLS})`);
      console.error('');
      console.error('🐛 BUG: loadBalances is in the useEffect dependency array');
      console.error('   Location: pages/wallet.tsx line 196');
      console.error('   Fix: Remove loadBalances from the deps array');
      console.error('');
      console.error('   Current (BUGGY):');
      console.error('   }, [user, config, state?.isConnected, loadBalances]);');
      console.error('');
      console.error('   Should be (FIXED):');
      console.error('   }, [user, config, state?.isConnected]);');
    }

    expect(finalNativeBalanceCalls).toBeLessThanOrEqual(MAX_ACCEPTABLE_CALLS);
    expect(finalUSDCBalanceCalls).toBeLessThanOrEqual(MAX_ACCEPTABLE_CALLS);
  });

  test('Provides helpful debugging when render loop is detected', async () => {
    // Track all calls over time
    const callTimeline: Array<{ time: number; function: string }> = [];

    getNativeBalanceMock.mockImplementation(async () => {
      callTimeline.push({ time: Date.now(), function: 'getNativeBalance' });
      return '0.5000';
    });

    getUSDCBalanceMock.mockImplementation(async () => {
      callTimeline.push({ time: Date.now(), function: 'getUSDCBalance' });
      return '100.00';
    });

    render(<Wallet />);

    await waitFor(() => {
      expect(getNativeBalanceMock).toHaveBeenCalled();
    }, { timeout: 3000 });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Analyze the call timeline
    if (callTimeline.length > 4) { // More than 2 complete balance loads
      console.log('');
      console.log('📈 RENDER LOOP TIMELINE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const startTime = callTimeline[0].time;
      callTimeline.forEach((call, index) => {
        const elapsed = call.time - startTime;
        console.log(`  ${index + 1}. [+${elapsed}ms] ${call.function}()`);
      });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Total calls: ${callTimeline.length}`);
      console.log(`  Expected: ≤ 4 (2 functions × 2 calls max)`);
      console.log('');
    }

    expect(callTimeline.length).toBeLessThanOrEqual(4);
  });
});
