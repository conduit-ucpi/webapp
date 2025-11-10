/**
 * Test for wallet page balance loading timing issue
 *
 * Bug: Balance loading starts when user exists but wallet isn't connected yet
 * Fix: Only load balances when isConnected is true
 */

import { render, waitFor } from '@testing-library/react';
import Wallet from '@/pages/wallet';
import React from 'react';

// Mock all dependencies
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: jest.fn(),
}));

jest.mock('@/components/farcaster/FarcasterDetectionProvider', () => ({
  useFarcaster: jest.fn(),
}));

jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: jest.fn(),
}));

jest.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: jest.fn(),
  DynamicUserProfile: () => null,
}));

jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

describe('Wallet Page - Connection Timing Bug', () => {
  const mockGetNativeBalance = jest.fn();
  const mockGetUSDCBalance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useDynamicContext to return a minimal object
    (useDynamicContext as jest.Mock).mockReturnValue({
      primaryWallet: null,
      user: null,
      setShowDynamicUserProfile: jest.fn()
    });

    // Mock farcaster
    (useFarcaster as jest.Mock).mockReturnValue({
      isInFarcaster: false,
    });

    // Mock wallet address
    (useWalletAddress as jest.Mock).mockReturnValue({
      walletAddress: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
      isLoading: false,
    });

    // Mock useSimpleEthers
    (useSimpleEthers as jest.Mock).mockReturnValue({
      provider: null,
      isReady: false,
      getWeb3Service: jest.fn(),
      fundAndSendTransaction: jest.fn(),
      getUSDCBalance: mockGetUSDCBalance,
      getNativeBalance: mockGetNativeBalance,
      getContractInfo: jest.fn(),
      getUserAddress: jest.fn(),
      approveUSDC: jest.fn(),
      depositToContract: jest.fn(),
    });
  });

  it('🔴 FAILS - calls balance loading when user exists but isConnected is false', async () => {
    // This reproduces the production bug:
    // Timeline from logs:
    // 03:09:11.773Z - isConnected: false, hasUser: false
    // 03:09:11.969Z - Balance loading starts (user must be truthy now!)
    // 03:09:11.971Z - ERROR: "Wallet not connected"

    const mockUser = {
      userId: 'test-user',
      walletAddress: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
      authProvider: 'external_wallet' as const,
    };

    const mockConfig = {
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    };

    // BUG: user exists but isConnected is FALSE (wallet still connecting)
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      state: { isConnected: false }, // ← THE BUG: wallet not ready yet!
      isLoading: false,
      getEthersProvider: jest.fn().mockResolvedValue(null),
      showWalletUI: jest.fn(),
    });

    (useConfig as jest.Mock).mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    // Mock balance methods to throw (simulating "Wallet not connected")
    mockGetNativeBalance.mockRejectedValue(new Error('Wallet not connected'));
    mockGetUSDCBalance.mockRejectedValue(new Error('Wallet not connected'));

    // Render the wallet page
    render(<Wallet />);

    // Wait for useEffect to run
    await waitFor(() => {
      // BUG: Balance loading should NOT be called when isConnected is false
      // But currently it IS called, causing the error
      expect(mockGetNativeBalance).not.toHaveBeenCalled();
      expect(mockGetUSDCBalance).not.toHaveBeenCalled();
    }, { timeout: 100 });
  });

  it('🟢 PASSES - only calls balance loading when isConnected is true', async () => {
    const mockUser = {
      userId: 'test-user',
      walletAddress: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
      authProvider: 'external_wallet' as const,
    };

    const mockConfig = {
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    };

    // FIX: user exists AND isConnected is TRUE
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      state: { isConnected: true }, // ← THE FIX: wait for wallet to be ready
      isLoading: false,
      getEthersProvider: jest.fn().mockResolvedValue({}),
      showWalletUI: jest.fn(),
    });

    (useConfig as jest.Mock).mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    // Mock successful balance loading
    mockGetNativeBalance.mockResolvedValue('0.1234');
    mockGetUSDCBalance.mockResolvedValue('100.00');

    // Render the wallet page
    render(<Wallet />);

    // Wait for balance loading to be called
    await waitFor(() => {
      expect(mockGetNativeBalance).toHaveBeenCalled();
      expect(mockGetUSDCBalance).toHaveBeenCalled();
    });
  });
});
