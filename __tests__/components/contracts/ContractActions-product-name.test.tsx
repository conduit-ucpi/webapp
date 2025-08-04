import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth/AuthProvider');
jest.mock('../../../components/auth/Web3AuthInstanceProvider');
jest.mock('../../../lib/web3');

import { useRouter } from 'next/router';
import ContractActions from '../../../components/contracts/ContractActions';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth/AuthProvider';
import { useWeb3AuthInstance } from '../../../components/auth/Web3AuthInstanceProvider';
import { Contract } from '../../../types';

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>;
const currency = "microUSDC";
// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Web3Service
const mockWeb3Service = {
  initializeProvider: jest.fn(),
  getUserAddress: jest.fn().mockResolvedValue('0xBuyerAddress'),
  signDisputeTransaction: jest.fn().mockResolvedValue('mock-dispute-tx'),
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
    snowtraceBaseUrl: 'https://testnet.snowtrace.io',
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

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contractAddress: '0xContractAddress123',
            userWalletAddress: '0xBuyerAddress',
            signedTransaction: 'mock-dispute-tx',
            buyerEmail: 'buyer@test.com',
            sellerEmail: 'seller@test.com',
            payoutDateTime: new Date(contract.expiryTimestamp * 1000).toISOString(),
            amount: (contract.amount / 1000000).toString(),
            currency: currency,
            contractDescription: contract.description,
            productName: 'Test Product Name' // Should use PRODUCT_NAME env var
          })
        })
      );
    });
  });

  it('should fallback to contract.description when PRODUCT_NAME is not set', async () => {
    // Ensure PRODUCT_NAME is not set
    delete process.env.PRODUCT_NAME;

    const contract: Contract = {
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
            buyerEmail: 'buyer@test.com',
            sellerEmail: 'seller@test.com',
            payoutDateTime: new Date(contract.expiryTimestamp * 1000).toISOString(),
            amount: (contract.amount / 1000000).toString(),
            currency: currency,
            contractDescription: contract.description,
            productName: 'Fallback Description' // Should fallback to contract.description
          })
        })
      );
    });
  });

  it('should fallback to contract.description when PRODUCT_NAME is empty string', async () => {
    // Set PRODUCT_NAME to empty string
    process.env.PRODUCT_NAME = '';

    const contract: Contract = {
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

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contractAddress: '0xContractAddress789',
            userWalletAddress: '0xBuyerAddress',
            signedTransaction: 'mock-dispute-tx',
            buyerEmail: 'buyer@test.com',
            sellerEmail: 'seller@test.com',
            payoutDateTime: new Date(contract.expiryTimestamp * 1000).toISOString(),
            amount: (contract.amount / 1000000).toString(),
            currency: currency,
            contractDescription: contract.description,
            productName: 'Empty String Fallback' // Should fallback to contract.description when env var is empty
          })
        })
      );
    });
  });
});