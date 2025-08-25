import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { useRouter } from 'next/router';
import ContractAcceptance from '../../../components/contracts/ContractAcceptance';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth/AuthProvider';
import { PendingContract } from '../../../types';

// Mock the dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth/AuthProvider');
jest.mock('../../../lib/web3');

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Web3Service
const mockWeb3Service = {
  initializeProvider: jest.fn().mockResolvedValue(undefined),
  getUserAddress: jest.fn().mockResolvedValue('0xBuyerAddress'),
  getUSDCBalance: jest.fn().mockResolvedValue('1.00'),
  signContractTransaction: jest.fn().mockImplementation((params) => {
    if (params.functionName === 'raiseDispute') return Promise.resolve('mock-dispute-tx');
    if (params.functionName === 'claimFunds') return Promise.resolve('mock-claim-tx');
    if (params.functionName === 'approve') return Promise.resolve('mock-approval-tx');
    if (params.functionName === 'depositFunds') return Promise.resolve('mock-deposit-tx');
    return Promise.resolve('mock-signed-tx');
  }),
  // Legacy mocks for backward compatibility - can be removed later
  signUSDCApproval: jest.fn().mockResolvedValue('mock-approval-tx'),
  signDepositTransaction: jest.fn().mockResolvedValue('mock-deposit-tx'),
};

jest.mock('../../../lib/web3', () => ({
  Web3Service: jest.fn().mockImplementation(() => mockWeb3Service),
}));

// Mock Web3Auth provider
Object.defineProperty(window, 'web3authProvider', {
  value: { request: jest.fn() },
  writable: true,
});

// Mock window.alert
global.alert = jest.fn();

// Create a location mock that doesn't trigger JSDOM navigation errors
const createLocationMock = () => ({
  href: '',
  pathname: '/current-page',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  toString: () => '',
});

// Delete the original location
delete (window as any).location;

describe('ContractAcceptance - Redirect Behavior (Simplified)', () => {
  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    usdcContractAddress: '0x123456789',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    moonPayApiKey: 'test-moonpay-key',
    minGasWei: '5',
    basePath: '',
    explorerBaseUrl: 'https://testnet.snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  const testContract: PendingContract = {
    id: 'test-contract-123',
    sellerEmail: 'seller@test.com',
    buyerEmail: 'buyer@test.com',
    amount: 250000,
    currency: 'USDC',
    sellerAddress: '0xSellerAddress',
    expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
    description: 'Test contract for redirect behavior',
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: 'test-user',
    state: 'OK',
  };

  const mockOnAcceptComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up a clean window.location mock for each test
    (window as any).location = createLocationMock();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      basePath: '',
      pathname: '/current-page',
      query: {},
      asPath: '/current-page',
    } as any);

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    mockUseAuth.mockReturnValue({
      user: { userId: 'test-user-id', walletAddress: '0xBuyerAddress', email: 'buyer@test.com' },
      connect: jest.fn(),
      walletAddress: null,
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
      getWalletProvider: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    });
    
    // Reset all Web3Service mocks
    mockWeb3Service.initializeProvider.mockResolvedValue(undefined);
    mockWeb3Service.getUserAddress.mockResolvedValue('0xBuyerAddress');
    mockWeb3Service.getUSDCBalance.mockResolvedValue('1.00');
    mockWeb3Service.signUSDCApproval.mockResolvedValue('mock-approval-tx');
    mockWeb3Service.signDepositTransaction.mockResolvedValue('mock-deposit-tx');
    
    // Mock the global window.web3authProvider
    (window as any).web3authProvider = {
      request: jest.fn().mockResolvedValue({}),
    };

    // Reset fetch mock completely and set up successful flow by default
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(testContract), // Contract status check
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          contractAddress: '0xContractAddress',
        }), // Contract creation
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }), // USDC approval
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }), // Fund deposit
      });
  });

  it('should call router.push and onAcceptComplete on successful contract acceptance', async () => {
    mockPush.mockResolvedValue(true);

    render(
      <ContractAcceptance 
        contract={testContract} 
        onAcceptComplete={mockOnAcceptComplete} 
      />
    );

    const acceptButton = screen.getByText(/Make Payment of/);
    fireEvent.click(acceptButton);

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText('Success! Redirecting...')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Verify the redirect was attempted
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(mockOnAcceptComplete).toHaveBeenCalledTimes(1);
  });

  it('should attempt fallback redirect when router.push fails', async () => {
    // Make router.push reject
    mockPush.mockRejectedValue(new Error('Router navigation failed'));

    render(
      <ContractAcceptance 
        contract={testContract} 
        onAcceptComplete={mockOnAcceptComplete} 
      />
    );

    const acceptButton = screen.getByText(/Make Payment of/);
    fireEvent.click(acceptButton);

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText('Success! Redirecting...')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Wait for the error handling to complete
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    // The fallback redirect should be attempted
    expect(mockOnAcceptComplete).toHaveBeenCalledTimes(1);
  });

  it('should prevent multiple button clicks during processing', async () => {
    mockPush.mockResolvedValue(true);

    render(
      <ContractAcceptance 
        contract={testContract} 
        onAcceptComplete={mockOnAcceptComplete} 
      />
    );

    const acceptButton = screen.getByText(/Make Payment of/);
    
    // Click multiple times rapidly
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton);

    // Wait for processing to start - the button should disappear and be replaced with loading state
    await waitFor(() => {
      expect(screen.getByText('Checking contract status...')).toBeInTheDocument();
    });

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText('Success! Redirecting...')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Should only process once despite multiple clicks
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockOnAcceptComplete).toHaveBeenCalledTimes(1);
  });

  it('should show success message and spinner during redirect', async () => {
    // Make router.push hang to keep the success state visible
    mockPush.mockImplementation(() => new Promise(() => {}));

    render(
      <ContractAcceptance 
        contract={testContract} 
        onAcceptComplete={mockOnAcceptComplete} 
      />
    );

    const acceptButton = screen.getByText(/Make Payment of/);
    fireEvent.click(acceptButton);

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText('Success! Redirecting...')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Both success messages should be visible
    expect(screen.getByText('Success! Redirecting...')).toBeInTheDocument();
    expect(screen.getByText('Contract accepted successfully!')).toBeInTheDocument();
    
    // Loading spinner should be present
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    expect(mockOnAcceptComplete).toHaveBeenCalledTimes(1);
  });

  it('should not redirect when contract acceptance fails', async () => {
    // Make contract creation fail
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(testContract), // Contract status check
      })
      .mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Contract creation failed' }),
      });

    render(
      <ContractAcceptance 
        contract={testContract} 
        onAcceptComplete={mockOnAcceptComplete} 
      />
    );

    const acceptButton = screen.getByText(/Make Payment of/);
    fireEvent.click(acceptButton);

    // Wait for error to be handled
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Contract creation failed');
    });

    // Should not redirect or call onAcceptComplete
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockOnAcceptComplete).not.toHaveBeenCalled();

    // Button should be enabled again for retry - find it again since the component re-renders
    const retryButton = screen.getByText(/Make Payment of/);
    expect(retryButton).toBeEnabled();
  });
});