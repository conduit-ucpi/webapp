/**
 * Test to detect excessive wallet detection function calls
 *
 * The isDynamicEmbeddedWallet() function should only run when dependencies change,
 * not on every render. This test ensures it's properly memoized.
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

describe('Wallet Page - Excessive Detection Prevention', () => {
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

  // Spy on console.log to detect excessive detection calls
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console.log
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

  test('🔴 SHOULD FAIL: Detects excessive wallet detection calls', () => {
    // Render the component
    render(<Wallet />);

    // Count how many times the wallet detection function was called
    // It logs "🔧 Dynamic wallet detection check:" every time
    const detectionCalls = consoleLogSpy.mock.calls.filter(call =>
      call.some((arg: any) =>
        typeof arg === 'string' && arg.includes('🔧 Dynamic wallet detection check')
      )
    );

    console.log('📊 Wallet detection function calls:', {
      totalCalls: detectionCalls.length,
      expected: '≤ 2 (1 initial + 1 for React strict mode)'
    });

    if (detectionCalls.length > 2) {
      console.error('❌ EXCESSIVE WALLET DETECTION CALLS DETECTED!');
      console.error(`   Detection function called ${detectionCalls.length} times (expected ≤ 2)`);
      console.error('');
      console.error('🐛 BUG: isDynamicEmbeddedWallet() is not memoized');
      console.error('   Location: pages/wallet.tsx line 323-378 (function)');
      console.error('   Location: pages/wallet.tsx line 402 (call site)');
      console.error('   Fix: Use useMemo to cache the result');
      console.error('');
      console.error('   Current (BUGGY):');
      console.error('   if (isDynamicEmbeddedWallet()) {');
      console.error('');
      console.error('   Should be (FIXED):');
      console.error('   const isEmbedded = useMemo(() => isDynamicEmbeddedWallet(), [deps])');
      console.error('   if (isEmbedded) {');
    }

    // CRITICAL: Function should only be called once per render cycle
    // Allow for 2 calls max (React 18 strict mode double render)
    expect(detectionCalls.length).toBeLessThanOrEqual(2);
  });

  test('Provides timeline of detection calls when excessive', () => {
    const callTimeline: Array<{ time: number; message: string }> = [];

    // Override console.log to track timing
    consoleLogSpy.mockImplementation((...args) => {
      const message = args.join(' ');
      if (message.includes('🔧 Dynamic wallet detection check')) {
        callTimeline.push({
          time: Date.now(),
          message: 'Wallet detection called'
        });
      }
    });

    render(<Wallet />);

    if (callTimeline.length > 2) {
      console.log('');
      console.log('📈 WALLET DETECTION CALL TIMELINE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const startTime = callTimeline[0]?.time || Date.now();
      callTimeline.forEach((call, index) => {
        const elapsed = call.time - startTime;
        console.log(`  ${index + 1}. [+${elapsed}ms] ${call.message}`);
      });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Total calls: ${callTimeline.length}`);
      console.log(`  Expected: ≤ 2`);
      console.log('');
    }

    expect(callTimeline.length).toBeLessThanOrEqual(2);
  });
});
