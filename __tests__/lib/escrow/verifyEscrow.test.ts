/**
 * The combined gate. These tests exist mostly to pin the ordering and the
 * fail-closed behaviour: each half is defeatable alone, so neither may be
 * skipped, and terms must never be read from a contract whose code has not been
 * established as ours.
 */
import { verifyEscrow } from '@/lib/escrow/verifyEscrow';

const IMPL = '0x1234567890abcdef1234567890abcdef12345678';
const ADDR = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const BUYER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SELLER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const ATTACKER = '0xcccccccccccccccccccccccccccccccccccccccc';

const cloneOf = (impl: string) =>
  `0x363d3d373d3d3d363d73${impl.replace(/^0x/, '')}5af43d82803e903d91602b57fd5bf3`;

const expected = { buyer: BUYER, seller: SELLER, amount: '5000000', token: TOKEN };
const goodTerms = { buyer: BUYER, seller: SELLER, amount: BigInt(5000000), token: TOKEN };

const readerWith = (code: string, terms: any) => ({
  getCode: jest.fn().mockResolvedValue(code),
  getEscrowTerms: jest.fn().mockResolvedValue(terms),
});

beforeAll(() => {
  process.env.NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS = IMPL;
});

describe('verifyEscrow', () => {
  it('passes when the code is ours and the terms match', async () => {
    const r = readerWith(cloneOf(IMPL), goodTerms);
    await expect(verifyEscrow(ADDR, r, expected)).resolves.toEqual({ ok: true });
  });

  it('rejects a genuine clone carrying a swapped seller', async () => {
    // The attack bytecode verification alone cannot see.
    const r = readerWith(cloneOf(IMPL), { ...goodTerms, seller: ATTACKER });
    const v = await verifyEscrow(ADDR, r, expected);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error('unreachable');
    expect(v.stage).toBe('terms');
    expect(v.detail).toContain(ATTACKER);
  });

  it('rejects correct terms on a contract that is not ours', async () => {
    // The attack terms verification alone cannot see.
    const r = readerWith(cloneOf(ATTACKER), goodTerms);
    const v = await verifyEscrow(ADDR, r, expected);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.stage).toBe('bytecode');
  });

  it('does not read terms from a contract that failed bytecode verification', async () => {
    const r = readerWith('0x', goodTerms);
    const v = await verifyEscrow(ADDR, r, expected);
    expect(v.ok).toBe(false);
    expect(r.getEscrowTerms).not.toHaveBeenCalled();
  });

  it('fails closed when the terms read throws', async () => {
    const r = {
      getCode: jest.fn().mockResolvedValue(cloneOf(IMPL)),
      getEscrowTerms: jest.fn().mockRejectedValue(new Error('rpc down')),
    };
    const v = await verifyEscrow(ADDR, r, expected);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.stage).toBe('terms');
      expect(v.detail).toContain('Refusing to proceed');
    }
  });
});
