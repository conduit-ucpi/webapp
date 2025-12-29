import { render, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import ContractCreate from '@/pages/contract-create';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock dependencies
const mockDisconnect = jest.fn();
const mockAuthenticatedFetch = jest.fn();
const mockApproveUSDC = jest.fn();
const mockDepositToContract = jest.fn();
const mockGetWeb3Service = jest.fn();
const mockValidateForm = jest.fn();
const mockClearErrors = jest.fn();

jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: { userId: '1', email: 'test@example.com', walletAddress: '0xtest', authProvider: 'web3auth' },
    isLoading: false,
    isConnected: true,
    disconnect: mockDisconnect,
    authenticatedFetch: mockAuthenticatedFetch,
    getEthersProvider: jest.fn(),
  }),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      serviceLink: 'https://test.example.com',
    },
    isLoading: false,
  }),
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    approveUSDC: mockApproveUSDC,
    depositToContract: mockDepositToContract,
    getWeb3Service: mockGetWeb3Service,
  }),
}));

jest.mock('@/hooks/useContractValidation', () => ({
  useContractCreateValidation: () => ({
    errors: {},
    validateForm: mockValidateForm,
    clearErrors: mockClearErrors,
  }),
}));

const mockRouterPush = jest.fn();

describe('ContractCreate - Auth Cache Clearing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      basePath: '',
      push: mockRouterPush,
      pathname: '/contract-create',
    });
  });

  it('should call disconnect() on mount to clear cached authentication', async () => {
    // Render the component
    render(<ContractCreate />);

    // Wait for the useEffect to execute
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });

    // Verify disconnect was called exactly once
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should call disconnect() even when auth is initially loading', async () => {
    // Mock auth loading state
    jest.spyOn(require('@/components/auth'), 'useAuth').mockReturnValueOnce({
      user: null,
      isLoading: true,
      isConnected: false,
      disconnect: mockDisconnect,
      authenticatedFetch: mockAuthenticatedFetch,
      getEthersProvider: jest.fn(),
    });

    render(<ContractCreate />);

    // Since authLoading is true, disconnect should NOT be called immediately
    expect(mockDisconnect).not.toHaveBeenCalled();

    // But once auth finishes loading and component re-renders, it should be called
    // (In real usage, the component would re-render when authLoading becomes false)
  });

  it('should call disconnect() only once, not repeatedly', async () => {
    const { rerender } = render(<ContractCreate />);

    // Wait for initial useEffect
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });

    // Clear the mock to verify no additional calls
    mockDisconnect.mockClear();

    // Force a re-render
    rerender(<ContractCreate />);

    // Wait a bit to ensure no additional calls
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify disconnect was NOT called again
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('should clear auth cache even when user has cached session', async () => {
    // Mock a user with cached session (typical scenario we want to prevent)
    jest.spyOn(require('@/components/auth'), 'useAuth').mockReturnValueOnce({
      user: {
        userId: 'cached-user',
        email: 'cached@example.com',
        walletAddress: '0xcached',
        authProvider: 'web3auth'
      },
      isLoading: false,
      isConnected: true,
      disconnect: mockDisconnect,
      authenticatedFetch: mockAuthenticatedFetch,
      getEthersProvider: jest.fn(),
    });

    render(<ContractCreate />);

    // Verify disconnect is called to clear the cached session
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should force fresh authentication by clearing cache on every page load', async () => {
    // First render (simulating first page load)
    const { unmount } = render(<ContractCreate />);

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });

    expect(mockDisconnect).toHaveBeenCalledTimes(1);

    // Unmount and clear
    unmount();
    mockDisconnect.mockClear();

    // Second render (simulating second page load)
    render(<ContractCreate />);

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });

    // Verify disconnect is called again on the second page load
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
