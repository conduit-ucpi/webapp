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
  // After resolveOrCreateOnChainContract was added (regression: orphan contract
  // address from chainservice when contractservice rejects the create
  // notification), the helper performs two GETs against /api/contracts/{id}: one
  // before the create call (to detect an already-deployed escrow) and one
  // after (to read the authoritative address from contractservice). Tests use
  // this default URL-aware fetch mock so individual cases only need to override
  // when they want the deployed address to differ from '0xContractAddress'.
  const installDefaultFetchMock = (overrides: { contractAddress?: string; transactionHash?: string; createOk?: boolean; createBody?: any } = {}) => {
    const deployedAddress = overrides.contractAddress ?? '0xContractAddress';
    const txHash = overrides.transactionHash;
    let pendingFetchCount = 0;

    mockAuthenticatedFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/contracts/')) {
        pendingFetchCount++;
        // First GET: contract not yet deployed. Subsequent GETs: deployed.
        const body = pendingFetchCount === 1
          ? { id: 'test-contract-id' }
          : { id: 'test-contract-id', contractAddress: deployedAddress };
        return { ok: true, json: jest.fn().mockResolvedValue(body) } as any;
      }
      if (url.includes('/api/chain/create-contract')) {
        if (overrides.createOk === false) {
          return { ok: false, json: jest.fn().mockResolvedValue(overrides.createBody ?? { error: 'Contract creation failed' }) } as any;
        }
        return {
          ok: true,
          json: jest.fn().mockResolvedValue({
            contractAddress: deployedAddress,
            ...(txHash !== undefined ? { transactionHash: txHash } : { transactionHash: '0xContractCreationTxHash' })
          })
        } as any;
      }
      // deposit-notification or other
      return { ok: true, json: jest.fn().mockResolvedValue({ success: true }) } as any;
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    installDefaultFetchMock();

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

      // Sequence: pre-create GET, create POST, post-create GET, deposit-notification POST
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(4);
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
        .rejects.toThrow('Contract creation timed out or failed');

      // Subsequent transactions should NOT be attempted when contract creation fails
      expect(mockApproveUSDC).not.toHaveBeenCalled();
      expect(mockDepositToContract).not.toHaveBeenCalled();
    });

    it('should fail if transaction confirmation throws error', async () => {
      jest.clearAllMocks();
      mockWaitForTransaction.mockReset();
      mockAuthenticatedFetch.mockReset();
      mockApproveUSDC.mockReset();
      mockDepositToContract.mockReset();

      installDefaultFetchMock();
      mockApproveUSDC.mockResolvedValue('0xApprovalTxHash');
      mockDepositToContract.mockResolvedValue('0xDepositTxHash');

      // Mock error for approval confirmation - should fail on the SECOND call to waitForTransaction
      mockWaitForTransaction
        .mockResolvedValueOnce({ blockNumber: 12345, status: 1 }) // Contract creation succeeds
        .mockRejectedValueOnce(new Error('Network error')); // Approval confirmation fails

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('USDC approval confirmation failed: Network error');

      // Pre-create GET, create POST, post-create GET (then approval failed before deposit-notification)
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(3);

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
      installDefaultFetchMock({ createOk: false, createBody: { error: 'Contract creation failed' } });

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Contract creation failed');

      // Subsequent steps should not be called
      expect(mockApproveUSDC).not.toHaveBeenCalled();
      expect(mockDepositToContract).not.toHaveBeenCalled();
    });

    it('should throw error if USDC approval fails', async () => {
      jest.clearAllMocks();
      mockWaitForTransaction.mockReset();
      mockAuthenticatedFetch.mockReset();
      mockApproveUSDC.mockReset();
      mockDepositToContract.mockReset();

      installDefaultFetchMock();
      mockWaitForTransaction.mockResolvedValueOnce({ blockNumber: 12345, status: 1 });
      mockApproveUSDC.mockRejectedValue(new Error('Approval failed'));
      mockDepositToContract.mockResolvedValue('0xDepositTxHash');

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Approval failed');

      // Pre-create GET, create POST, post-create GET (then approval failed)
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(3);
      expect(mockApproveUSDC).toHaveBeenCalledTimes(1);
      expect(mockDepositToContract).not.toHaveBeenCalled();
    });

    it('should throw error if deposit fails', async () => {
      // Mock successful confirmations for contract creation and approval
      mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });

      mockDepositToContract.mockRejectedValue(new Error('Deposit failed'));

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Deposit failed');

      // Pre-create GET, create POST, post-create GET (deposit-notification not reached)
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(3);
      expect(mockApproveUSDC).toHaveBeenCalledTimes(1);
    });

    it('should handle contract creation response without error field', async () => {
      installDefaultFetchMock({ createOk: false, createBody: {} });

      await expect(executeContractTransactionSequence(defaultParams, defaultOptions))
        .rejects.toThrow('Contract creation failed');
    });

    it('should handle contract creation response JSON parse error', async () => {
      // Override the default to make the create call return ok:false with rejecting json
      mockAuthenticatedFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/contracts/')) {
          return { ok: true, json: jest.fn().mockResolvedValue({ id: 'test-contract-id' }) } as any;
        }
        return { ok: false, json: jest.fn().mockRejectedValue(new Error('Invalid JSON')) } as any;
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