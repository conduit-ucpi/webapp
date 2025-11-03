/**
 * Tests for contractTransactionSequence utility
 *
 * These tests ensure that the transaction sequence properly waits for
 * confirmations before proceeding to the next step, preventing nonce collisions.
 */

import { executeContractTransactionSequence } from '@/utils/contractTransactionSequence';

// Mock the Web3Service waitForTransaction method
const mockWaitForTransaction = jest.fn();
const mockWeb3Service = {
  waitForTransaction: mockWaitForTransaction
};

// Mock functions for the transaction sequence
const mockAuthenticatedFetch = jest.fn();
const mockApproveUSDC = jest.fn();
const mockDepositToContract = jest.fn();
const mockGetWeb3Service = jest.fn().mockResolvedValue(mockWeb3Service);
const mockOnProgress = jest.fn();

const defaultParams = {
  contractserviceId: 'test-contract-id',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  buyer: '0xBuyerAddress',
  seller: '0xSellerAddress',
  amount: 1500000, // 1.5 USDC in microUSDC
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
  description: 'Test contract'
};

const defaultOptions = {
  authenticatedFetch: mockAuthenticatedFetch,
  approveUSDC: mockApproveUSDC,
  depositToContract: mockDepositToContract,
  getWeb3Service: mockGetWeb3Service,
  onProgress: mockOnProgress
};

