/**
 * Focused test for nonce collision prevention in contract transaction sequence
 *
 * This test specifically verifies that transactions are executed sequentially
 * and that each step waits for the previous transaction to be confirmed
 * before proceeding, preventing the "replacement transaction underpriced" error.
 */

import { executeContractTransactionSequence } from '@/utils/contractTransactionSequence';

describe('Nonce Collision Prevention - Contract Transaction Sequence', () => {
  let executionLog: string[] = [];
  let mockWaitForTransaction: jest.Mock;
  let mockAuthenticatedFetch: jest.Mock;
  let mockApproveUSDC: jest.Mock;
  let mockDepositToContract: jest.Mock;

  beforeEach(() => {
    executionLog = [];
    jest.clearAllMocks();

    // Mock Web3Service with tracking
    mockWaitForTransaction = jest.fn().mockImplementation((txHash: string) => {
      executionLog.push(`WAIT_START:${txHash}`);
      return new Promise(resolve => {
        setTimeout(() => {
          executionLog.push(`WAIT_COMPLETE:${txHash}`);
          resolve({ blockNumber: Math.floor(Math.random() * 1000000), status: 1 });
        }, 10); // Small delay to simulate network confirmation
      });
    });

    const mockWeb3Service = {
      waitForTransaction: mockWaitForTransaction
    };

    // Mock contract creation with tracking
    mockAuthenticatedFetch = jest.fn().mockImplementation(() => {
      executionLog.push('CONTRACT_CREATION_START');
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTx'
        })
      }).then(result => {
        executionLog.push('CONTRACT_CREATION_COMPLETE');
        return result;
      });
    });

    // Mock USDC approval with tracking
    mockApproveUSDC = jest.fn().mockImplementation(() => {
      executionLog.push('APPROVAL_START');
      return Promise.resolve('0xApprovalTx').then(result => {
        executionLog.push('APPROVAL_COMPLETE');
        return result;
      });
    });

    // Mock deposit with tracking
    mockDepositToContract = jest.fn().mockImplementation(() => {
      executionLog.push('DEPOSIT_START');
      return Promise.resolve('0xDepositTx').then(result => {
        executionLog.push('DEPOSIT_COMPLETE');
        return result;
      });
    });

    const mockGetWeb3Service = jest.fn().mockResolvedValue(mockWeb3Service);
    const mockOnProgress = jest.fn();

    // Store mocks for use in tests
    (global as any).testMocks = {
      authenticatedFetch: mockAuthenticatedFetch,
      approveUSDC: mockApproveUSDC,
      depositToContract: mockDepositToContract,
      getWeb3Service: mockGetWeb3Service,
      onProgress: mockOnProgress
    };
  });

  it('should prevent nonce collision by enforcing sequential execution', async () => {
    const params = {
      contractserviceId: 'test-contract',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      buyer: '0xBuyer',
      seller: '0xSeller',
      amount: 1000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test contract for nonce prevention'
    };

    await executeContractTransactionSequence(params, (global as any).testMocks);

    // Verify the exact execution order
    const expectedOrder = [
      'CONTRACT_CREATION_START',
      'CONTRACT_CREATION_COMPLETE',
      'WAIT_START:0xContractCreationTx',
      'WAIT_COMPLETE:0xContractCreationTx',
      'APPROVAL_START',
      'APPROVAL_COMPLETE',
      'WAIT_START:0xApprovalTx',
      'WAIT_COMPLETE:0xApprovalTx',
      'DEPOSIT_START',
      'DEPOSIT_COMPLETE',
      'WAIT_START:0xDepositTx',
      'WAIT_COMPLETE:0xDepositTx'
    ];

    expect(executionLog).toEqual(expectedOrder);

    // Verify that no two transaction operations overlap
    for (let i = 0; i < executionLog.length - 1; i++) {
      const current = executionLog[i];
      const next = executionLog[i + 1];

      // If a transaction starts, its wait must complete before the next transaction starts
      if (current.includes('WAIT_START:')) {
        const txHash = current.split(':')[1];
        const waitCompleteIndex = executionLog.findIndex(log => log === `WAIT_COMPLETE:${txHash}`);
        const nextTransactionStartIndex = executionLog.findIndex((log, index) =>
          index > i && (
            log.includes('APPROVAL_START') ||
            log.includes('DEPOSIT_START')
          )
        );

        if (nextTransactionStartIndex !== -1) {
          expect(waitCompleteIndex).toBeLessThan(nextTransactionStartIndex);
        }
      }
    }

    console.log('✅ Execution order verified - no nonce collisions possible');
    console.log('📋 Execution log:', executionLog);
  });

  it('should demonstrate the problem that would occur without proper sequencing', () => {
    // This test shows what would happen if we didn't wait for confirmations

    const simulatedRushSequence = [
      'CONTRACT_CREATION_START',
      'CONTRACT_CREATION_COMPLETE',
      'APPROVAL_START',           // ❌ BAD: Started before contract creation confirmed
      'WAIT_START:0xContractCreationTx',
      'APPROVAL_COMPLETE',
      'DEPOSIT_START',           // ❌ BAD: Started before approval confirmed
      'WAIT_START:0xApprovalTx',
      'DEPOSIT_COMPLETE',
      'WAIT_START:0xDepositTx',
      'WAIT_COMPLETE:0xContractCreationTx',
      'WAIT_COMPLETE:0xApprovalTx',
      'WAIT_COMPLETE:0xDepositTx'
    ];

    // Find overlapping transaction execution (the nonce collision scenario)
    const approvalStartIndex = simulatedRushSequence.indexOf('APPROVAL_START');
    const contractWaitCompleteIndex = simulatedRushSequence.indexOf('WAIT_COMPLETE:0xContractCreationTx');

    const depositStartIndex = simulatedRushSequence.indexOf('DEPOSIT_START');
    const approvalWaitCompleteIndex = simulatedRushSequence.indexOf('WAIT_COMPLETE:0xApprovalTx');

    // In the bad scenario, approval starts before contract creation is confirmed
    expect(approvalStartIndex).toBeLessThan(contractWaitCompleteIndex);

    // And deposit starts before approval is confirmed
    expect(depositStartIndex).toBeLessThan(approvalWaitCompleteIndex);

    console.log('❌ This would cause nonce collisions - transactions trying to use the same nonce');
    console.log('📋 Bad sequence (what we prevent):', simulatedRushSequence);
  });

  it('should handle real-world timing with proper sequencing', async () => {
    // Mock more realistic delays
    mockWaitForTransaction.mockImplementation((txHash: string) => {
      executionLog.push(`WAIT_START:${txHash}`);

      // Simulate real Base network confirmation times
      const delay = txHash.includes('Contract') ? 2000 : // Contract creation: 2 seconds
                   txHash.includes('Approval') ? 1500 : // Approval: 1.5 seconds
                   1000; // Deposit: 1 second

      return new Promise(resolve => {
        setTimeout(() => {
          executionLog.push(`WAIT_COMPLETE:${txHash}`);
          resolve({
            blockNumber: Math.floor(Math.random() * 1000000),
            status: 1
          });
        }, delay);
      });
    });

    const startTime = Date.now();

    const params = {
      contractserviceId: 'realistic-test',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      buyer: '0xBuyer',
      seller: '0xSeller',
      amount: 2500000, // 2.5 USDC
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Realistic timing test'
    };

    const result = await executeContractTransactionSequence(params, (global as any).testMocks);

    const totalTime = Date.now() - startTime;

    // Should take at least the sum of all confirmation delays (4.5 seconds)
    expect(totalTime).toBeGreaterThan(4500);

    // Verify all transactions completed successfully
    expect(result.contractAddress).toBe('0xContractAddress');
    expect(result.contractCreationTxHash).toBe('0xContractCreationTx');
    expect(result.approvalTxHash).toBe('0xApprovalTx');
    expect(result.depositTxHash).toBe('0xDepositTx');

    // Verify proper sequential execution despite realistic delays
    const contractWaitCompleteIndex = executionLog.indexOf('WAIT_COMPLETE:0xContractCreationTx');
    const approvalStartIndex = executionLog.indexOf('APPROVAL_START');

    const approvalWaitCompleteIndex = executionLog.indexOf('WAIT_COMPLETE:0xApprovalTx');
    const depositStartIndex = executionLog.indexOf('DEPOSIT_START');

    expect(contractWaitCompleteIndex).toBeLessThan(approvalStartIndex);
    expect(approvalWaitCompleteIndex).toBeLessThan(depositStartIndex);

    console.log(`✅ Realistic timing test completed in ${totalTime}ms`);
    console.log('📋 Sequential execution maintained despite network delays');
  });
});