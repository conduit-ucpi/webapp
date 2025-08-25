import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth/AuthProvider');

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
    signContractTransaction: jest.fn().mockResolvedValue('mock-signed-transaction'),
    hashDescription: jest.fn().mockReturnValue('0x1234'),
    getUserAddress: jest.fn().mockResolvedValue('0xBuyerAddress'), // Test-specific address
    services: {
      user: { connect: jest.fn(), logout: jest.fn(), getIdentity: jest.fn() },
      walletAddress: null,
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
      getWalletProvider: jest.fn(),
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
import { useAuth } from '../../../components/auth/AuthProvider';
import { PendingContract } from '../../../types';

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// SDK is mocked at module level above

// Mock Web3Auth provider and window.alert
Object.defineProperty(window, 'web3authProvider', {
  value: {
    request: jest.fn(),
  },
  writable: true,
});

// Mock window.alert to prevent jsdom errors
global.alert = jest.fn();

describe('ContractAcceptance - Amount Format Fix', () => {
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
      isLoading: false,
      connect: jest.fn(),
      logout: jest.fn(),
      walletAddress: '0xBuyerAddress',
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
      getWalletProvider: jest.fn(),
    });

    // SDK is mocked at module level with default behavior
  });

  describe('Amount format handling', () => {
    it('should convert USDC string format (0.24) to microUSDC (240000) when sending to chain service', async () => {
      // Contract with amount in USDC string format (what we expect is coming from backend)
      const contractWithUSDCFormat: PendingContract = {
        id: 'test-contract-123',
        sellerEmail: 'seller@test.com',
        buyerEmail: 'buyer@test.com',
        amount: '0.24' as any, // Coming as USDC string instead of microUSDC number
        currency: 'USDC',
        sellerAddress: '0xSellerAddress',
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test contract with USDC format amount',
        createdAt: Math.floor(Date.now() / 1000),
        createdBy: 'test-user',
        state: 'OK',
      };

      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(contractWithUSDCFormat),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true, contractAddress: '0xContractAddress' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      render(
        <ContractAcceptance
          contract={contractWithUSDCFormat}
          onAcceptComplete={mockOnAcceptComplete}
        />
      );

      fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

      // Wait for the create contract API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/chain/create-contract',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      // Verify the amount was converted to microUSDC
      const createContractCall = mockFetch.mock.calls.find(
        call => call[0] === '/api/chain/create-contract'
      );
      expect(createContractCall).toBeDefined();

      const requestBody = JSON.parse(createContractCall[1].body);
      expect(requestBody.amount).toBe('240000'); // Should be converted from "0.24" to microUSDC
    });

    it('should handle microUSDC number format (240000) correctly', async () => {
      // Contract with amount in microUSDC number format (what should ideally be coming)
      const contractWithMicroUSDCFormat: PendingContract = {
        id: 'test-contract-123',
        sellerEmail: 'seller@test.com',
        buyerEmail: 'buyer@test.com',
        amount: 240000, // Already in microUSDC format
        currency: 'USDC',
        sellerAddress: '0xSellerAddress',
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test contract with microUSDC format amount',
        createdAt: Math.floor(Date.now() / 1000),
        createdBy: 'test-user',
        state: 'OK',
      };

      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(contractWithMicroUSDCFormat),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true, contractAddress: '0xContractAddress' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      render(
        <ContractAcceptance
          contract={contractWithMicroUSDCFormat}
          onAcceptComplete={mockOnAcceptComplete}
        />
      );

      fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

      // Wait for the create contract API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/chain/create-contract',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      // Verify the amount remains as microUSDC
      const createContractCall = mockFetch.mock.calls.find(
        call => call[0] === '/api/chain/create-contract'
      );
      expect(createContractCall).toBeDefined();

      const requestBody = JSON.parse(createContractCall[1].body);
      expect(requestBody.amount).toBe('240000'); // Should remain as microUSDC
    });

    it('should handle balance check correctly for USDC string format', async () => {
      const contractWithUSDCFormat: PendingContract = {
        id: 'test-contract-123',
        sellerEmail: 'seller@test.com',
        buyerEmail: 'buyer@test.com',
        amount: '0.50' as any, // USDC string format
        currency: 'USDC',
        sellerAddress: '0xSellerAddress',
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test contract',
        createdAt: Math.floor(Date.now() / 1000),
        createdBy: 'test-user',
        state: 'OK',
      };

      // User has exactly enough balance (SDK mock already returns '100.0')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(contractWithUSDCFormat),
      });

      render(
        <ContractAcceptance
          contract={contractWithUSDCFormat}
          onAcceptComplete={mockOnAcceptComplete}
        />
      );

      fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

      await waitFor(() => {
        // Should not show insufficient balance error since user has enough balance
        expect(screen.queryByText(/insufficient.*balance/i)).not.toBeInTheDocument();
      });
    });

    it('should handle USDC approval correctly for USDC string format', async () => {
      const contractWithUSDCFormat: PendingContract = {
        id: 'test-contract-123',
        sellerEmail: 'seller@test.com',
        buyerEmail: 'buyer@test.com',
        amount: '1.25' as any, // USDC string format
        currency: 'USDC',
        sellerAddress: '0xSellerAddress',
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test contract',
        createdAt: Math.floor(Date.now() / 1000),
        createdBy: 'test-user',
        state: 'OK',
      };

      // User has sufficient balance (SDK mock already returns '100.0')

      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(contractWithUSDCFormat),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true, contractAddress: '0xContractAddress' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      render(
        <ContractAcceptance
          contract={contractWithUSDCFormat}
          onAcceptComplete={mockOnAcceptComplete}
        />
      );

      fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

      await waitFor(() => {
        // Verify the approve/deposit flow completed successfully
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/chain/approve-usdc',
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
    });
  });
});