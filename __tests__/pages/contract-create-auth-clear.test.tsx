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

describe('ContractCreate - Auth Session Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      basePath: '',
      push: mockRouterPush,
      pathname: '/contract-create',
    });
  });

  it('should NOT call disconnect() on mount - existing sessions should persist', async () => {
    // Render the component
    render(<ContractCreate />);

    // Wait a bit to ensure useEffect would have run
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify disconnect was NOT called (we preserve existing sessions)
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('should allow user to remain authenticated across page loads', async () => {
    // Mock a user with existing session
    jest.spyOn(require('@/components/auth'), 'useAuth').mockReturnValueOnce({
      user: {
        userId: 'existing-user',
        email: 'existing@example.com',
        walletAddress: '0xexisting',
        authProvider: 'web3auth'
      },
      isLoading: false,
      isConnected: true,
      disconnect: mockDisconnect,
      authenticatedFetch: mockAuthenticatedFetch,
      getEthersProvider: jest.fn(),
    });

    render(<ContractCreate />);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify disconnect was NOT called - session persists
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('should not unnecessarily clear auth state during component lifecycle', async () => {
    const { rerender } = render(<ContractCreate />);

    // Wait for initial render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify no disconnect on initial render
    expect(mockDisconnect).not.toHaveBeenCalled();

    // Force a re-render
    rerender(<ContractCreate />);

    // Wait again
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify disconnect was still not called
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('should rely on auth system to handle expired sessions automatically', async () => {
    // The auth system (via refreshUserData) handles expired sessions
    // No need to proactively disconnect on mount
    render(<ContractCreate />);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify we don't proactively disconnect
    expect(mockDisconnect).not.toHaveBeenCalled();

    // Note: If session is actually expired, refreshUserData will handle it
    // by triggering requestAuthentication() which prompts for signature only when needed
  });
});
