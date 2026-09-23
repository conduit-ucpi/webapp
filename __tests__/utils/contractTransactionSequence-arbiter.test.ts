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

import { predictEscrowAddress } from '@/lib/counterfactualAddress';
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

describe('executeDirectPaymentSequence - funding hash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedFetch.mockReset();
    mockTransferToContract.mockReset();
    mockWaitForTransaction.mockReset();
  });

  /**
   * ⚠️ SEEN IN PRODUCTION. The transfer confirmed in this browser, chainservice read the escrow
   * balance through a different RPC node a moment later, saw 0, and answered "Address holds 0
   * of the 1000 required". Chainservice waits for the funding receipt and retries the read —
   * but only when it is told which transaction to wait for.
   */
  it('names the transfer so chainservice waits for it instead of reading a stale balance', async () => {
    setupHappyPathMocks();

    await executeDirectPaymentSequence(baseParams, baseOptions);

    expect(deployBody().fundingTxHash).toBe('0xTransferTxHash');
  });

  it('omits the hash when there was no transfer to wait for', async () => {
    setupHappyPathMocks();
    mockTransferToContract.mockResolvedValue(null);

    await executeDirectPaymentSequence(baseParams, baseOptions);

    expect('fundingTxHash' in deployBody()).toBe(false);
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

describe('a prepared address that does not match the terms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedFetch.mockReset();
    mockTransferToContract.mockReset();
    mockWaitForTransaction.mockReset();
    setupHappyPathMocks();
  });

  /**
   * ⚠️ THE FAILURE THIS CAUSED, AND WHY IT LOOKED LIKE SOMETHING ELSE. The page seeds its
   *    prepared address from the contract's RECORDED chainAddress, derived from whatever the
   *    terms were when it was recorded — not necessarily what is being paid now. Trusting it
   *    sent the transfer to one address while the deploy targeted another, and the activation
   *    reported "Address holds 0 of the 1000 required" from a perfectly funded wallet. The
   *    money had landed; it simply was not where we then looked.
   *
   *    Deriving is a pure function and free, so it always happens. A prepared value saves the
   *    recording round trip and nothing else.
   */
  const STALE = '0x000000000000000000000000000000000000dEaD';

  it('pays the address the terms derive to, never the stale one', async () => {
    await executeDirectPaymentSequence(baseParams, { ...baseOptions, preparedAddress: STALE });

    const paidTo = (mockTransferToContract.mock.calls[0] as any[])[1] as string;
    expect(paidTo.toLowerCase()).not.toBe(STALE.toLowerCase());
    // The deploy looks where the money went.
    expect(paidTo.toLowerCase()).toBe(String(deployBodyAddress()).toLowerCase());
  });

  it('records the derived address, so the sweep can still find the funds', async () => {
    await executeDirectPaymentSequence(baseParams, { ...baseOptions, preparedAddress: STALE });

    const patch = mockAuthenticatedFetch.mock.calls.find((c: any[]) => c[1]?.method === 'PATCH');
    expect(patch).toBeDefined();
    const paidTo = (mockTransferToContract.mock.calls[0] as any[])[1] as string;
    expect(JSON.parse(patch![1].body).chainAddress.toLowerCase()).toBe(paidTo.toLowerCase());
  });

  it('skips the recording round trip when it DOES match', async () => {
    // First run derives and records, so we learn the correct address.
    await executeDirectPaymentSequence(baseParams, baseOptions);
    const correct = (mockTransferToContract.mock.calls[0] as any[])[1] as string;

    jest.clearAllMocks();
    setupHappyPathMocks();
    await executeDirectPaymentSequence(baseParams, { ...baseOptions, preparedAddress: correct });

    // The whole point of preparing early: no PATCH between the click and the wallet.
    expect(mockAuthenticatedFetch.mock.calls.some((c: any[]) => c[1]?.method === 'PATCH')).toBe(false);
    expect((mockTransferToContract.mock.calls[0] as any[])[1]).toBe(correct);
  });
});

function deployBodyAddress(): string {
  // The deploy names its terms rather than an address; re-derive from what it sent.
  const body = deployBody();
  return predictEscrowAddress(baseOptions.factoryAddress, baseOptions.implementationAddress, {
    tokenAddress: body.tokenAddress,
    buyer: body.buyer,
    seller: body.seller,
    amount: Number(body.amount),
    expiryTimestamp: body.expiryTimestamp,
    arbiter: body.arbiter || baseOptions.defaultArbiterAddress,
    contractserviceId: body.contractserviceId
  });
}
