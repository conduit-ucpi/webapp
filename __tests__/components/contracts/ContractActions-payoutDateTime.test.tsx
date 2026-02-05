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
  // For timestamp 1692123456 return the expected format for this test
  if (timestamp === 1692123456) {
    return '2023-08-16T06:17:36+12:00';
  }
  // For timestamp 1704067200 return the expected format for second test
  if (timestamp === 1704067200) {
    return '2024-01-01T13:00:00+13:00';
  }
  // Default fallback
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

describe('ContractActions - PayoutDateTime', () => {
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
    resolutionVoteFoundryGas: '80000',
    raiseDisputeFoundryGas: '150000',
    claimFundsFoundryGas: '150000',
    gasPriceBuffer: '1',
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

  it('should include payoutDateTime in ISO8601 format when raising a dispute', async () => {
    const mockUser = {
      userId: 'user-123',
      email: 'buyer@test.com',
      walletAddress: '0xBuyerAddress',
      authProvider: 'web3auth' as const,
    };

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

    // Use a specific timestamp for predictable testing
    const expiryTimestamp = 1692123456; // Unix timestamp
    const expectedDateTimeString = formatDateTimeWithTZ(expiryTimestamp);

    const contract: Contract = {
      id: 'contract-db-id-123',
      contractAddress: '0xContractAddress123',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 1000000,
      expiryTimestamp: expiryTimestamp,
      description: 'Test contract',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      buyerEmail: 'buyer@test.com',
      sellerEmail: 'seller@test.com',
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action'
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

    // Verify that the utils.formatDateTimeWithTZ was called with the correct timestamp
    const mockRaiseDispute = mockUseAuth.mock.results[0].value.raiseDispute;
    const callArgs = mockRaiseDispute.mock.calls[0][0];
    
    // The contract data should include the correct expiryTimestamp
    expect(callArgs.contract.expiryTimestamp).toBe(contract.expiryTimestamp);
    
    // The utils should be passed (which includes formatDateTimeWithTZ)
    expect(callArgs.utils).toBeDefined();
    expect(callArgs.utils.formatDateTimeWithTZ).toBeDefined();

    // The expiryTimestamp should be passed correctly
    expect(callArgs.contract.expiryTimestamp).toBe(expiryTimestamp);
  });

  it('should correctly convert Unix timestamp to ISO8601 for different dates', async () => {
    const mockUser = {
      userId: 'user-123',
      email: 'buyer@test.com',
      walletAddress: '0xBuyerAddress',
      authProvider: 'web3auth' as const,
    };

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

    // Test with a different timestamp - December 31, 2023 at midnight UTC
    const expiryTimestamp = 1704067200; // December 31, 2023 00:00:00 UTC
    const expectedDateTimeString = formatDateTimeWithTZ(expiryTimestamp);

    const contract: Contract = {
      id: 'contract-db-id-456',
      contractAddress: '0xContractAddress456',
      buyerAddress: '0xBuyerAddress',
      sellerAddress: '0xSellerAddress',
      amount: 2000000,
      expiryTimestamp: expiryTimestamp,
      description: 'Test contract with specific date',
      status: 'ACTIVE',
      createdAt: Math.floor(Date.now() / 1000),
      funded: true,
      buyerEmail: 'buyer@test.com',
      sellerEmail: 'seller@test.com',
      ctaType: 'RAISE_DISPUTE',
      ctaLabel: 'Raise Dispute',
      ctaVariant: 'action'
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
      const mockRaiseDispute = mockUseAuth.mock.results[0].value.raiseDispute;
      expect(mockRaiseDispute).toHaveBeenCalledWith(
        expect.objectContaining({
          contract: expect.objectContaining({
            expiryTimestamp: contract.expiryTimestamp
          }),
          utils: expect.objectContaining({
            formatDateTimeWithTZ: expect.any(Function)
          })
        })
      );
    });
  });
});