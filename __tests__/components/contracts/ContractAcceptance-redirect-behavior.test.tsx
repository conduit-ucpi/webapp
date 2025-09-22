import { render, act } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');
jest.mock('../../../lib/web3');

import { useRouter } from 'next/router';
import ContractAcceptance from '../../../components/contracts/ContractAcceptance';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth';
import { PendingContract } from '../../../types';

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
  signContractTransaction: jest.fn().mockImplementation((params) => {
    if (params.functionName === 'raiseDispute') return Promise.resolve('mock-dispute-tx');
    if (params.functionName === 'claimFunds') return Promise.resolve('mock-claim-tx');
    if (params.functionName === 'approve') return Promise.resolve('mock-approval-tx');
    if (params.functionName === 'depositFunds') return Promise.resolve('mock-deposit-tx');
    return Promise.resolve('mock-signed-tx');
  }),
  signUSDCApproval: jest.fn().mockResolvedValue('mock-approval-tx'),
  signDepositTransaction: jest.fn().mockResolvedValue('mock-deposit-tx'),
};

jest.mock('../../../lib/web3', () => ({
  Web3Service: jest.fn().mockImplementation(() => mockWeb3Service),
}));

// Mock Web3Auth provider
Object.defineProperty(window, 'web3authProvider', {
  value: {
    request: jest.fn(),
  },
  writable: true,
});

// Mock window.alert and window.location
global.alert = jest.fn();

// Create a more robust location mock that doesn't trigger JSDOM navigation
const createLocationMock = () => ({
  href: '',
  pathname: '/dashboard',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  toString: () => '',
});

describe('ContractAcceptance - Redirect Behavior', () => {
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
    amount: 250000, // 0.25 USDC in microUSDC format
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
    jest.useFakeTimers();
    
    // Create fresh location mock for each test
    delete (window as any).location;
    (window as any).location = createLocationMock();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      basePath: '',
      pathname: '/dashboard',
      query: {},
      asPath: '/dashboard',
    } as any);

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    mockUseAuth.mockReturnValue({
      user: { userId: 'test-user-id', walletAddress: '0xBuyerAddress', email: 'buyer@test.com', authProvider: 'web3auth' as const },
      connect: jest.fn(),
      disconnect: jest.fn(),
      isLoading: false,
      isConnected: true,
      isInitialized: true,
      error: null,
      token: 'mock-token',
      providerName: 'web3auth',
      getToken: jest.fn(() => 'mock-token'),
      hasVisitedBefore: jest.fn(() => false),
      markAsVisited: jest.fn(),
      signMessage: jest.fn(),
      getEthersProvider: jest.fn(),
      signContractTransaction: jest.fn(),
      authenticatedFetch: jest.fn((url, options) => {
        // Mock the authenticatedFetch to use the global mockFetch
        return mockFetch(url, options);
      }),
      fundContract: jest.fn().mockResolvedValue({
        transactionHash: 'mock-tx-hash',
        contractAddress: '0xContractAddress',
      }),
    });

    // Reset all Web3Service mocks
    mockWeb3Service.initializeProvider.mockResolvedValue(undefined);
    mockWeb3Service.getUserAddress.mockResolvedValue('0xBuyerAddress');
    mockWeb3Service.signUSDCApproval.mockResolvedValue('mock-approval-tx');
    mockWeb3Service.signDepositTransaction.mockResolvedValue('mock-deposit-tx');
    
    // Mock the global window.web3authProvider
    (window as any).web3authProvider = {
      request: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const setupSuccessfulFlow = () => {
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
      
    // Reset Web3Service mocks
    mockWeb3Service.initializeProvider.mockResolvedValue(undefined);
    mockWeb3Service.getUserAddress.mockResolvedValue('0xBuyerAddress');
    mockWeb3Service.signUSDCApproval.mockResolvedValue('mock-approval-tx');
    mockWeb3Service.signDepositTransaction.mockResolvedValue('mock-deposit-tx');
  };

  it('should successfully redirect to dashboard after contract acceptance', async () => {
    setupSuccessfulFlow();
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

    // Verify router.push was called
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    // Verify onAcceptComplete callback was called
    expect(mockOnAcceptComplete).toHaveBeenCalledTimes(1);
  });

});