import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../lib/web3');

import { useRouter } from 'next/router';
import ContractAcceptance from '../../../components/contracts/ContractAcceptance';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { PendingContract } from '../../../types';

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;

const currency = "USDC";
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
  value: {
    request: jest.fn(),
  },
  writable: true,
});

// Mock window.alert
global.alert = jest.fn();

describe('ContractAcceptance - Email Fields', () => {
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

  const mockOnAcceptComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

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
  });

  it('should include email addresses when calling deposit-funds endpoint', async () => {
    const contract: PendingContract = {
      id: 'test-contract-123',
      sellerEmail: 'seller@test.com',
      buyerEmail: 'buyer@test.com',
      amount: 1000000, // 1 USDC
      currency: currency,
      sellerAddress: '0xSellerAddress',
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test contract with emails',
      createdAt: new Date().toISOString(),
      createdBy: 'test-user',
      state: 'OK',
    };

    // Mock successful API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...contract,
          state: 'OK'
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          contractAddress: '0xContractAddress123',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
        }),
      });

    render(
      <ContractAcceptance
        contract={contract}
        onAcceptComplete={mockOnAcceptComplete}
      />
    );

    // Click the accept button
    const acceptButton = screen.getByText(/Make Payment of.*USDC/);
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    // Verify deposit-funds was called with email addresses
    const depositFundsCall = mockFetch.mock.calls.find(
      call => call[0].includes('/api/chain/deposit-funds')
    );

    expect(depositFundsCall).toBeDefined();
    const depositBody = JSON.parse(depositFundsCall[1].body);

    expect(depositBody).toMatchObject({
      contractAddress: '0xContractAddress123',
      userWalletAddress: '0xBuyerAddress',
      signedTransaction: 'mock-deposit-tx',
      contractId: 'test-contract-123',
      buyerEmail: 'buyer@test.com',
      sellerEmail: 'seller@test.com',
      amount: '1000000',
      currency: currency,
      payoutDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      contractDescription: expect.any(String),
      contractLink: 'http://localhost:3000'
    });
  });

  it('should handle missing email addresses gracefully', async () => {
    const contractWithoutEmails: PendingContract = {
      id: 'test-contract-456',
      sellerEmail: 'seller@test.com',
      // buyerEmail is optional and missing
      amount: 1000000,
      currency: currency,
      sellerAddress: '0xSellerAddress',
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test contract without buyer email',
      createdAt: new Date().toISOString(),
      createdBy: 'test-user',
      state: 'OK',
    };

    // Mock successful API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...contractWithoutEmails,
          state: 'OK'
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          contractAddress: '0xContractAddress456',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
        }),
      });

    render(
      <ContractAcceptance
        contract={contractWithoutEmails}
        onAcceptComplete={mockOnAcceptComplete}
      />
    );

    const acceptButton = screen.getByText(/Make Payment of.*USDC/);
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    // Verify deposit-funds was called with available email addresses
    const depositFundsCall = mockFetch.mock.calls.find(
      call => call[0].includes('/api/chain/deposit-funds')
    );

    expect(depositFundsCall).toBeDefined();
    const depositBody = JSON.parse(depositFundsCall[1].body);

    expect(depositBody).toMatchObject({
      contractAddress: '0xContractAddress456',
      userWalletAddress: '0xBuyerAddress',
      signedTransaction: 'mock-deposit-tx',
      contractId: 'test-contract-456',
      sellerEmail: 'seller@test.com',
      amount: '1000000',
      currency: currency,
      payoutDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      contractDescription: expect.any(String),
      contractLink: 'http://localhost:3000'
    });
    // buyerEmail should not be present when undefined
    expect(depositBody).not.toHaveProperty('buyerEmail');
  });
});