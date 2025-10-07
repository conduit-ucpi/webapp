import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SimpleAuthProvider } from '../../../components/auth/SimpleAuthProvider';
import { useAuth } from '../../../components/auth';
import { useConfig } from '../../../components/auth/ConfigProvider';

// Mock fetch globally
global.fetch = jest.fn();

// Mock dependencies
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth/BackendAuth');

const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;

// Mock config
const mockConfig = {
  web3AuthClientId: 'test-client-id',
  web3AuthNetwork: 'testnet',
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

// Mock BackendAuth
jest.mock('../../../components/auth/BackendAuth', () => {
  const mockAuthenticatedFetch = jest.fn();

  return {
    BackendAuth: jest.fn().mockImplementation(() => ({
      authenticatedFetch: mockAuthenticatedFetch,
      checkAuthStatus: jest.fn().mockResolvedValue({ success: true, user: null }),
      login: jest.fn(),
      logout: jest.fn()
    }))
  };
});

// Mock fundAndSendTransaction
const mockFundAndSendTransaction = jest.fn();
jest.mock('../../../hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    fundAndSendTransaction: mockFundAndSendTransaction
  })
}));

// Test component to access auth context
function TestComponent() {
  const { raiseDispute } = useAuth();

  React.useEffect(() => {
    // Trigger raiseDispute in useEffect to test it
    if (raiseDispute) {
      raiseDispute({
        contractAddress: '0xTestContract',
        userAddress: '0xTestUser',
        reason: 'Test dispute reason',
        refundPercent: 50,
        contract: {
          id: 'test-contract-id'
        }
      }).catch(() => {
        // Ignore errors for test purposes
      });
    }
  }, [raiseDispute]);

  return <div>Test Component</div>;
}

describe('SimpleAuthProvider - Dispute Notification', () => {
  let mockBackendClient: any;
  let mockAuthenticatedFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false
    });

    // Get the mocked BackendAuth instance
    const { BackendAuth } = require('../../../components/auth/BackendAuth');
    mockBackendClient = new BackendAuth();
    mockAuthenticatedFetch = mockBackendClient.authenticatedFetch;

    // Mock successful blockchain transaction
    mockFundAndSendTransaction.mockResolvedValue('0xTestTransactionHash');

    // Mock successful contractservice notification
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  it('should call contractservice notification after successful dispute transaction', async () => {
    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    // Wait for the dispute to be processed
    await waitFor(() => {
      expect(mockFundAndSendTransaction).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Verify blockchain transaction was called with correct parameters
    expect(mockFundAndSendTransaction).toHaveBeenCalledWith({
      to: '0xTestContract',
      data: expect.stringMatching(/^0x[a-fA-F0-9]+$/), // Encoded raiseDispute() call
      value: '0'
    });

    // Wait for contractservice notification
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Verify contractservice notification was called
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      '/api/contracts/test-contract-id/dispute',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: expect.any(Number),
          reason: 'Test dispute reason',
          refundPercent: 50
        })
      }
    );
  });

  it('should still complete blockchain transaction even if notification fails', async () => {
    // Mock notification failure
    mockAuthenticatedFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Contract service error')
    });

    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    // Wait for the dispute to be processed
    await waitFor(() => {
      expect(mockFundAndSendTransaction).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Verify blockchain transaction was still called
    expect(mockFundAndSendTransaction).toHaveBeenCalledWith({
      to: '0xTestContract',
      data: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
      value: '0'
    });

    // Verify notification was attempted
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });

  it('should skip notification if contract ID is not provided', async () => {
    // Create test component without contract ID
    function TestComponentNoId() {
      const { raiseDispute } = useAuth();

      React.useEffect(() => {
        if (raiseDispute) {
          raiseDispute({
            contractAddress: '0xTestContract',
            userAddress: '0xTestUser',
            reason: 'Test dispute reason',
            refundPercent: 50
            // No contract object provided
          }).catch(() => {
            // Ignore errors for test purposes
          });
        }
      }, [raiseDispute]);

      return <div>Test Component</div>;
    }

    render(
      <SimpleAuthProvider>
        <TestComponentNoId />
      </SimpleAuthProvider>
    );

    // Wait for the dispute to be processed
    await waitFor(() => {
      expect(mockFundAndSendTransaction).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Verify blockchain transaction was called
    expect(mockFundAndSendTransaction).toHaveBeenCalledWith({
      to: '0xTestContract',
      data: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
      value: '0'
    });

    // Verify notification was NOT called (no contract ID)
    expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
  });

  it('should encode raiseDispute function correctly with no parameters', async () => {
    render(
      <SimpleAuthProvider>
        <TestComponent />
      </SimpleAuthProvider>
    );

    await waitFor(() => {
      expect(mockFundAndSendTransaction).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    const callArgs = mockFundAndSendTransaction.mock.calls[0][0];

    // Verify the encoded function data is for raiseDispute() with no parameters
    // raiseDispute() function selector: keccak256("raiseDispute()") = 0x6daa2d44...
    expect(callArgs.data).toMatch(/^0x6daa2d44$/);
  });
});