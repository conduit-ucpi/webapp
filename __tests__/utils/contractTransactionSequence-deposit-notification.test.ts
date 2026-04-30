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

/**
 * URL-aware fetch mock. resolveOrCreateOnChainContract performs:
 *   1. GET /api/contracts/{id}      - pending record (not yet deployed)
 *   2. POST /api/chain/create-contract
 *   3. GET /api/contracts/{id}      - pending record (now with stored contractAddress)
 * After that the sequence does its on-chain steps and finally:
 *   4. POST /api/contracts/deposit-notification
 */
function installFetchMock(opts: {
  contractAddress?: string;
  transactionHash?: string;
  depositNotificationResponse?: { ok: boolean; bodyText?: string; bodyJson?: any };
  depositNotificationThrows?: Error;
} = {}) {
  const deployedAddress = opts.contractAddress ?? '0xContractAddress';
  const txHash = opts.transactionHash ?? '0xContractCreationTxHash';
  let pendingFetchCount = 0;

  mockAuthenticatedFetch.mockImplementation(async (url: string) => {
    if (url.includes('/api/contracts/deposit-notification')) {
      if (opts.depositNotificationThrows) throw opts.depositNotificationThrows;
      const r = opts.depositNotificationResponse ?? { ok: true, bodyJson: { success: true } };
      return {
        ok: r.ok,
        json: () => Promise.resolve(r.bodyJson ?? {}),
        text: () => Promise.resolve(r.bodyText ?? '')
      } as any;
    }
    if (url.includes('/api/contracts/')) {
      pendingFetchCount++;
      const body = pendingFetchCount === 1
        ? { id: defaultParams.contractserviceId }
        : { id: defaultParams.contractserviceId, contractAddress: deployedAddress };
      return { ok: true, json: () => Promise.resolve(body) } as any;
    }
    if (url.includes('/api/chain/create-contract')) {
      return {
        ok: true,
        json: () => Promise.resolve({ contractAddress: deployedAddress, transactionHash: txHash })
      } as any;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('Contract Transaction Sequence - Deposit Notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetWeb3Service.mockResolvedValue({
      waitForTransaction: mockWaitForTransaction
    });

    mockWaitForTransaction.mockResolvedValue({
      blockNumber: 12345,
      status: 1
    });

    mockApproveUSDC.mockResolvedValue('0xApprovalTxHash');
    mockDepositToContract.mockResolvedValue('0xDepositTxHash');
  });

  it('should call deposit notification after successful deposit confirmation', async () => {
    installFetchMock();

    const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

    expect(result).toEqual({
      contractAddress: '0xContractAddress',
      contractCreationTxHash: '0xContractCreationTxHash',
      approvalTxHash: '0xApprovalTxHash',
      depositTxHash: '0xDepositTxHash'
    });

    // Pre-create GET, create POST, post-create GET, deposit-notification POST
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(4);

    // Deposit notification call (last)
    expect(mockAuthenticatedFetch).toHaveBeenLastCalledWith(
      '/api/contracts/deposit-notification',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractHash: '0xContractAddress' })
      }
    );
  });

  it('should complete successfully even if deposit notification fails', async () => {
    installFetchMock({
      depositNotificationResponse: { ok: false, bodyText: 'Contract service error' }
    });

    const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

    expect(result).toEqual({
      contractAddress: '0xContractAddress',
      contractCreationTxHash: '0xContractCreationTxHash',
      approvalTxHash: '0xApprovalTxHash',
      depositTxHash: '0xDepositTxHash'
    });

    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(4);
    expect(mockAuthenticatedFetch).toHaveBeenLastCalledWith(
      '/api/contracts/deposit-notification',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should call deposit notification with correct contract address', async () => {
    const testContractAddress = '0xSpecificContractAddress123';
    installFetchMock({ contractAddress: testContractAddress });

    await executeContractTransactionSequence(defaultParams, defaultOptions);

    expect(mockAuthenticatedFetch).toHaveBeenLastCalledWith(
      '/api/contracts/deposit-notification',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractHash: testContractAddress })
      }
    );
  });

  it('should only call deposit notification after deposit confirmation, not before', async () => {
    const waitCallOrder: string[] = [];
    mockWaitForTransaction.mockImplementation((txHash: string) => {
      waitCallOrder.push(`WAIT_${txHash}`);
      return Promise.resolve({ blockNumber: 12345, status: 1 });
    });

    const fetchCallOrder: string[] = [];
    let pendingFetchCount = 0;
    mockAuthenticatedFetch.mockImplementation((url: string) => {
      if (url.includes('deposit-notification')) {
        fetchCallOrder.push('DEPOSIT_NOTIFICATION');
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }
      if (url.includes('/api/contracts/')) {
        pendingFetchCount++;
        fetchCallOrder.push(pendingFetchCount === 1 ? 'PENDING_GET_PRE' : 'PENDING_GET_POST');
        const body = pendingFetchCount === 1
          ? { id: defaultParams.contractserviceId }
          : { id: defaultParams.contractserviceId, contractAddress: '0xContractAddress' };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
      }
      // create-contract
      fetchCallOrder.push('CONTRACT_CREATION');
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          contractAddress: '0xContractAddress',
          transactionHash: '0xContractCreationTxHash'
        })
      });
    });

    await executeContractTransactionSequence(defaultParams, defaultOptions);

    expect(waitCallOrder).toContain('WAIT_0xDepositTxHash');
    expect(fetchCallOrder).toEqual([
      'PENDING_GET_PRE',
      'CONTRACT_CREATION',
      'PENDING_GET_POST',
      'DEPOSIT_NOTIFICATION'
    ]);

    const depositWaitIndex = waitCallOrder.findIndex(call => call === 'WAIT_0xDepositTxHash');
    expect(depositWaitIndex).toBeGreaterThanOrEqual(0);
    expect(fetchCallOrder.indexOf('DEPOSIT_NOTIFICATION')).toBe(3);
  });

  it('should not break if deposit notification throws an exception', async () => {
    installFetchMock({ depositNotificationThrows: new Error('Network error') });

    const result = await executeContractTransactionSequence(defaultParams, defaultOptions);

    expect(result).toEqual({
      contractAddress: '0xContractAddress',
      contractCreationTxHash: '0xContractCreationTxHash',
      approvalTxHash: '0xApprovalTxHash',
      depositTxHash: '0xDepositTxHash'
    });

    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(4);
  });
});
