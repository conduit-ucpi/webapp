/**
 * Tests for Nonce Sequencing in Contract Transaction Sequence
 *
 * These tests verify that the transaction sequence properly handles nonce management
 * to prevent "replacement transaction underpriced" errors caused by nonce collisions.
 */

import { executeContractTransactionSequence } from '@/utils/contractTransactionSequence';

// Mock Web3Service with nonce tracking
const createMockWeb3Service = () => {
  let currentNonce = 100; // Start with a known nonce
  const transactionHistory: Array<{ nonce: number, txHash: string, confirmed: boolean }> = [];

  return {
    waitForTransaction: jest.fn().mockImplementation(async (txHash: string, timeout: number) => {
      // Find the transaction in our history
      const tx = transactionHistory.find(t => t.txHash === txHash);
      if (!tx) {
        throw new Error(`Transaction ${txHash} not found in history`);
      }

      // Mark as confirmed and increment nonce AFTER this transaction
      tx.confirmed = true;
      // Increment the current nonce so the next transaction gets a higher nonce
      currentNonce = tx.nonce + 1;

      // Return a mock receipt
      return {
        blockNumber: Math.floor(Math.random() * 1000000),
        status: 1,
        transactionHash: txHash
      };
    }),

    // Mock method to track transaction creation
    recordTransaction: (txHash: string) => {
      const nonce = currentNonce;
      transactionHistory.push({ nonce, txHash, confirmed: false });
      return nonce;
    },

    getCurrentNonce: () => currentNonce,
    getTransactionHistory: () => transactionHistory
  };
};

