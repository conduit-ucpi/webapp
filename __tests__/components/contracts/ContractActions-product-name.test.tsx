import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');
jest.mock('../../../components/auth/Web3AuthContextProvider');

// Override the SDK mock for this test
jest.mock('../../../hooks/useWeb3SDK', () => ({
  useWeb3SDK: () => ({
    isReady: true,
    error: null,
    isConnected: true,
    getUSDCBalance: jest.fn().mockResolvedValue('100.0'),
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
import { useWeb3AuthInstance } from '../../../components/auth/Web3AuthContextProvider';
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
const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>;

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

describe('ContractActions - PRODUCT_NAME Environment Variable', () => {
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

  const mockUser = {
    userId: 'user-123',
    email: 'buyer@test.com',
    walletAddress: '0xBuyerAddress',
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

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
    });

    mockUseWeb3AuthInstance.mockReturnValue({
      web3authProvider: null,
      isLoading: false,
      web3authInstance: null,
      onLogout: jest.fn(),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xTxHash123',
      }),
    });
  });

  afterEach(() => {
    // Clean up environment variable
    delete process.env.PRODUCT_NAME;
  });

  it('should use PRODUCT_NAME environment variable when set', async () => {
    // Set the environment variable
    process.env.PRODUCT_NAME = 'Test Product Name';

    const contract: Contract = {
      id: 'contract-db-id-123',
      contractAddress: '0xContractAddress123',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Contract Description',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      buyerEmail: 'buyer@test.com',
      sellerEmail: 'seller@test.com',
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action'
    };

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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            databaseId: 'contract-db-id-123',
            contractAddress: '0xContractAddress123',
            userWalletAddress: '0xBuyerAddress',
            signedTransaction: 'mock-dispute-tx',
            buyerEmail: 'buyer@test.com',
            sellerEmail: 'seller@test.com',
            payoutDateTime: formatDateTimeWithTZ(contract.expiryTimestamp),
            amount: contract.amount.toString(),
            currency: "microUSDC",
            contractDescription: contract.description,
            productName: 'Test Product Name', // Should use PRODUCT_NAME env var
            serviceLink: "http://localhost:3000",
            reason: "Test dispute reason",
            refundPercent: 50
          })
        })
      );
    });
  });

  it('should fallback to contract.description when PRODUCT_NAME is not set', async () => {
    // Ensure PRODUCT_NAME is not set
    delete process.env.PRODUCT_NAME;

    const contract: Contract = {
      id: 'contract-db-id-456',
      contractAddress: '0xContractAddress456',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Fallback Description',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      buyerEmail: 'buyer@test.com',
      sellerEmail: 'seller@test.com',
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action'
    };

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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            databaseId: 'contract-db-id-456',
            contractAddress: '0xContractAddress456',
            userWalletAddress: '0xBuyerAddress',
            signedTransaction: 'mock-dispute-tx',
            buyerEmail: 'buyer@test.com',
            sellerEmail: 'seller@test.com',
            payoutDateTime: formatDateTimeWithTZ(contract.expiryTimestamp),
            amount: contract.amount.toString(),
            currency: "microUSDC",
            contractDescription: contract.description,
            productName: 'Fallback Description', // Should fallback to contract.description
            serviceLink: "http://localhost:3000",
            reason: "Test dispute reason",
            refundPercent: 50
          })
        })
      );
    });
  });

  it('should fallback to contract.description when PRODUCT_NAME is empty string', async () => {
    // Set PRODUCT_NAME to empty string
    process.env.PRODUCT_NAME = '';

    const contract: Contract = {
      id: 'contract-db-id-789',
      contractAddress: '0xContractAddress789',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Empty String Fallback',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      buyerEmail: 'buyer@test.com',
      sellerEmail: 'seller@test.com',
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action'
    };

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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            databaseId: 'contract-db-id-789',
            contractAddress: '0xContractAddress789',
            userWalletAddress: '0xBuyerAddress',
            signedTransaction: 'mock-dispute-tx',
            buyerEmail: 'buyer@test.com',
            sellerEmail: 'seller@test.com',
            payoutDateTime: formatDateTimeWithTZ(contract.expiryTimestamp),
            amount: contract.amount.toString(),
            currency: "microUSDC",
            contractDescription: contract.description,
            productName: 'Empty String Fallback', // Should fallback to contract.description when env var is empty
            serviceLink: "http://localhost:3000",
            reason: "Test dispute reason",
            refundPercent: 50
          })
        })
      );
    });
  });
});