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

describe('ContractActions - Context Fields for Dispute', () => {
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
  });

  it('should include contract context fields when raising a dispute', async () => {
    const contract: Contract = {
      id: 'contract-db-id-123',
      contractAddress: '0xContractAddress123',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 2500000, // 2.5 USDC in microUSDC
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Digital Marketing Services Package',
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
            payoutDateTime: new Date(contract.expiryTimestamp * 1000).toISOString(),
            amount: '2.5', // Converted from microUSDC to USDC
            currency: 'microUSDC',
            contractDescription: 'Digital Marketing Services Package',
            productName: 'Conduit UCPI',
            serviceLink: 'http://localhost:3000',
            reason: 'Test dispute reason',
            refundPercent: 50
          })
        })
      );
    });

    expect(mockOnAction).toHaveBeenCalled();
  });

  it('should handle microUSDC amount conversion correctly', async () => {
    const contract: Contract = {
      id: 'contract-db-id-456',
      contractAddress: '0xContractAddress456',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000, // 1.0 USDC in microUSDC
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test Product',
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
        transactionHash: '0xTxHash456',
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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          body: expect.stringContaining('"amount":"1"') // 1.0 USDC
        })
      );
    });
  });

  it('should handle fractional USDC amounts correctly', async () => {
    const contract: Contract = {
      id: 'contract-db-id-789',
      contractAddress: '0xContractAddress789',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1500000, // 1.5 USDC in microUSDC
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Consulting Service',
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
        transactionHash: '0xTxHash789',
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
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          body: expect.stringContaining('"amount":"1.5"') // 1.5 USDC
        })
      );
    });
  });

  it('should use description for both contractDescription and productName', async () => {
    const contract: Contract = {
      id: 'contract-db-id-abc',
      contractAddress: '0xContractAddressABC',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 750000, // 0.75 USDC in microUSDC
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Custom Web Development',
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
        transactionHash: '0xTxHashABC',
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
      const expectedBody = JSON.stringify({
        databaseId: 'contract-db-id-abc',
        contractAddress: '0xContractAddressABC',
        userWalletAddress: '0xBuyerAddress',
        signedTransaction: 'mock-dispute-tx',
        buyerEmail: 'buyer@test.com',
        sellerEmail: 'seller@test.com',
        payoutDateTime: new Date(contract.expiryTimestamp * 1000).toISOString(),
        amount: '0.75',
        currency: 'microUSDC',
        contractDescription: 'Custom Web Development',
        productName: process.env.PRODUCT_NAME || 'Custom Web Development',
        serviceLink: 'http://localhost:3000',
        reason: 'Test dispute reason',
        refundPercent: 50
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chain/raise-dispute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expectedBody
        })
      );
    });
  });
});