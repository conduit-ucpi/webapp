/**
 * A quoted escrow address is checked against the factory this build pins, and the authorization
 * a payer signs must pay that escrow. Both fail closed.
 */
import { verifyAuthorizationTarget, verifyQuotedEscrowAddress } from '@/lib/escrow/verifyQuotedEscrow';

const FACTORY = '0x95B1d60FdaFd727378EF2c16108351b619F8F5e5';
const ESCROW = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAYER = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A';

const terms = {
  token: USDC,
  buyer: PAYER,
  seller: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
  amount: '10000000',
  expiryTimestamp: 1_900_000_000,
  arbiter: '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C',
  externalId: '0x' + 'ef'.repeat(32),
};
const factorySays = (answer: string | Error) => ({
  predictEscrowAddress: jest.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  }),
});

describe('verifyQuotedEscrowAddress', () => {
  it('passes when the pinned factory gives the quoted address, whatever its case', async () => {
    const reader = factorySays(ESCROW.toLowerCase());
    await expect(verifyQuotedEscrowAddress(ESCROW, terms, reader, FACTORY)).resolves.toEqual({ ok: true });
    expect(reader.predictEscrowAddress).toHaveBeenCalledWith(FACTORY, {
      ...terms,
      amount: BigInt(10_000_000),
      expiryTimestamp: BigInt(1_900_000_000),
    });
  });

  it('refuses an address the factory does not give', async () => {
    const v = await verifyQuotedEscrowAddress(ESCROW, terms, factorySays('0x000000000000000000000000000000000000dEaD'), FACTORY);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.detail).toMatch(/Do not send funds/);
  });

  it('refuses with no pinned factory, rather than asking any factory the API names', async () => {
    const reader = factorySays(ESCROW);
    const v = await verifyQuotedEscrowAddress(ESCROW, terms, reader, '');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.detail).toContain('NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS');
    expect(reader.predictEscrowAddress).not.toHaveBeenCalled();
  });

  it('refuses with no pinned RPC', async () => {
    const v = await verifyQuotedEscrowAddress(ESCROW, terms, null, FACTORY);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.detail).toContain('NEXT_PUBLIC_RPC_URL');
  });

  it.each([
    ['seller', { seller: undefined }],
    ['arbiter', { arbiter: undefined }],
    ['externalId', { externalId: 'mcp-123' }],
    ['amount', { amount: '10.5' }],
    ['expiry', { expiryTimestamp: -1 }],
  ])('refuses when the %s is not known', async (_name, change) => {
    const reader = factorySays(ESCROW);
    const v = await verifyQuotedEscrowAddress(ESCROW, { ...terms, ...change }, reader, FACTORY);
    expect(v.ok).toBe(false);
    expect(reader.predictEscrowAddress).not.toHaveBeenCalled();
  });

  it('refuses when the factory cannot be asked', async () => {
    const v = await verifyQuotedEscrowAddress(ESCROW, terms, factorySays(new Error('rpc down')), FACTORY);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.detail).toContain('rpc down');
  });
});

describe('verifyAuthorizationTarget', () => {
  const typed = (message: Record<string, unknown> = {}, domain: Record<string, unknown> = {}) => ({
    domain: { verifyingContract: USDC, ...domain },
    message: { from: PAYER, to: ESCROW, value: '10000000', ...message },
  });
  const expected = { escrow: ESCROW, token: USDC, amount: BigInt(10_000_000), payer: PAYER };

  it('passes an authorization paying the checked escrow exactly', () => {
    expect(verifyAuthorizationTarget(typed(), expected)).toEqual({ ok: true });
  });

  it.each([
    ['a different address', typed({ to: '0x000000000000000000000000000000000000dEaD' }), 'pays a different address'],
    ['a different amount', typed({ value: '10000001' }), 'different amount'],
    ['a different token', typed({}, { verifyingContract: '0x000000000000000000000000000000000000dEaD' }), 'different token'],
    ['a different wallet', typed({ from: '0x000000000000000000000000000000000000dEaD' }), 'different wallet'],
  ])('refuses one paying %s', (_name, data, says) => {
    const v = verifyAuthorizationTarget(data, expected);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.detail).toContain(says);
  });

  it('refuses when there is no typed data at all', () => {
    expect(verifyAuthorizationTarget(undefined, expected).ok).toBe(false);
  });
});
