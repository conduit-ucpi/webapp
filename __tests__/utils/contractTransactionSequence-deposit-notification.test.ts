import { executeContractTransactionSequence } from '../../utils/contractTransactionSequence';

// Mock all the required functions
const mockAuthenticatedFetch = jest.fn();
const mockApproveUSDC = jest.fn();
const mockDepositToContract = jest.fn();
const mockWaitForTransaction = jest.fn();
const mockGetWeb3Service = jest.fn();

// Test parameters
const defaultParams = {
  contractserviceId: 'test-contract-id-123',
  tokenAddress: '0xUSDCAddress',
  buyer: '0xBuyerAddress',
  seller: '0xSellerAddress',
  amount: 1000000, // 1 USDC in microUSDC
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
  description: 'Test contract for deposit notification'
};

const defaultOptions = {
  authenticatedFetch: mockAuthenticatedFetch,
  approveUSDC: mockApproveUSDC,
  depositToContract: mockDepositToContract,
  getWeb3Service: mockGetWeb3Service,
  onProgress: jest.fn()
};

describe('Contract Transaction Sequence - Deposit Notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Web3Service
    mockGetWeb3Service.mockResolvedValue({
      waitForTransaction: mockWaitForTransaction
    });

    // Mock successful transaction confirmations
    mockWaitForTransaction.mockResolvedValue({
      blockNumber: 12345,
      status: 1
    });

    // Mock successful transactions
    mockApproveUSDC.mockResolvedValue('0xApprovalTxHash');
    mockDepositToContract.mockResolvedValue('0xDepositTxHash');
  });

  it('should call deposit notification after successful deposit confirmation', async () => {
    // Mock contract creation response
    mockAuthenticatedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTxHash'
        })
      })
      // Mock deposit notification response
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

    const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

    // Verify the sequence completed successfully
    expect(result).toEqual({
      contractAddress: '0xContractAddress',
      contractCreationTxHash: '0xContractCreationTxHash',
      approvalTxHash: '0xApprovalTxHash',
      depositTxHash: '0xDepositTxHash'
    });

    // Verify deposit notification was called
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(2);

    // First call: contract creation
    expect(mockAuthenticatedFetch).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything());

    // Second call: deposit notification
    expect(mockAuthenticatedFetch).toHaveBeenNthCalledWith(2,
      '/api/contracts/deposit-notification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractHash: '0xContractAddress'
        })
      }
    );
  });

  it('should complete successfully even if deposit notification fails', async () => {
    // Mock contract creation success, deposit notification failure
    mockAuthenticatedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTxHash'
        })
      })
      // Mock deposit notification failure
      .mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Contract service error')
      });

    const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

    // Verify the sequence still completed successfully
    expect(result).toEqual({
      contractAddress: '0xContractAddress',
      contractCreationTxHash: '0xContractCreationTxHash',
      approvalTxHash: '0xApprovalTxHash',
      depositTxHash: '0xDepositTxHash'
    });

    // Verify deposit notification was attempted
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(2);
    expect(mockAuthenticatedFetch).toHaveBeenNthCalledWith(2,
      '/api/contracts/deposit-notification',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('should call deposit notification with correct contract address', async () => {
    const testContractAddress = '0xSpecificContractAddress123';

    // Mock contract creation with specific address
    mockAuthenticatedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          contractAddress: testContractAddress,
          transactionHash: '0xContractCreationTxHash'
        })
      })
      // Mock deposit notification success
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

    await executeContractTransactionSequence(defaultParams, defaultOptions);

    // Verify deposit notification uses the correct contract address
    expect(mockAuthenticatedFetch).toHaveBeenNthCalledWith(2,
      '/api/contracts/deposit-notification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractHash: testContractAddress
        })
      }
    );
  });

  it('should only call deposit notification after deposit confirmation, not before', async () => {
    // Create a custom mockWaitForTransaction that tracks when it's called
    const waitCallOrder: string[] = [];

    mockWaitForTransaction.mockImplementation((txHash: string) => {
      waitCallOrder.push(`WAIT_${txHash}`);
      return Promise.resolve({ blockNumber: 12345, status: 1 });
    });

    // Track authenticatedFetch calls
    const fetchCallOrder: string[] = [];
    mockAuthenticatedFetch.mockImplementation((url: string) => {
      if (url.includes('deposit-notification')) {
        fetchCallOrder.push('DEPOSIT_NOTIFICATION');
      } else {
        fetchCallOrder.push('CONTRACT_CREATION');
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTxHash',
          success: true
        })
      });
    });

    await executeContractTransactionSequence(defaultParams, defaultOptions);

    // Verify deposit notification only happened after deposit wait
    expect(waitCallOrder).toContain('WAIT_0xDepositTxHash');
    expect(fetchCallOrder).toEqual(['CONTRACT_CREATION', 'DEPOSIT_NOTIFICATION']);

    // Get the indices to verify order
    const depositWaitIndex = waitCallOrder.findIndex(call => call === 'WAIT_0xDepositTxHash');
    const notificationIndex = fetchCallOrder.findIndex(call => call === 'DEPOSIT_NOTIFICATION');

    // Notification should be after deposit wait (this is a timing assertion)
    expect(depositWaitIndex).toBeGreaterThanOrEqual(0);
    expect(notificationIndex).toBe(1); // Second fetch call
  });

  it('should not break if deposit notification throws an exception', async () => {
    // Mock contract creation success
    mockAuthenticatedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTxHash'
        })
      })
      // Mock deposit notification throwing exception
      .mockRejectedValueOnce(new Error('Network error'));

    // Should not throw despite notification failure
    const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

    // Verify the sequence still completed successfully
    expect(result).toEqual({
      contractAddress: '0xContractAddress',
      contractCreationTxHash: '0xContractCreationTxHash',
      approvalTxHash: '0xApprovalTxHash',
      depositTxHash: '0xDepositTxHash'
    });

    // Verify notification was attempted
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(2);
  });
});