describe('Contract Transaction Sequence - Nonce Sequencing', () => {
  let mockWeb3Service: ReturnType<typeof createMockWeb3Service>;
  let mockAuthenticatedFetch: jest.Mock;
  let mockApproveUSDC: jest.Mock;
  let mockDepositToContract: jest.Mock;
  let mockGetWeb3Service: jest.Mock;

  beforeEach(() => {
    mockWeb3Service = createMockWeb3Service();

    mockAuthenticatedFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        contractAddress: '0xTestContract',
        transactionHash: '0xContractCreationTx'
      })
    });

    mockApproveUSDC = jest.fn().mockImplementation(async (contractAddress: string, amount: string) => {
      const nonce = mockWeb3Service.recordTransaction(`0xApprovalTx_nonce_${mockWeb3Service.getCurrentNonce()}`);
      const txHash = `0xApprovalTx_nonce_${nonce}`;
      return txHash;
    });

    mockDepositToContract = jest.fn().mockImplementation(async (contractAddress: string) => {
      const nonce = mockWeb3Service.recordTransaction(`0xDepositTx_nonce_${mockWeb3Service.getCurrentNonce()}`);
      const txHash = `0xDepositTx_nonce_${nonce}`;
      return txHash;
    });

    mockGetWeb3Service = jest.fn().mockResolvedValue(mockWeb3Service);

    // Mock setTimeout to avoid actual delays in tests
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return {} as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should ensure nonces are sequential and never collide', async () => {
    // Record the contract creation transaction
    mockWeb3Service.recordTransaction('0xContractCreationTx');

    const result = await executeContractTransactionSequence(
      {
        contractserviceId: 'test-contract-id',
        tokenAddress: '0xUSDC',
        buyer: '0xBuyer',
        seller: '0xSeller',
        amount: 1000000,
        expiryTimestamp: Date.now() + 86400000,
        description: 'Test contract'
      },
      {
        authenticatedFetch: mockAuthenticatedFetch,
        approveUSDC: mockApproveUSDC,
        depositToContract: mockDepositToContract,
        getWeb3Service: mockGetWeb3Service
      }
    );

    // Verify the result
    expect(result.contractAddress).toBe('0xTestContract');
    expect(result.contractCreationTxHash).toBe('0xContractCreationTx');

    // Verify transaction sequence and nonce ordering
    const history = mockWeb3Service.getTransactionHistory();
    expect(history).toHaveLength(3);

    // Check that nonces are sequential (no collisions)
    const nonces = history.map(tx => tx.nonce);
    expect(nonces).toEqual([100, 101, 102]); // Should be strictly increasing

    // Verify all transactions were confirmed before the next one started
    expect(mockWeb3Service.waitForTransaction).toHaveBeenCalledTimes(3);

    // Check the order of waitForTransaction calls
    const waitCalls = mockWeb3Service.waitForTransaction.mock.calls;
    expect(waitCalls[0][0]).toBe('0xContractCreationTx');
    expect(waitCalls[1][0]).toMatch(/0xApprovalTx_nonce_101/);
    expect(waitCalls[2][0]).toMatch(/0xDepositTx_nonce_102/);
  });

  it('should fail immediately if contract creation confirmation fails', async () => {
    // Mock contract creation transaction that fails confirmation
    mockWeb3Service.waitForTransaction = jest.fn().mockResolvedValue(null); // No receipt = failure

    mockWeb3Service.recordTransaction('0xContractCreationTx');

    await expect(executeContractTransactionSequence(
      {
        contractserviceId: 'test-contract-id',
        tokenAddress: '0xUSDC',
        buyer: '0xBuyer',
        seller: '0xSeller',
        amount: 1000000,
        expiryTimestamp: Date.now() + 86400000,
        description: 'Test contract'
      },
      {
        authenticatedFetch: mockAuthenticatedFetch,
        approveUSDC: mockApproveUSDC,
        depositToContract: mockDepositToContract,
        getWeb3Service: mockGetWeb3Service
      }
    )).rejects.toThrow('Contract creation timed out or failed - cannot proceed without confirmation');

    // Verify that approval and deposit were never called
    expect(mockApproveUSDC).not.toHaveBeenCalled();
    expect(mockDepositToContract).not.toHaveBeenCalled();
  });

  it('should fail immediately if USDC approval confirmation fails', async () => {
    // Mock successful contract creation but failed approval
    mockWeb3Service.recordTransaction('0xContractCreationTx');

    mockWeb3Service.waitForTransaction = jest.fn()
      .mockResolvedValueOnce({ // Contract creation succeeds
        blockNumber: 123456,
        status: 1,
        transactionHash: '0xContractCreationTx'
      })
      .mockResolvedValueOnce(null); // Approval fails

    await expect(executeContractTransactionSequence(
      {
        contractserviceId: 'test-contract-id',
        tokenAddress: '0xUSDC',
        buyer: '0xBuyer',
        seller: '0xSeller',
        amount: 1000000,
        expiryTimestamp: Date.now() + 86400000,
        description: 'Test contract'
      },
      {
        authenticatedFetch: mockAuthenticatedFetch,
        approveUSDC: mockApproveUSDC,
        depositToContract: mockDepositToContract,
        getWeb3Service: mockGetWeb3Service
      }
    )).rejects.toThrow('USDC approval timed out or failed - cannot proceed without confirmation');

    // Verify that approval was called but deposit was not
    expect(mockApproveUSDC).toHaveBeenCalled();
    expect(mockDepositToContract).not.toHaveBeenCalled();
  });

  it('should include nonce update delays after each confirmation', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    let delayCount = 0;

    // Mock setTimeout to track calls but not actually delay
    (global.setTimeout as any) = jest.fn().mockImplementation((callback: any, delay: number) => {
      if (delay === 2000) {
        delayCount++;
      }
      callback();
      return {} as any;
    });

    mockWeb3Service.recordTransaction('0xContractCreationTx');

    await executeContractTransactionSequence(
      {
        contractserviceId: 'test-contract-id',
        tokenAddress: '0xUSDC',
        buyer: '0xBuyer',
        seller: '0xSeller',
        amount: 1000000,
        expiryTimestamp: Date.now() + 86400000,
        description: 'Test contract'
      },
      {
        authenticatedFetch: mockAuthenticatedFetch,
        approveUSDC: mockApproveUSDC,
        depositToContract: mockDepositToContract,
        getWeb3Service: mockGetWeb3Service
      }
    );

    // Verify that 2-second delays were called (once after contract creation, once after approval)
    expect(delayCount).toBe(2);

    setTimeoutSpy.mockRestore();
  });

  it('should handle the scenario that caused the original nonce collision', async () => {
    // This test recreates the exact scenario from the bug report
    let contractCreationNonce: number;
    let approvalNonce: number;

    // Track when nonces are fetched
    mockApproveUSDC = jest.fn().mockImplementation(async (contractAddress: string, amount: string) => {
      approvalNonce = mockWeb3Service.recordTransaction(`0xApprovalTx_nonce_${mockWeb3Service.getCurrentNonce()}`);
      const txHash = `0xApprovalTx_nonce_${approvalNonce}`;
      return txHash;
    });

    // Record contract creation with initial nonce
    contractCreationNonce = mockWeb3Service.recordTransaction('0xContractCreationTx');

    await executeContractTransactionSequence(
      {
        contractserviceId: 'test-contract-id',
        tokenAddress: '0xUSDC',
        buyer: '0xBuyer',
        seller: '0xSeller',
        amount: 1000000,
        expiryTimestamp: Date.now() + 86400000,
        description: 'Test contract'
      },
      {
        authenticatedFetch: mockAuthenticatedFetch,
        approveUSDC: mockApproveUSDC,
        depositToContract: mockDepositToContract,
        getWeb3Service: mockGetWeb3Service
      }
    );

    // Verify that approval used a different nonce than contract creation
    expect(contractCreationNonce).toBe(100); // Initial nonce
    expect(approvalNonce!).toBe(101); // Should be incremented after contract creation confirmation

    // Verify no nonce collision occurred
    expect(approvalNonce!).not.toBe(contractCreationNonce);
  });

  it('should wait for confirmation before proceeding to next transaction', async () => {
    const confirmationOrder: string[] = [];

    // Track the order of operations
    mockWeb3Service.waitForTransaction = jest.fn().mockImplementation(async (txHash: string) => {
      confirmationOrder.push(`WAIT_START:${txHash}`);

      // Simulate transaction confirmation delay
      await new Promise(resolve => setTimeout(resolve, 100));

      confirmationOrder.push(`WAIT_COMPLETE:${txHash}`);

      return {
        blockNumber: Math.floor(Math.random() * 1000000),
        status: 1,
        transactionHash: txHash
      };
    });

    mockApproveUSDC = jest.fn().mockImplementation(async (contractAddress: string, amount: string) => {
      confirmationOrder.push('APPROVAL_START');
      const currentNonce = mockWeb3Service.getCurrentNonce();
      const nonce = mockWeb3Service.recordTransaction(`0xApprovalTx_nonce_${currentNonce}`);
      const txHash = `0xApprovalTx_nonce_${nonce}`;
      confirmationOrder.push('APPROVAL_COMPLETE');
      return txHash;
    });

    mockDepositToContract = jest.fn().mockImplementation(async (contractAddress: string) => {
      confirmationOrder.push('DEPOSIT_START');
      const currentNonce = mockWeb3Service.getCurrentNonce();
      const nonce = mockWeb3Service.recordTransaction(`0xDepositTx_nonce_${currentNonce}`);
      const txHash = `0xDepositTx_nonce_${nonce}`;
      confirmationOrder.push('DEPOSIT_COMPLETE');
      return txHash;
    });

    mockWeb3Service.recordTransaction('0xContractCreationTx');

    await executeContractTransactionSequence(
      {
        contractserviceId: 'test-contract-id',
        tokenAddress: '0xUSDC',
        buyer: '0xBuyer',
        seller: '0xSeller',
        amount: 1000000,
        expiryTimestamp: Date.now() + 86400000,
        description: 'Test contract'
      },
      {
        authenticatedFetch: mockAuthenticatedFetch,
        approveUSDC: mockApproveUSDC,
        depositToContract: mockDepositToContract,
        getWeb3Service: mockGetWeb3Service
      }
    );

    // Verify strict sequential execution (exact nonce values may vary by test setup)
    expect(confirmationOrder).toHaveLength(10);

    // Verify the order is correct
    expect(confirmationOrder[0]).toBe('WAIT_START:0xContractCreationTx');
    expect(confirmationOrder[1]).toBe('WAIT_COMPLETE:0xContractCreationTx');
    expect(confirmationOrder[2]).toBe('APPROVAL_START');
    expect(confirmationOrder[3]).toBe('APPROVAL_COMPLETE');
    expect(confirmationOrder[4]).toMatch(/WAIT_START:0xApprovalTx_nonce_\d+/);
    expect(confirmationOrder[5]).toMatch(/WAIT_COMPLETE:0xApprovalTx_nonce_\d+/);
    expect(confirmationOrder[6]).toBe('DEPOSIT_START');
    expect(confirmationOrder[7]).toBe('DEPOSIT_COMPLETE');
    expect(confirmationOrder[8]).toMatch(/WAIT_START:0xDepositTx_nonce_\d+/);
    expect(confirmationOrder[9]).toMatch(/WAIT_COMPLETE:0xDepositTx_nonce_\d+/);

    // Most importantly: Contract creation must be fully complete before approval starts
    const contractCompleteIndex = confirmationOrder.indexOf('WAIT_COMPLETE:0xContractCreationTx');
    const approvalStartIndex = confirmationOrder.indexOf('APPROVAL_START');
    expect(contractCompleteIndex).toBeLessThan(approvalStartIndex);
  });
});