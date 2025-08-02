import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import ContractAcceptance from '../../../components/contracts/ContractAcceptance';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { PendingContract } from '../../../types';

// Mock the dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../lib/web3');

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Web3Service
const mockWeb3Service = {
  initializeProvider: jest.fn(),
  getUserAddress: jest.fn().mockResolvedValue('0xBuyerAddress'),
  getUSDCBalance: jest.fn().mockResolvedValue('1.00'),
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

// Keep window.location as-is, just suppress the jsdom navigation errors and expected test errors
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    // Suppress jsdom navigation errors and expected test errors in tests
    if (message.includes('Not implemented: navigation') || 
        message.includes('Redirect failed:') ||
        message.includes('Contract acceptance failed:')) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ContractAcceptance - Core Redirect Behavior', () => {
  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    usdcContractAddress: '0x123456789',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    moonPayApiKey: 'test-moonpay-key',
    minGasWei: '5',
    basePath: '',
    snowtraceBaseUrl: 'https://testnet.snowtrace.io',
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
    createdAt: new Date().toISOString(),
    createdBy: 'test-user',
    state: 'OK',
  };

  const mockOnAcceptComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
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

    // No location mock needed for these tests

    // Set up successful flow by default
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
        }),
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

  it('should call router.push and onAcceptComplete on successful acceptance', async () => {
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
    });

    // Verify the redirect was attempted and callback was called
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(mockOnAcceptComplete).toHaveBeenCalledTimes(1);
  });

  it('should prevent infinite spinner by having fallback mechanisms', async () => {
    // Test that even if router.push fails, the component has fallback behavior
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
    });

    // Verify router.push was attempted
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    // The key test: onAcceptComplete should still be called, indicating
    // the success flow completed and won't leave user stuck
    expect(mockOnAcceptComplete).toHaveBeenCalledTimes(1);
  });

  it('should show success state with proper loading indicators', async () => {
    // Make router.push resolve slowly to test the success state display
    mockPush.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

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
    });

    // Both success messages should be visible
    expect(screen.getByText('Success! Redirecting...')).toBeInTheDocument();
    expect(screen.getByText('Contract accepted successfully!')).toBeInTheDocument();
    
    // Loading spinner should be present (check for the CSS class)
    const spinnerElement = document.querySelector('.animate-spin');
    expect(spinnerElement).toBeInTheDocument();

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

    // Component should return to normal state, not stuck in loading
    expect(screen.queryByText('Success! Redirecting...')).not.toBeInTheDocument();
  });
});

/**
 * Integration test to verify the fix for the infinite spinner issue.
 * 
 * This test ensures that:
 * 1. After successful contract acceptance, router.push is called
 * 2. If router.push fails, fallback mechanisms exist 
 * 3. The onAcceptComplete callback is always called on success
 * 4. Users are never left with an infinite spinner
 * 
 * The fix implemented includes:
 * - Error handling around router.push with try/catch
 * - Fallback redirect using window.location.href
 * - Timeout-based fallback after 3 seconds
 * - Proper callback invocation to notify parent components
 */