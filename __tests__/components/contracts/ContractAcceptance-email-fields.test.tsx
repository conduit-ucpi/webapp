import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');

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
    signContractTransaction: jest.fn().mockImplementation((params) => {
      if (params.functionName === 'approve') return Promise.resolve('mock-approval-tx');
      if (params.functionName === 'depositFunds') return Promise.resolve('mock-deposit-tx');
      return Promise.resolve('mock-signed-transaction');
    }),
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
      formatCurrency: jest.fn().mockImplementation((amount, currency) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        // Smart detection: if currency is 'USDC' but amount >= 1000, treat as microUSDC
        if (currency === 'USDC' && num >= 1000) {
          return {
            amount: (num / 1000000).toFixed(2),
            currency: 'USDC',
            numericAmount: num / 1000000
          };
        }
        // If currency is 'USDC' and amount < 1000, assume input is already in USDC
        else if (currency === 'USDC') {
          return {
            amount: num.toFixed(2),
            currency: 'USDC',
            numericAmount: num
          };
        }
        // Otherwise assume input is in microUSDC and convert
        return {
          amount: (num / 1000000).toFixed(2),
          currency: 'USDC',
          numericAmount: num / 1000000
        };
      }),
      formatUSDC: jest.fn().mockReturnValue('1.0000'),
      toMicroUSDC: jest.fn().mockImplementation((amount) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        const result = Math.round(num * 1000000);
        return result.toString(); // Return as string to match expected test format
      }),
      formatDateTimeWithTZ: jest.fn().mockReturnValue('2024-01-01T00:00:00-05:00'),
      toUSDCForWeb3: jest.fn().mockReturnValue('1.0')
    },
    sdk: null
  })
}));

import { useRouter } from 'next/router';
import ContractAcceptance from '../../../components/contracts/ContractAcceptance';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth';
import { PendingContract } from '../../../types';

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const currency = "USDC";
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
    explorerBaseUrl: 'https://testnet.snowtrace.io',
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

    mockUseAuth.mockReturnValue({
      user: { userId: 'test-user-id', walletAddress: '0xBuyerAddress', email: 'buyer@test.com' },
      login: jest.fn(),
      logout: jest.fn(),
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
      createdAt: Math.floor(Date.now() / 1000),
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
      payoutDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
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
      createdAt: Math.floor(Date.now() / 1000),
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
      payoutDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
      contractDescription: expect.any(String),
      contractLink: 'http://localhost:3000'
    });
    // buyerEmail should not be present when undefined
    expect(depositBody).not.toHaveProperty('buyerEmail');
  });
});