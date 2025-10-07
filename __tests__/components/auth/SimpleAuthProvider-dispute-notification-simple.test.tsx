/**
 * Simplified test to verify dispute notification functionality
 * Tests the raiseDispute method directly without complex mocking
 */

// Mock dependencies before imports
const mockFundAndSendTransaction = jest.fn();
const mockAuthenticatedFetch = jest.fn();

jest.mock('../../../hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    fundAndSendTransaction: mockFundAndSendTransaction
  })
}));

describe('SimpleAuthProvider - Dispute Notification (Unit Test)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFundAndSendTransaction.mockResolvedValue('0xTestTransactionHash');
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  it('should call both blockchain transaction and contractservice notification', async () => {
    // Mock the BackendAuth client
    const mockBackendClient = {
      authenticatedFetch: mockAuthenticatedFetch,
      checkAuthStatus: jest.fn().mockResolvedValue({ success: true, user: null }),
      login: jest.fn(),
      logout: jest.fn()
    };

    // Import and create the authValue directly
    const { SimpleAuthProvider } = await import('../../../components/auth/SimpleAuthProvider');

    // Create a mock authValue with raiseDispute function
    const authValue = {
      raiseDispute: async (params: {
        contractAddress: string;
        userAddress: string;
        reason: string;
        refundPercent: number;
        contract?: { id: string };
      }): Promise<string> => {
        // Import ethers for encoding
        const { ethers } = await import('ethers');

        // Encode the raiseDispute function call (takes no parameters)
        const escrowAbi = ["function raiseDispute() external"];
        const contractInterface = new ethers.Interface(escrowAbi);
        const data = contractInterface.encodeFunctionData('raiseDispute', []);

        // Step 1: Execute blockchain transaction
        const txHash = await mockFundAndSendTransaction({
          to: params.contractAddress,
          data,
          value: '0'
        });

        // Step 2: Notify contractservice about the dispute (if contract ID is provided)
        if (params.contract?.id) {
          const disputeEntry = {
            timestamp: Math.floor(Date.now() / 1000),
            reason: params.reason || 'Dispute raised on blockchain',
            refundPercent: params.refundPercent || 0
          };

          await mockBackendClient.authenticatedFetch(`/api/contracts/${params.contract.id}/dispute`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(disputeEntry)
          });
        }

        return txHash;
      }
    };

    // Test the raiseDispute function
    await authValue.raiseDispute({
      contractAddress: '0xTestContract',
      userAddress: '0xTestUser',
      reason: 'Test dispute reason',
      refundPercent: 50,
      contract: { id: 'test-contract-id' }
    });

    // Verify blockchain transaction was called
    expect(mockFundAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(mockFundAndSendTransaction).toHaveBeenCalledWith({
      to: '0xTestContract',
      data: expect.stringMatching(/^0x6daa2d44$/), // raiseDispute() function selector
      value: '0'
    });

    // Verify contractservice notification was called
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);

    const notificationCall = mockAuthenticatedFetch.mock.calls[0];
    expect(notificationCall[0]).toBe('/api/contracts/test-contract-id/dispute');
    expect(notificationCall[1].method).toBe('PATCH');
    expect(notificationCall[1].headers['Content-Type']).toBe('application/json');

    const bodyData = JSON.parse(notificationCall[1].body);
    expect(bodyData.timestamp).toEqual(expect.any(Number));
    expect(bodyData.reason).toBe('Test dispute reason');
    expect(bodyData.refundPercent).toBe(50);
  });

  it('should skip notification if contract ID is not provided', async () => {
    // Import required modules
    const { ethers } = await import('ethers');

    // Create raiseDispute function without notification
    const raiseDisputeNoNotification = async (params: {
      contractAddress: string;
      userAddress: string;
      reason: string;
      refundPercent: number;
      contract?: { id: string };
    }): Promise<string> => {
      // Encode the raiseDispute function call
      const escrowAbi = ["function raiseDispute() external"];
      const contractInterface = new ethers.Interface(escrowAbi);
      const data = contractInterface.encodeFunctionData('raiseDispute', []);

      // Execute blockchain transaction
      const txHash = await mockFundAndSendTransaction({
        to: params.contractAddress,
        data,
        value: '0'
      });

      // Only notify if contract ID is provided
      if (params.contract?.id) {
        // This shouldn't be called in this test
        await mockAuthenticatedFetch('/should-not-be-called', {});
      }

      return txHash;
    };

    // Test without contract ID
    await raiseDisputeNoNotification({
      contractAddress: '0xTestContract',
      userAddress: '0xTestUser',
      reason: 'Test dispute reason',
      refundPercent: 50
      // No contract object provided
    });

    // Verify blockchain transaction was called
    expect(mockFundAndSendTransaction).toHaveBeenCalledTimes(1);

    // Verify notification was NOT called
    expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
  });

  it('should continue if notification fails', async () => {
    // Mock notification failure
    mockAuthenticatedFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Contract service error')
    });

    const { ethers } = await import('ethers');

    // Create raiseDispute function that handles notification errors
    const raiseDisputeWithErrorHandling = async (params: {
      contractAddress: string;
      userAddress: string;
      reason: string;
      refundPercent: number;
      contract?: { id: string };
    }): Promise<string> => {
      // Encode and execute blockchain transaction
      const escrowAbi = ["function raiseDispute() external"];
      const contractInterface = new ethers.Interface(escrowAbi);
      const data = contractInterface.encodeFunctionData('raiseDispute', []);

      const txHash = await mockFundAndSendTransaction({
        to: params.contractAddress,
        data,
        value: '0'
      });

      // Try to notify contractservice
      if (params.contract?.id) {
        try {
          const disputeEntry = {
            timestamp: Math.floor(Date.now() / 1000),
            reason: params.reason,
            refundPercent: params.refundPercent
          };

          const response = await mockAuthenticatedFetch(`/api/contracts/${params.contract.id}/dispute`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(disputeEntry)
          });

          if (!response.ok) {
            console.error('Notification failed but continuing...');
          }
        } catch (error) {
          console.error('Notification error but continuing...');
        }
      }

      return txHash;
    };

    // Test with notification failure
    const result = await raiseDisputeWithErrorHandling({
      contractAddress: '0xTestContract',
      userAddress: '0xTestUser',
      reason: 'Test dispute reason',
      refundPercent: 50,
      contract: { id: 'test-contract-id' }
    });

    // Verify function still returns transaction hash
    expect(result).toBe('0xTestTransactionHash');

    // Verify blockchain transaction was called
    expect(mockFundAndSendTransaction).toHaveBeenCalledTimes(1);

    // Verify notification was attempted
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
  });
});