import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');
// jest.mock('../../../components/auth/Web3AuthContextProvider'); // Not needed

// Override the SDK mock for this test
jest.mock('../../../hooks/useWeb3SDK', () => ({
  useWeb3SDK: () => ({
    isReady: true,
    error: null,
    isConnected: true,
    getUSDCBalance: jest.fn().mockResolvedValue('100000000'), // 100 USDC in microUSDC
    getUSDCAllowance: jest.fn().mockResolvedValue('1000.0'),
    signUSDCTransfer: jest.fn().mockResolvedValue('mock-signed-transaction'),
    getContractInfo: jest.fn().mockResolvedValue({}),
    getContractState: jest.fn().mockResolvedValue({}),
    signContractTransaction: jest.fn().mockResolvedValue('mock-dispute-tx'),
    hashDescription: jest.fn().mockReturnValue('0x1234'),
    getUserAddress: jest.fn().mockResolvedValue('0xBuyerAddress'), // Test-specific address
    services: {
      user: { login: jest.fn(), logout: jest.fn(), getIdentity: jest.fn() },
      chain: { createContract: jest.fn(), raiseDispute: jest.fn(), claimFunds: jest.fn() },
      contracts: { create: jest.fn(), getById: jest.fn(), getAll: jest.fn() }
    },
    utils: {
      isValidEmail: jest.fn().mockReturnValue(true),
      isValidAmount: jest.fn().mockReturnValue(true),
      isValidDescription: jest.fn().mockReturnValue(true),
      formatCurrency: jest.fn().mockImplementation((amount, currency) => ({
        amount: (amount / 1000000).toFixed(2),
        currency: 'USDC',
        numericAmount: amount / 1000000
      })),
      formatUSDC: jest.fn().mockReturnValue('1.0000'),
      toMicroUSDC: jest.fn().mockImplementation((amount) => amount), // Don't convert - test data already in microUSDC
      formatDateTimeWithTZ: jest.fn().mockImplementation((timestamp) => {
        // Return NZ timezone format like test expects
        const date = new Date(timestamp * 1000);
        return date.toISOString().replace('Z', '+12:00');
      }),
      toUSDCForWeb3: jest.fn().mockReturnValue('1.0')
    },
    sdk: null
  })
}));

import { useRouter } from 'next/router';
import ContractActions from '../../../components/contracts/ContractActions';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth';
// import { useWeb3AuthInstance } from '../../../components/auth/Web3AuthContextProvider'; // Not needed
import { Contract } from '../../../types';

// Import the function for generating expected test values
const formatDateTimeWithTZ = (timestamp: number): string => {
  // Generate the same format the test expects (NZ timezone)
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace('Z', '+12:00');
};

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
// const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>; // Not needed

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// SDK is mocked at module level above

// Mock Web3Auth provider
Object.defineProperty(window, 'web3authProvider', {
  value: {
    request: jest.fn(),
  },
  writable: true,
});

// Mock window.alert
global.alert = jest.fn();

