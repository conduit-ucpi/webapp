/**
 * TDD Test: Verifies unified wallet UI for all users
 *
 * REQUIREMENT: The /wallet page must show the SAME UI for ALL users:
 * 1. Balance cards for native token and USDC
 * 2. Send form with USDC option
 * 3. Balance refresh functionality
 * 4. For embedded wallet users: ADDITIONAL button to open Dynamic modal
 * 5. NO auto-popup of the modal
 *
 * This ensures embedded wallet users get all the tools non-embedded users have,
 * PLUS access to Dynamic's modal for advanced wallet management.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Wallet from '@/pages/wallet';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';

// Mock all dependencies
jest.mock('@/components/auth');
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/hooks/useWalletAddress');
jest.mock('@/components/farcaster/FarcasterDetectionProvider');
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: jest.fn()
}));

// Mock DynamicUserProfile component
jest.mock('@dynamic-labs/sdk-react-core', () => ({
  ...jest.requireActual('@dynamic-labs/sdk-react-core'),
  DynamicUserProfile: jest.fn(() => (
    <div data-testid="dynamic-user-profile">Dynamic User Profile Modal</div>
  )),
  useDynamicContext: jest.fn(),
}));

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

describe('Wallet Page - Embedded Wallet Balances and Controls', () => {
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

  const mockGetUSDCBalance = jest.fn().mockResolvedValue('125.5000');
  const mockGetNativeBalance = jest.fn().mockResolvedValue('0.0234');

  beforeEach(() => {
    // Mock useAuth
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      state: {
        isConnected: true,
        providerName: 'dynamic'
      },
      isLoading: false,
      getEthersProvider: jest.fn().mockResolvedValue({
        getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(8453) }),
        getBlockNumber: jest.fn().mockResolvedValue(12345),
        getFeeData: jest.fn().mockResolvedValue({ gasPrice: BigInt('1000000000') })
      }),
      showWalletUI: jest.fn()
    });

    // Mock useConfig
    (useConfig as jest.Mock).mockReturnValue({
      config: mockConfig,
      isLoading: false
    });

    // Mock useDynamicContext to indicate embedded wallet
    (useDynamicContext as jest.Mock).mockReturnValue({
      primaryWallet: {
        address: mockUser.walletAddress,
        key: 'dynamic-embedded-wallet',
        connector: {
          name: 'Embedded Wallet',
          key: 'embedded'
        }
      },
      user: mockUser,
      setShowDynamicUserProfile: jest.fn()
    });

    // Mock useWalletAddress
    (useWalletAddress as jest.Mock).mockReturnValue({
      walletAddress: mockUser.walletAddress,
      isLoading: false
    });

    // Mock useFarcaster
    (useFarcaster as jest.Mock).mockReturnValue({
      isInFarcaster: false
    });

    // Mock useSimpleEthers with balance functions
    (useSimpleEthers as jest.Mock).mockReturnValue({
      fundAndSendTransaction: jest.fn(),
      getUSDCBalance: mockGetUSDCBalance,
      getNativeBalance: mockGetNativeBalance,
      getUserAddress: jest.fn().mockReturnValue(mockUser.walletAddress)
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('🔴 FAILING TEST: Embedded wallet users must see USDC balance card', async () => {
    render(<Wallet />);

    // Wait for balances to load
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify USDC balance is displayed
    const usdcBalanceLabel = screen.getByText('USDC Balance');
    expect(usdcBalanceLabel).toBeInTheDocument();

    // Verify actual balance value is shown in the balance card (text-2xl font-bold text-blue-900)
    await waitFor(() => {
      const balanceElements = screen.getAllByText(/125\.5000/);
      // Should find at least one element (in the balance card)
      expect(balanceElements.length).toBeGreaterThanOrEqual(1);
      // The first one should be in the balance card with the blue styling
      expect(balanceElements[0]).toHaveClass('text-blue-900');
    }, { timeout: 3000 });

    console.log('✅ Embedded wallet users can see USDC balance');
  });

  test('🔴 FAILING TEST: Embedded wallet users must see native token balance card', async () => {
    render(<Wallet />);

    // Wait for balances to load
    await waitFor(() => {
      expect(mockGetNativeBalance).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify native balance label is displayed
    const nativeBalanceLabel = screen.getByText('Native Token Balance');
    expect(nativeBalanceLabel).toBeInTheDocument();

    // Verify actual balance value is shown (use regex for flexibility)
    await waitFor(() => {
      const balanceElements = screen.getAllByText(/0\.0234/);
      expect(balanceElements.length).toBeGreaterThanOrEqual(1);
      // The first one should be in the balance card with the red styling
      expect(balanceElements[0]).toHaveClass('text-red-900');
    }, { timeout: 3000 });

    console.log('✅ Embedded wallet users can see native token balance');
  });

  test('🔴 FAILING TEST: Embedded wallet users must see send form with USDC option', async () => {
    render(<Wallet />);

    // Verify send form heading exists
    const sendFormHeading = screen.getByText('Send Funds');
    expect(sendFormHeading).toBeInTheDocument();

    // Verify USDC radio button exists
    const usdcRadio = screen.getByLabelText(/USDC/i);
    expect(usdcRadio).toBeInTheDocument();

    // Verify send button exists
    const sendButton = screen.getByRole('button', { name: /Send USDC/i });
    expect(sendButton).toBeInTheDocument();

    console.log('✅ Embedded wallet users can see send form with USDC controls');
  });

  test('🔴 FAILING TEST: Embedded wallet users can refresh balances', async () => {
    render(<Wallet />);

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
      expect(mockGetNativeBalance).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Find refresh button after loading completes
    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      expect(refreshButton).toBeInTheDocument();
      expect(refreshButton).not.toBeDisabled();
    }, { timeout: 3000 });

    console.log('✅ Embedded wallet users can refresh their balances');
  });

  test('🔴 FAILING TEST: Embedded wallet users see button to open Dynamic modal', () => {
    render(<Wallet />);

    // Find the button to open wallet settings/modal
    const openModalButton = screen.getByRole('button', { name: /Open Wallet Settings/i });
    expect(openModalButton).toBeInTheDocument();
    expect(openModalButton).not.toBeDisabled();

    console.log('✅ Embedded wallet users have a button to open Dynamic modal');
  });

  test('🔴 FAILING TEST: Dynamic modal does NOT auto-popup', () => {
    const mockSetShowDynamicUserProfile = jest.fn();

    (useDynamicContext as jest.Mock).mockReturnValue({
      primaryWallet: {
        address: mockUser.walletAddress,
        key: 'dynamic-embedded-wallet',
        connector: {
          name: 'Embedded Wallet',
          key: 'embedded'
        }
      },
      user: mockUser,
      setShowDynamicUserProfile: mockSetShowDynamicUserProfile
    });

    render(<Wallet />);

    // The modal should NOT be auto-opened
    expect(mockSetShowDynamicUserProfile).not.toHaveBeenCalledWith(true);

    console.log('✅ Dynamic modal does NOT auto-popup on page load');
  });

  test('Balance loading functions are called for embedded wallet users', async () => {
    render(<Wallet />);

    // Verify balance loading functions were called
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
      expect(mockGetNativeBalance).toHaveBeenCalled();
    }, { timeout: 3000 });

    console.log('✅ Balance loading is triggered for embedded wallet users');
  });
});
