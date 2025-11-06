/**
 * Test to count actual renders of the Wallet component
 *
 * This test determines if excessive wallet detection calls are due to:
 * 1. Excessive renders (the component re-renders too many times)
 * 2. OR the detection function being called multiple times per render
 */

import React from 'react';
import { render } from '@testing-library/react';
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

// Track render count
let renderCount = 0;

// Mock Dynamic SDK with render tracking
jest.mock('@dynamic-labs/sdk-react-core', () => ({
  ...jest.requireActual('@dynamic-labs/sdk-react-core'),
  DynamicEmbeddedWidget: jest.fn(() => {
    renderCount++;
    return <div data-testid="dynamic-embedded-widget">Dynamic Widget (Render #{renderCount})</div>;
  }),
  useDynamicContext: jest.fn(),
}));

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

describe('Wallet Page - Render Count Analysis', () => {
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

  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    renderCount = 0;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Mock useAuth
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      state: mockState,
      isLoading: false,
      getEthersProvider: jest.fn().mockResolvedValue({
        getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(8453) }),
        getBlockNumber: jest.fn().mockResolvedValue(12345),
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt(1000000000)
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

    // Mock useSimpleEthers
    (useSimpleEthers as jest.Mock).mockReturnValue({
      fundAndSendTransaction: jest.fn(),
      getUSDCBalance: jest.fn().mockResolvedValue('100.00'),
      getNativeBalance: jest.fn().mockResolvedValue('0.5000'),
      getUserAddress: jest.fn().mockReturnValue(mockUser.walletAddress)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  test('🔴 SHOULD FAIL: Detects excessive renders from state updates', async () => {
    render(<Wallet />);

    // Wait for async state updates to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Count wallet detection calls
    const detectionCalls = consoleLogSpy.mock.calls.filter(call =>
      call.some((arg: any) =>
        typeof arg === 'string' && arg.includes('🔧 Dynamic wallet detection check')
      )
    );

    console.log('');
    console.log('📊 RENDER ANALYSIS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  DynamicEmbeddedWidget renders: ${renderCount}`);
    console.log(`  Detection function calls: ${detectionCalls.length}`);
    console.log(`  Ratio: ${(detectionCalls.length / Math.max(renderCount, 1)).toFixed(1)} detection calls per widget render`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (renderCount > 2) {
      console.error('❌ EXCESSIVE RENDERS DETECTED!');
      console.error(`   DynamicEmbeddedWidget rendered ${renderCount} times (expected ≤ 2)`);
      console.error('');
      console.error('🐛 ROOT CAUSE: Multiple state updates cause multiple renders');
      console.error('   Location: pages/wallet.tsx lines 151, 171, 184 (balance loading)');
      console.error('   Location: pages/wallet.tsx lines 63, 126, 136 (chain info loading)');
      console.error('');
      console.error('   Each setIsLoadingBalances/setBalances/setChainInfo call triggers a render');
      console.error('   And each render calls isDynamicEmbeddedWallet() which logs excessively');
      console.error('');
      console.error('🔧 FIXES NEEDED:');
      console.error('   1. Memoize isDynamicEmbeddedWallet() result with useMemo');
      console.error('   2. Reduce logging in isDynamicEmbeddedWallet()');
      console.error('   3. Consider batching state updates (React 18 auto-batches in event handlers)');
      console.error('');
    }

    // CRITICAL: Should have at most 2 renders (React strict mode)
    // Currently fails because async state updates cause ~7 renders
    expect(renderCount).toBeLessThanOrEqual(2);
  });
});