describe('ContractActions - Email Fields for Dispute', () => {
  beforeAll(() => {
    process.env.PRODUCT_NAME = 'Conduit UCPI';
  });

  afterAll(() => {
    delete process.env.PRODUCT_NAME;
  });

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

  const mockOnAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRouter.mockReturnValue({
      basePath: '',
      pathname: '/dashboard',
      query: {},
      asPath: '/dashboard',
    } as any);

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });
  });

  it('should include email addresses when raising a dispute', async () => {
    const mockUser = {
      userId: 'user-123',
      email: 'buyer@test.com',
      walletAddress: '0xBuyerAddress',
      authProvider: 'web3auth' as const,
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
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
      getUSDCBalance: jest.fn().mockResolvedValue('100000000'), // 100 USDC in microUSDC
      signContractTransaction: jest.fn(),
      authenticatedFetch: jest.fn(),
      raiseDispute: jest.fn().mockResolvedValue('mock-tx-hash'),
    });

    // mockUseWeb3AuthInstance.mockReturnValue({
    //   web3authProvider: null,
    //   isLoading: false,
    //   web3authInstance: null,
    //   onLogout: jest.fn(),
    // });

    const contract: Contract = {
      id: 'contract-db-id-123',
      contractAddress: '0xContractAddress123',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test contract',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      buyerEmail: 'buyer@test.com',
      sellerEmail: 'seller@test.com',
      // Backend CTA fields for testing backward compatibility
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xTxHash123',
      }),
    });

    render(
      <ContractActions
        contract={contract}
        isBuyer={true}
        isSeller={false}
        onAction={mockOnAction}
      />
    );

    const disputeButton = screen.getByText('Raise Dispute');
    fireEvent.click(disputeButton);


    // Wait for modal to open and fill in the form
    const reasonTextarea = await screen.findByLabelText('Dispute Reason');
    fireEvent.change(reasonTextarea, { target: { value: 'Test dispute reason' } });

    // Find the submit button inside the modal (there are two "Raise Dispute" buttons now)
    const submitButtons = screen.getAllByText('Raise Dispute');
    const modalSubmitButton = submitButtons[1]; // The second one is in the modal
    fireEvent.click(modalSubmitButton);
    await waitFor(() => {
      const mockRaiseDispute = mockUseAuth.mock.results[0].value.raiseDispute;
      expect(mockRaiseDispute).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0xContractAddress123',
          userAddress: '0xBuyerAddress',
          reason: 'Test dispute reason',
          refundPercent: 50,
          contract: expect.objectContaining({
            id: 'contract-db-id-123',
            buyerEmail: 'buyer@test.com',
            sellerEmail: 'seller@test.com',
            expiryTimestamp: contract.expiryTimestamp,
            amount: contract.amount,
            description: contract.description
          }),
          config: expect.objectContaining({
            serviceLink: "http://localhost:3000"
          }),
          utils: expect.any(Object)
        })
      );
    });

    expect(mockOnAction).toHaveBeenCalled();
  });

  it('should use user email as fallback when contract buyerEmail is missing', async () => {
    const mockUser = {
      userId: 'user-456',
      email: 'currentuser@test.com',
      walletAddress: '0xBuyerAddress',
      authProvider: 'web3auth' as const,
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
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
      getUSDCBalance: jest.fn().mockResolvedValue('100000000'), // 100 USDC in microUSDC
      signContractTransaction: jest.fn(),
      authenticatedFetch: jest.fn(),
      raiseDispute: jest.fn().mockResolvedValue('mock-tx-hash'),
    });

    // mockUseWeb3AuthInstance.mockReturnValue({
    //   web3authProvider: null,
    //   isLoading: false,
    //   web3authInstance: null,
    //   onLogout: jest.fn(),
    // });

    const contractWithoutBuyerEmail: Contract = {
      id: 'contract-db-id-456',
      contractAddress: '0xContractAddress456',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test contract without buyer email',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      // buyerEmail is missing
      sellerEmail: 'seller@test.com',
      // Backend CTA fields for testing backward compatibility
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xTxHash456',
      }),
    });

    render(
      <ContractActions
        contract={contractWithoutBuyerEmail}
        isBuyer={true}
        isSeller={false}
        onAction={mockOnAction}
      />
    );

    const disputeButton = screen.getByText('Raise Dispute');
    fireEvent.click(disputeButton);


    // Wait for modal to open and fill in the form
    const reasonTextarea = await screen.findByLabelText('Dispute Reason');
    fireEvent.change(reasonTextarea, { target: { value: 'Test dispute reason' } });

    // Find the submit button inside the modal (there are two "Raise Dispute" buttons now)
    const submitButtons = screen.getAllByText('Raise Dispute');
    const modalSubmitButton = submitButtons[1]; // The second one is in the modal
    fireEvent.click(modalSubmitButton);
    await waitFor(() => {
      const mockRaiseDispute = mockUseAuth.mock.results[0].value.raiseDispute;
      expect(mockRaiseDispute).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0xContractAddress456',
          userAddress: '0xBuyerAddress',
          reason: 'Test dispute reason',
          refundPercent: 50,
          contract: expect.objectContaining({
            id: 'contract-db-id-456',
            buyerEmail: 'currentuser@test.com', // Falls back to user email  
            sellerEmail: 'seller@test.com',
            expiryTimestamp: contractWithoutBuyerEmail.expiryTimestamp,
            amount: contractWithoutBuyerEmail.amount,
            description: contractWithoutBuyerEmail.description
          }),
          config: expect.objectContaining({
            serviceLink: "http://localhost:3000"
          }),
          utils: expect.any(Object)
        })
      );
    });
  });

  it('should handle missing email addresses gracefully', async () => {
    const mockUser = {
      userId: 'user-789',
      walletAddress: '0xBuyerAddress',
      authProvider: 'web3auth' as const,
      // email is missing
    } as any;

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
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
      getUSDCBalance: jest.fn().mockResolvedValue('100000000'), // 100 USDC in microUSDC
      signContractTransaction: jest.fn(),
      authenticatedFetch: jest.fn(),
      raiseDispute: jest.fn().mockResolvedValue('mock-tx-hash'),
    });

    // mockUseWeb3AuthInstance.mockReturnValue({
    //   web3authProvider: null,
    //   isLoading: false,
    //   web3authInstance: null,
    //   onLogout: jest.fn(),
    // });

    const contractWithoutEmails: Contract = {
      id: 'contract-db-id-789',
      contractAddress: '0xContractAddress789',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test contract without emails',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      // Both emails are missing
      // Backend CTA fields for testing backward compatibility
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xTxHash789',
      }),
    });

    render(
      <ContractActions
        contract={contractWithoutEmails}
        isBuyer={true}
        isSeller={false}
        onAction={mockOnAction}
      />
    );

    const disputeButton = screen.getByText('Raise Dispute');
    fireEvent.click(disputeButton);


    // Wait for modal to open and fill in the form
    const reasonTextarea = await screen.findByLabelText('Dispute Reason');
    fireEvent.change(reasonTextarea, { target: { value: 'Test dispute reason' } });

    // Find the submit button inside the modal (there are two "Raise Dispute" buttons now)
    const submitButtons = screen.getAllByText('Raise Dispute');
    const modalSubmitButton = submitButtons[1]; // The second one is in the modal
    fireEvent.click(modalSubmitButton);
    await waitFor(() => {
      const mockRaiseDispute = mockUseAuth.mock.results[0].value.raiseDispute;
      expect(mockRaiseDispute).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0xContractAddress789',
          userAddress: '0xBuyerAddress',
          reason: 'Test dispute reason',
          refundPercent: 50,
          contract: expect.objectContaining({
            id: 'contract-db-id-789',
            buyerEmail: '', // Falls back to empty string when no buyer email and no user email
            sellerEmail: contractWithoutEmails.sellerEmail,
            expiryTimestamp: contractWithoutEmails.expiryTimestamp,
            amount: contractWithoutEmails.amount,
            description: contractWithoutEmails.description
          }),
          config: expect.objectContaining({
            serviceLink: "http://localhost:3000"
          }),
          utils: expect.any(Object)
        })
      );
    });
  });
});