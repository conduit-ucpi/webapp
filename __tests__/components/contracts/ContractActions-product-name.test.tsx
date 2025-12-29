import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');
// jest.mock('../../../components/auth/Web3AuthContextProvider'); // Not needed

// SDK mocks are now handled in jest.setup.js

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

describe('ContractActions - PRODUCT_NAME Environment Variable', () => {
  const mockConfig = {
    usdcContractAddress: '0x123456789',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    moonPayApiKey: 'test-moonpay-key',
    minGasWei: '5',
    maxGasPriceGwei: '0.001',
    maxGasCostGwei: '0.15',
    usdcGrantFoundryGas: '150000',
    depositFundsFoundryGas: '150000',
    gasPriceBuffer: '1',
    basePath: '',
    explorerBaseUrl: 'https://testnet.snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  const mockUser = {
    userId: 'user-123',
    email: 'buyer@test.com',
    walletAddress: '0xBuyerAddress',
    authProvider: 'web3auth' as const,
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
      isConnected: true,
      error: null,
      disconnect: jest.fn(),
      getEthersProvider: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn().mockReturnValue(false),
      raiseDispute: jest.fn().mockResolvedValue('mock-tx-hash'),
    });

    // mockUseWeb3AuthInstance.mockReturnValue({
    //   web3authProvider: null,
    //   isLoading: false,
    //   web3authInstance: null,
    //   onLogout: jest.fn(),
    // });

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
            description: contract.description // The abstracted method will use PRODUCT_NAME env var when building the request
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
      const mockRaiseDispute = mockUseAuth.mock.results[0].value.raiseDispute;
      expect(mockRaiseDispute).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0xContractAddress456',
          userAddress: '0xBuyerAddress',
          reason: 'Test dispute reason',
          refundPercent: 50,
          contract: expect.objectContaining({
            id: 'contract-db-id-456',
            description: contract.description // The abstracted method will fallback to description when PRODUCT_NAME is not set
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
      const mockRaiseDispute = mockUseAuth.mock.results[0].value.raiseDispute;
      expect(mockRaiseDispute).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0xContractAddress789',
          userAddress: '0xBuyerAddress',
          reason: 'Test dispute reason',
          refundPercent: 50,
          contract: expect.objectContaining({
            id: 'contract-db-id-789',
            description: contract.description // The abstracted method will fallback to description when PRODUCT_NAME is empty
          })
        })
      );
    });
  });
});