describe('executeContractTransactionSequence', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default mock behaviors
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        contractAddress: '0xContractAddress',
        transactionHash: '0xContractCreationTxHash'
      })
    });

    mockApproveUSDC.mockResolvedValue('0xApprovalTxHash');
    mockDepositToContract.mockResolvedValue('0xDepositTxHash');

    // Note: Don't set default mockWaitForTransaction behavior here
    // Each test should set up its own waitForTransaction expectations
  });

  describe('Transaction Sequencing', () => {
    it('should wait for contract creation confirmation before proceeding to approval', async () => {
      // Mock successful confirmations for all transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

      // Verify the sequence of calls (1 for contract creation + 1 for deposit notification)
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(2);
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(1, '0xContractCreationTxHash', 120000, 'test-contract-id');
      expect(mockApproveUSDC).toHaveBeenCalledTimes(1);
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(2, '0xApprovalTxHash', 120000, 'test-contract-id');
      expect(mockDepositToContract).toHaveBeenCalledTimes(1);
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(3, '0xDepositTxHash', 120000, 'test-contract-id');

      // Verify that approval wasn't called until after contract creation wait
      const authenticatedFetchCallOrder = mockAuthenticatedFetch.mock.invocationCallOrder[0];
      const firstWaitCallOrder = mockWaitForTransaction.mock.invocationCallOrder[0];
      const approveCallOrder = mockApproveUSDC.mock.invocationCallOrder[0];

      expect(authenticatedFetchCallOrder).toBeLessThan(firstWaitCallOrder);
      expect(firstWaitCallOrder).toBeLessThan(approveCallOrder);

      expect(result).toEqual({
        contractAddress: '0xContractAddress',
        contractCreationTxHash: '0xContractCreationTxHash',
        approvalTxHash: '0xApprovalTxHash',
        depositTxHash: '0xDepositTxHash'
      });
    });

    it('should wait for approval confirmation before proceeding to deposit', async () => {
      // Mock successful confirmations for all transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      await executeContractTransactionSequence(defaultParams, defaultOptions);

      // Verify that deposit wasn't called until after approval wait
      const approveCallOrder = mockApproveUSDC.mock.invocationCallOrder[0];
      const secondWaitCallOrder = mockWaitForTransaction.mock.invocationCallOrder[1];
      const depositCallOrder = mockDepositToContract.mock.invocationCallOrder[0];

      expect(approveCallOrder).toBeLessThan(secondWaitCallOrder);
      expect(secondWaitCallOrder).toBeLessThan(depositCallOrder);
    });

    it('should call onProgress callbacks in correct order', async () => {
      // Mock successful confirmations for all transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      await executeContractTransactionSequence(defaultParams, defaultOptions);

      const progressCalls = mockOnProgress.mock.calls.map(call => call[0]);
      expect(progressCalls).toEqual([
        'contract_creation',
        'contract_confirmation',
        'contract_created',
        'usdc_approval',
        'approval_confirmation',
        'deposit',
        'deposit_confirmation',
        'complete'
      ]);
    });
  });

  describe('Transaction Confirmation Waiting', () => {
    it('should wait for each transaction confirmation with 2 minute timeout', async () => {
      // Mock successful confirmations for all transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      await executeContractTransactionSequence(defaultParams, defaultOptions);

      // Verify each waitForTransaction call uses 120000ms (2 minute) timeout and includes contractId
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(1, '0xContractCreationTxHash', 120000, 'test-contract-id');
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(2, '0xApprovalTxHash', 120000, 'test-contract-id');
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(3, '0xDepositTxHash', 120000, 'test-contract-id');
    });

    it('should proceed if contract creation transaction hash is missing', async () => {
      // Mock response without transaction hash
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          contractAddress: '0xContractAddress'
          // No transactionHash
        })
      });

      // Mock successful confirmations for remaining transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

      // Should only wait for approval and deposit confirmations
      expect(mockWaitForTransaction).toHaveBeenCalledTimes(2);
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(1, '0xApprovalTxHash', 120000, 'test-contract-id');
      expect(mockWaitForTransaction).toHaveBeenNthCalledWith(2, '0xDepositTxHash', 120000, 'test-contract-id');

      expect(result.contractCreationTxHash).toBeUndefined();
    });

    it('should fail if transaction confirmation times out', async () => {
      // Mock timeout for contract creation
      mockWaitForTransaction
        .mockResolvedValueOnce(null) // Contract creation times out
        .mockResolvedValueOnce({ blockNumber: 12346, status: 1 }) // Approval succeeds (but won't be reached)
        .mockResolvedValueOnce({ blockNumber: 12347, status: 1 }); // Deposit succeeds (but won't be reached)

      // Should fail and throw error
      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Contract creation timed out or failed - cannot proceed without confirmation');

      // Subsequent transactions should NOT be attempted when contract creation fails
      expect(mockApproveUSDC).not.toHaveBeenCalled();
      expect(mockDepositToContract).not.toHaveBeenCalled();
    });

    it('should fail if transaction confirmation throws error', async () => {
      // Clear all mocks and reset implementations completely
      jest.clearAllMocks();
      mockWaitForTransaction.mockReset();
      mockAuthenticatedFetch.mockReset();
      mockApproveUSDC.mockReset();
      mockDepositToContract.mockReset();

      // Set up fresh mocks for this test
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTxHash'
        })
      });

      mockApproveUSDC.mockResolvedValue('0xApprovalTxHash');
      mockDepositToContract.mockResolvedValue('0xDepositTxHash');

      // Mock error for approval confirmation - should fail on the SECOND call to waitForTransaction
      mockWaitForTransaction
        .mockResolvedValueOnce({ blockNumber: 12345, status: 1 }) // Contract creation succeeds
        .mockRejectedValueOnce(new Error('Network error')); // Approval confirmation fails

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('USDC approval confirmation failed: Network error');

      // Contract creation should have been called
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);

      // Approval should have been attempted
      expect(mockApproveUSDC).toHaveBeenCalledTimes(1);

      // waitForTransaction should have been called twice (creation + approval, but approval failed)
      expect(mockWaitForTransaction).toHaveBeenCalledTimes(2);

      // But deposit should NOT be called due to approval confirmation failure
      expect(mockDepositToContract).not.toHaveBeenCalled();
    });

  });

  describe('Error Handling', () => {
    it('should throw error if contract creation fails', async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Contract creation failed'
        })
      });

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Contract creation failed');

      // Subsequent steps should not be called
      expect(mockApproveUSDC).not.toHaveBeenCalled();
      expect(mockDepositToContract).not.toHaveBeenCalled();
    });

    it('should throw error if USDC approval fails', async () => {
      // Reset all mocks completely for this test
      jest.clearAllMocks();
      mockWaitForTransaction.mockReset();
      mockAuthenticatedFetch.mockReset();
      mockApproveUSDC.mockReset();
      mockDepositToContract.mockReset();

      // Set up fresh mocks for this test
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTxHash'
        })
      });

      // Mock successful contract creation confirmation
      mockWaitForTransaction.mockResolvedValueOnce({ blockNumber: 12345, status: 1 });

      // Mock USDC approval failure
      mockApproveUSDC.mockRejectedValue(new Error('Approval failed'));

      // Mock other methods (won't be called but need to be defined)
      mockDepositToContract.mockResolvedValue('0xDepositTxHash');

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Approval failed');

      // Contract creation should have been called
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);

      // Approval should have been attempted (and failed)
      expect(mockApproveUSDC).toHaveBeenCalledTimes(1);

      // Deposit should not be called
      expect(mockDepositToContract).not.toHaveBeenCalled();
    });

    it('should throw error if deposit fails', async () => {
      // Mock successful confirmations for contract creation and approval
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      mockDepositToContract.mockRejectedValue(new Error('Deposit failed'));

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Deposit failed');

      // Contract creation and approval should have been called
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
      expect(mockApproveUSDC).toHaveBeenCalledTimes(1);
    });

    it('should handle contract creation response without error field', async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({}) // No error field
      });

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Contract creation failed');
    });

    it('should handle contract creation response JSON parse error', async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Contract creation failed');
    });
  });

  describe('Parameter Validation', () => {
    it('should pass correct parameters to contract creation', async () => {
      // Mock successful confirmations for all transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      await executeContractTransactionSequence(defaultParams, defaultOptions);

      expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/chain/create-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultParams)
      });
    });

    it('should pass correct parameters to token approval (including tokenAddress)', async () => {
      // Mock successful confirmations for all transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      await executeContractTransactionSequence(defaultParams, defaultOptions);

      expect(mockApproveUSDC).toHaveBeenCalledWith(
        '0xContractAddress',
        '1500000', // amount in micro units as string
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // tokenAddress from params
      );
    });

    it('should pass correct parameters to deposit', async () => {
      // Mock successful confirmations for all transactions
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      await executeContractTransactionSequence(defaultParams, defaultOptions);

      expect(mockDepositToContract).toHaveBeenCalledWith('0xContractAddress');
    });
  });

  describe('Nonce Collision Prevention', () => {
    it('should ensure no parallel transaction execution', async () => {
      let contractCreationCompleted = false;
      let approvalStarted = false;
      let approvalCompleted = false;
      let depositStarted = false;

      // Mock slow contract creation confirmation
      mockWaitForTransaction.mockImplementation((txHash, timeout) => {
        if (txHash === '0xContractCreationTxHash') {
          return new Promise(resolve => {
            setTimeout(() => {
              contractCreationCompleted = true;
              resolve({ blockNumber: 12345, status: 1 });
            }, 50);
          });
        }
        if (txHash === '0xApprovalTxHash') {
          return new Promise(resolve => {
            setTimeout(() => {
              approvalCompleted = true;
              resolve({ blockNumber: 12346, status: 1 });
            }, 50);
          });
        }
        return Promise.resolve({ blockNumber: 12347, status: 1 });
      });

      // Mock approval that checks timing
      mockApproveUSDC.mockImplementation(() => {
        approvalStarted = true;
        expect(contractCreationCompleted).toBe(true); // Must wait for contract creation
        return Promise.resolve('0xApprovalTxHash');
      });

      // Mock deposit that checks timing
      mockDepositToContract.mockImplementation(() => {
        depositStarted = true;
        expect(contractCreationCompleted).toBe(true); // Must wait for contract creation
        expect(approvalCompleted).toBe(true); // Must wait for approval
        return Promise.resolve('0xDepositTxHash');
      });

      await executeContractTransactionSequence(defaultParams, defaultOptions);

      expect(approvalStarted).toBe(true);
      expect(depositStarted).toBe(true);
    });
  });
});