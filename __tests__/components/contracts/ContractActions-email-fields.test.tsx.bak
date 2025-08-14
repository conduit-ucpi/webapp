import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth/AuthProvider');
jest.mock('../../../components/auth/Web3AuthContextProvider');
jest.mock('../../../lib/web3');

import { useRouter } from 'next/router';
import ContractActions from '../../../components/contracts/ContractActions';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth/AuthProvider';
import { useWeb3AuthInstance } from '../../../components/auth/Web3AuthContextProvider';
import { Contract } from '../../../types';

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>;

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Web3Service
const mockWeb3Service = {
  initializeProvider: jest.fn(),
  getUserAddress: jest.fn().mockResolvedValue('0xBuyerAddress'),
  signContractTransaction: jest.fn().mockImplementation((params) => {
    if (params.functionName === 'raiseDispute') return Promise.resolve('mock-dispute-tx');
    if (params.functionName === 'claimFunds') return Promise.resolve('mock-claim-tx');
    if (params.functionName === 'approve') return Promise.resolve('mock-approval-tx');
    if (params.functionName === 'depositFunds') return Promise.resolve('mock-deposit-tx');
    return Promise.resolve('mock-signed-tx');
  }),
  signDisputeTransaction: jest.fn().mockResolvedValue('mock-dispute-tx'),
  signClaimTransaction: jest.fn().mockResolvedValue('mock-claim-tx'),
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
    snowtraceBaseUrl: 'https://testnet.snowtrace.io',
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
    };

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
            payoutDateTime: new Date(contract.expiryTimestamp * 1000).toISOString(),
            amount: (contract.amount / 1000000).toString(),
            currency: "microUSDC",
            contractDescription: contract.description,
            productName: 'Conduit UCPI',
            serviceLink: "http://localhost:3000"
          })
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
    };

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

    const contractWithoutBuyerEmail: Contract = {
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

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contractAddress: '0xContractAddress456',
            userWalletAddress: '0xBuyerAddress',
            signedTransaction: 'mock-dispute-tx',
            buyerEmail: 'currentuser@test.com', // Falls back to user email
            sellerEmail: 'seller@test.com',
            payoutDateTime: new Date(contractWithoutBuyerEmail.expiryTimestamp * 1000).toISOString(),
            amount: (contractWithoutBuyerEmail.amount / 1000000).toString(),
            currency: "microUSDC",
            contractDescription: contractWithoutBuyerEmail.description,
            productName: 'Conduit UCPI',
            serviceLink: "http://localhost:3000"
          })
        })
      );
    });
  });

  it('should handle missing email addresses gracefully', async () => {
    const mockUser = {
      userId: 'user-789',
      walletAddress: '0xBuyerAddress',
      // email is missing
    } as any;

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
            buyerEmail: undefined,
            sellerEmail: undefined,
            payoutDateTime: new Date(contractWithoutEmails.expiryTimestamp * 1000).toISOString(),
            amount: (contractWithoutEmails.amount / 1000000).toString(),
            currency: "microUSDC",
            contractDescription: contractWithoutEmails.description,
            productName: 'Conduit UCPI',
            serviceLink: "http://localhost:3000"
          })
        })
      );
    });
  });
});