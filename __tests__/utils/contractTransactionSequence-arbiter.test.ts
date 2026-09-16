/**
 * Arbiter wire-format handling in executeDirectPaymentSequence.
 *
 * Contract:
 * - The optional `arbiterAddress` param must reach chainservice as the field `arbiter`.
 * - When omitted / empty / null / undefined, the key must be absent from the body entirely,
 *   so chainservice substitutes the DEFAULT_ARBITER Safe.
 *
 * This matters more than it used to. The arbiter is one of the terms the factory hashes into
 * an escrow's CREATE2 salt, so sending the wrong one — or sending an explicit value where
 * none was intended — does not merely mislabel the escrow. It names a different address, and
 * funds sent to the address this browser computed would then sit somewhere the factory can
 * never deploy to.
 */

import { executeDirectPaymentSequence } from '@/utils/contractTransactionSequence';

const mockWaitForTransaction = jest.fn();
const mockWeb3Service = { waitForTransaction: mockWaitForTransaction };

const mockAuthenticatedFetch = jest.fn();
const mockTransferToContract = jest.fn();
const mockGetWeb3Service = jest.fn().mockResolvedValue(mockWeb3Service);

const baseParams = {
  contractserviceId: '507f1f77bcf86cd799439011',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  buyer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  seller: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  amount: 1500000,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
  description: 'Test contract'
};

const baseOptions = {
  authenticatedFetch: mockAuthenticatedFetch,
  transferToContract: mockTransferToContract,
  getWeb3Service: mockGetWeb3Service,
  factoryAddress: '0x2e234DAe75C793f67A35089C9d99245E1C58470b',
  implementationAddress: '0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f',
  defaultArbiterAddress: '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C'
};

function setupHappyPathMocks() {
  mockAuthenticatedFetch.mockImplementation(async () => ({
    ok: true,
    json: jest.fn().mockResolvedValue({ success: true })
  }));
  mockTransferToContract.mockResolvedValue('0xTransferTxHash');
  mockWaitForTransaction.mockResolvedValue({ blockNumber: 12345, status: 1 });
}

function bodyOf(url: string): any {
  const call = mockAuthenticatedFetch.mock.calls.find((c: any[]) => c[0] === url);
  expect(call).toBeDefined();
  return JSON.parse(call![1].body as string);
}

const deployBody = () => bodyOf('/api/chain/deploy-and-activate');

describe('executeDirectPaymentSequence - arbiter wire format', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedFetch.mockReset();
    mockTransferToContract.mockReset();
    mockWaitForTransaction.mockReset();
  });

  it('includes arbiter when arbiterAddress is provided', async () => {
    setupHappyPathMocks();
    const arbiter = '0x1234567890AbcdEF1234567890aBcdef12345678';

    await executeDirectPaymentSequence({ ...baseParams, arbiterAddress: arbiter }, baseOptions);

    expect(deployBody().arbiter).toBe(arbiter);
  });

  it.each([
    ['not provided', {}],
    ['undefined', { arbiterAddress: undefined }],
    ['an empty string', { arbiterAddress: '' }]
  ])('omits arbiter when arbiterAddress is %s', async (_label, override) => {
    setupHappyPathMocks();

    await executeDirectPaymentSequence({ ...baseParams, ...override }, baseOptions);

    expect('arbiter' in deployBody()).toBe(false);
  });

  it('sends the terms the escrow address was derived from', async () => {
    setupHappyPathMocks();

    await executeDirectPaymentSequence(baseParams, baseOptions);

    const body = deployBody();
    expect(body.tokenAddress).toBe(baseParams.tokenAddress);
    expect(body.buyer).toBe(baseParams.buyer);
    expect(body.seller).toBe(baseParams.seller);
    expect(body.amount).toBe(String(baseParams.amount));
    expect(body.expiryTimestamp).toBe(baseParams.expiryTimestamp);
    expect(body.contractserviceId).toBe(baseParams.contractserviceId);
    // Without this, chainservice would deploy through whichever factory it currently has
    // configured — which, after any contracts release, is not the one this address came from.
    expect(body.factoryAddress).toBe(baseOptions.factoryAddress);
  });
});

describe('executeDirectPaymentSequence - ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedFetch.mockReset();
    mockTransferToContract.mockReset();
    mockWaitForTransaction.mockReset();
  });

  /**
   * The address must be recorded before any money moves. Tokens sent to an address with no
   * code deployed trigger nothing at all, so if this browser dies after transferring but
   * before the escrow is created, the scheduled sweep is the only thing that can finish the
   * job — and it can only do that for an address it was told about.
   */
  it('records the address before transferring', async () => {
    const order: string[] = [];
    mockAuthenticatedFetch.mockImplementation(async (url: string) => {
      order.push(url);
      return { ok: true, json: jest.fn().mockResolvedValue({ success: true }) };
    });
    mockTransferToContract.mockImplementation(async () => {
      order.push('TRANSFER');
      return '0xTransferTxHash';
    });
    mockWaitForTransaction.mockResolvedValue({ blockNumber: 1, status: 1 });

    await executeDirectPaymentSequence(baseParams, baseOptions);

    const recordIndex = order.findIndex((o) => o.startsWith('/api/contracts/'));
    const transferIndex = order.indexOf('TRANSFER');
    expect(recordIndex).toBeGreaterThanOrEqual(0);
    expect(recordIndex).toBeLessThan(transferIndex);
  });

  /** Refusing to send funds somewhere nothing is tracking is the whole point of the order. */
  it('does not transfer if the address could not be recorded', async () => {
    mockAuthenticatedFetch.mockImplementation(async () => ({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: 'contractservice unavailable' })
    }));

    await expect(executeDirectPaymentSequence(baseParams, baseOptions)).rejects.toThrow();
    expect(mockTransferToContract).not.toHaveBeenCalled();
  });

  /** The escrow is created on top of the funds, so deployment comes after the transfer. */
  it('deploys the escrow only after the transfer', async () => {
    const order: string[] = [];
    mockAuthenticatedFetch.mockImplementation(async (url: string) => {
      order.push(url);
      return { ok: true, json: jest.fn().mockResolvedValue({ success: true }) };
    });
    mockTransferToContract.mockImplementation(async () => {
      order.push('TRANSFER');
      return '0xTransferTxHash';
    });
    mockWaitForTransaction.mockResolvedValue({ blockNumber: 1, status: 1 });

    await executeDirectPaymentSequence(baseParams, baseOptions);

    expect(order.indexOf('TRANSFER')).toBeLessThan(order.indexOf('/api/chain/deploy-and-activate'));
  });

  /** No escrow is deployed ahead of payment any more. */
  it('never calls create-contract', async () => {
    setupHappyPathMocks();

    await executeDirectPaymentSequence(baseParams, baseOptions);

    expect(
      mockAuthenticatedFetch.mock.calls.some((c: any[]) => c[0] === '/api/chain/create-contract')
    ).toBe(false);
  });
});
