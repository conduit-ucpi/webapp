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

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Web3Service
const mockWeb3Service = {
  initializeProvider: jest.fn(),
  getUserAddress: jest.fn().mockResolvedValue('0xBuyerAddress'),
  getUSDCBalance: jest.fn(),
  signUSDCApproval: jest.fn().mockResolvedValue('mock-approval-tx'),
  signDepositTransaction: jest.fn().mockResolvedValue('mock-deposit-tx'),
};

jest.mock('../../../lib/web3', () => ({
  Web3Service: jest.fn().mockImplementation(() => mockWeb3Service),
}));

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

    mockWeb3Service.getUSDCBalance.mockResolvedValue('1.00');
    mockWeb3Service.signUSDCApproval.mockResolvedValue('mock-approval-tx');
    mockWeb3Service.signDepositTransaction.mockResolvedValue('mock-deposit-tx');
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
        createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
        createdBy: 'test-user',
        state: 'OK',
      };

      // User has exactly enough balance
      mockWeb3Service.getUSDCBalance.mockResolvedValue('0.50');

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
        expect(mockWeb3Service.getUSDCBalance).toHaveBeenCalled();
      });

      // Should not show insufficient balance error
      expect(screen.queryByText(/insufficient.*balance/i)).not.toBeInTheDocument();
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
        createdAt: new Date().toISOString(),
        createdBy: 'test-user',
        state: 'OK',
      };

      mockWeb3Service.getUSDCBalance.mockResolvedValue('2.00');

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
        expect(mockWeb3Service.signUSDCApproval).toHaveBeenCalledWith(
          '1.25', // Should use the USDC string directly for approval
          '0xContractAddress'
        );
      });
    });
  });
});