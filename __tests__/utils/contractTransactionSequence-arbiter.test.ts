/**
 * Tests for arbiter-address wire-format handling in executeDirectPaymentSequence
 *
 * Contract:
 * - The optional `arbiterAddress` param must be translated to the wire field `arbiter`
 *   in the POST body to /api/chain/create-contract.
 * - When `arbiterAddress` is omitted / empty / null / undefined, the `arbiter` key
 *   must be OMITTED from the body entirely (chainservice defaults to zero address).
 */

import { executeDirectPaymentSequence } from '@/utils/contractTransactionSequence';

const mockWaitForTransaction = jest.fn();
const mockWeb3Service = { waitForTransaction: mockWaitForTransaction };

const mockAuthenticatedFetch = jest.fn();
const mockTransferToContract = jest.fn();
const mockGetWeb3Service = jest.fn().mockResolvedValue(mockWeb3Service);

const baseParams = {
  contractserviceId: 'test-contract-id',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  buyer: '0xBuyerAddress',
  seller: '0xSellerAddress',
  amount: 1500000,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
  description: 'Test contract'
};

const baseOptions = {
  authenticatedFetch: mockAuthenticatedFetch,
  transferToContract: mockTransferToContract,
  getWeb3Service: mockGetWeb3Service
};

/**
 * Wire up happy-path mocks so the sequence runs end-to-end.
 * Call 1: POST /api/chain/create-contract
 * Call 2: POST /api/chain/check-and-activate
 */
function setupHappyPathMocks() {
  mockAuthenticatedFetch
    .mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        contractAddress: '0xContractAddress',
        transactionHash: '0xContractCreationTxHash'
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });

  mockTransferToContract.mockResolvedValue('0xTransferTxHash');
  mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });
}

function getCreateContractBody(): any {
  // The first authenticatedFetch call is the /api/chain/create-contract POST
  const firstCall = mockAuthenticatedFetch.mock.calls[0];
  expect(firstCall[0]).toBe('/api/chain/create-contract');
  const init = firstCall[1];
  return JSON.parse(init.body as string);
}

describe('executeDirectPaymentSequence - arbiter wire format', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedFetch.mockReset();
    mockTransferToContract.mockReset();
    mockWaitForTransaction.mockReset();
  });

  it('includes arbiter in the request body when arbiterAddress is provided', async () => {
    setupHappyPathMocks();

    const arbiter = '0x1234567890AbcdEF1234567890aBcdef12345678';
    await executeDirectPaymentSequence(
      { ...baseParams, arbiterAddress: arbiter },
      baseOptions
    );

    const body = getCreateContractBody();
    expect(body).toHaveProperty('arbiter', arbiter);
    // The local/internal name must NOT leak onto the wire
    expect(body).not.toHaveProperty('arbiterAddress');
  });

  it('omits arbiter key when arbiterAddress is not provided', async () => {
    setupHappyPathMocks();

    await executeDirectPaymentSequence(baseParams, baseOptions);

    const body = getCreateContractBody();
    expect(body).not.toHaveProperty('arbiter');
    expect(body).not.toHaveProperty('arbiterAddress');
  });

  it('omits arbiter key when arbiterAddress is undefined', async () => {
    setupHappyPathMocks();

    await executeDirectPaymentSequence(
      { ...baseParams, arbiterAddress: undefined },
      baseOptions
    );

    const body = getCreateContractBody();
    expect(body).not.toHaveProperty('arbiter');
  });

  it('omits arbiter key when arbiterAddress is an empty string', async () => {
    setupHappyPathMocks();

    await executeDirectPaymentSequence(
      { ...baseParams, arbiterAddress: '' },
      baseOptions
    );

    const body = getCreateContractBody();
    expect(body).not.toHaveProperty('arbiter');
  });

  it('preserves all other required fields in the create-contract body', async () => {
    setupHappyPathMocks();

    const arbiter = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    await executeDirectPaymentSequence(
      { ...baseParams, arbiterAddress: arbiter },
      baseOptions
    );

    const body = getCreateContractBody();
    expect(body).toMatchObject({
      contractserviceId: baseParams.contractserviceId,
      tokenAddress: baseParams.tokenAddress,
      buyer: baseParams.buyer,
      seller: baseParams.seller,
      amount: baseParams.amount,
      expiryTimestamp: baseParams.expiryTimestamp,
      description: baseParams.description,
      arbiter
    });
  });
});
