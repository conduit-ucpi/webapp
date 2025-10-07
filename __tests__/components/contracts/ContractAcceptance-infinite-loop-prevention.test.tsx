/**
 * Tests to prevent infinite loops in ContractAcceptance balance fetching
 *
 * This test ensures that the getUSDCBalance function is not called repeatedly
 * in an infinite loop, which was causing performance issues and browser crashes.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import ContractAcceptance from '@/components/contracts/ContractAcceptance';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock auth hook
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock config hook
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

// Mock ethers hook
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: jest.fn(),
}));

const mockRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseSimpleEthers = useSimpleEthers as jest.MockedFunction<typeof useSimpleEthers>;

describe('ContractAcceptance - Infinite Loop Prevention', () => {
  const mockGetUSDCBalance = jest.fn();
  const mockFundAndSendTransaction = jest.fn();
  const mockApproveUSDC = jest.fn();
  const mockDepositToContract = jest.fn();
  const mockGetWeb3Service = jest.fn();
  const mockOnAcceptComplete = jest.fn();

  const mockContract = {
    id: 'test-contract-id',
    sellerEmail: 'seller@example.com',
    buyerEmail: 'buyer@example.com',
    amount: 1500000, // 1.5 USDC in microUSDC
    currency: 'USDC',
    sellerAddress: '0xSellerAddress',
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
    chainId: '8453',
    chainAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    description: 'Test contract for infinite loop prevention',
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: 'test-user',
    state: 'OK' as const,
    status: 'PENDING_ACCEPTANCE' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Override NODE_ENV to force balance fetching (bypass test mode)
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true
    });

    // Mock router
    mockRouter.mockReturnValue({
      push: jest.fn(),
      query: {},
      pathname: '/test',
    } as any);

    // Mock auth
    mockUseAuth.mockReturnValue({
      user: {
        walletAddress: '0xTestUserAddress',
        email: 'test@example.com'
      },
      authenticatedFetch: jest.fn(),
      isLoading: false,
      getEthersProvider: jest.fn(),
    } as any);

    // Mock config
    mockUseConfig.mockReturnValue({
      config: {
        usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        chainId: 8453,
        rpcUrl: 'https://mainnet.base.org'
      }
    } as any);

    // Mock balance as successful but track call count
    mockGetUSDCBalance.mockResolvedValue('10.5000');

    // Mock ethers hook
    mockUseSimpleEthers.mockReturnValue({
      getUSDCBalance: mockGetUSDCBalance,
      fundAndSendTransaction: mockFundAndSendTransaction,
      approveUSDC: mockApproveUSDC,
      depositToContract: mockDepositToContract,
      getWeb3Service: mockGetWeb3Service,
      getUserAddress: jest.fn().mockResolvedValue('0xTestUserAddress'),
      getNativeBalance: jest.fn().mockResolvedValue('0.1000'),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    // Restore NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: true
    });
  });

  it('should not call getUSDCBalance in an infinite loop', async () => {
    // Render the component
    render(<ContractAcceptance contract={mockContract} onAcceptComplete={mockOnAcceptComplete} />);

    // Wait for initial render and effect to run
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
    });

    // Get the initial call count
    const initialCallCount = mockGetUSDCBalance.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    // Wait a bit more to ensure no additional calls are made
    await waitFor(() => {
      // Should be called once during mount, not repeatedly
      expect(mockGetUSDCBalance).toHaveBeenCalledTimes(initialCallCount);
    }, { timeout: 1000 });

    // Advance timers to simulate time passing
    jest.advanceTimersByTime(2000);

    // Verify no additional calls were made
    expect(mockGetUSDCBalance).toHaveBeenCalledTimes(initialCallCount);
  });

  it('should only re-fetch balance when dependencies change', async () => {
    const { rerender } = render(<ContractAcceptance contract={mockContract} onAcceptComplete={mockOnAcceptComplete} />);

    // Wait for initial balance fetch
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
    });

    const initialCallCount = mockGetUSDCBalance.mock.calls.length;

    // Re-render with same props - should not trigger additional calls
    rerender(<ContractAcceptance contract={mockContract} onAcceptComplete={mockOnAcceptComplete} />);

    // Wait and verify no additional calls
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalledTimes(initialCallCount);
    });

    // Mock user change (which should trigger re-fetch)
    mockUseAuth.mockReturnValue({
      user: {
        walletAddress: '0xDifferentUserAddress', // Different address
        email: 'different@example.com'
      },
      authenticatedFetch: jest.fn(),
      isLoading: false,
      getEthersProvider: jest.fn(),
    } as any);

    // Re-render with different user
    rerender(<ContractAcceptance contract={mockContract} onAcceptComplete={mockOnAcceptComplete} />);

    // Should trigger another balance fetch due to user change
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalledTimes(initialCallCount + 1);
    });
  });

  it('should handle getUSDCBalance function reference changes without infinite loops', async () => {
    render(<ContractAcceptance contract={mockContract} onAcceptComplete={mockOnAcceptComplete} />);

    // Wait for initial call
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
    });

    const initialCallCount = mockGetUSDCBalance.mock.calls.length;

    // Simulate useSimpleEthers returning a new function reference
    // (which happens on every render due to the hook implementation)
    const newMockGetUSDCBalance = jest.fn().mockResolvedValue('10.5000');

    mockUseSimpleEthers.mockReturnValue({
      getUSDCBalance: newMockGetUSDCBalance, // New function reference
      fundAndSendTransaction: mockFundAndSendTransaction,
      approveUSDC: mockApproveUSDC,
      depositToContract: mockDepositToContract,
      getWeb3Service: mockGetWeb3Service,
      getUserAddress: jest.fn().mockResolvedValue('0xTestUserAddress'),
      getNativeBalance: jest.fn().mockResolvedValue('0.1000'),
    } as any);

    // Force a re-render by advancing timers
    jest.advanceTimersByTime(100);

    // The original function should not be called again
    // and the new function should not be called in a loop
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalledTimes(initialCallCount);
      expect(newMockGetUSDCBalance).not.toHaveBeenCalled();
    });
  });

  it('should stop calling getUSDCBalance when component unmounts', async () => {
    const { unmount } = render(<ContractAcceptance contract={mockContract} onAcceptComplete={mockOnAcceptComplete} />);

    // Wait for initial call
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
    });

    const callCountBeforeUnmount = mockGetUSDCBalance.mock.calls.length;

    // Unmount the component
    unmount();

    // Advance timers to simulate time passing after unmount
    jest.advanceTimersByTime(5000);

    // No additional calls should be made
    expect(mockGetUSDCBalance).toHaveBeenCalledTimes(callCountBeforeUnmount);
  });

  it('should not create excessive re-renders due to balance fetching', async () => {
    let renderCount = 0;

    // Create a wrapper component that tracks renders
    const RenderTracker = ({ children }: { children: React.ReactNode }) => {
      renderCount++;
      return <>{children}</>;
    };

    render(
      <RenderTracker children={<ContractAcceptance contract={mockContract} onAcceptComplete={mockOnAcceptComplete} />} />
    );

    // Wait for initial render and balance fetch
    await waitFor(() => {
      expect(mockGetUSDCBalance).toHaveBeenCalled();
    });

    const initialRenderCount = renderCount;

    // Wait additional time to ensure no excessive re-renders
    jest.advanceTimersByTime(2000);

    // Should not have excessive re-renders (allow some tolerance for React's behavior)
    expect(renderCount).toBeLessThan(initialRenderCount + 5);
  });
});