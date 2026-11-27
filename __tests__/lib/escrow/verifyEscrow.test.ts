/**
 * The combined gate. These tests exist mostly to pin the ordering and the
 * fail-closed behaviour: each part is defeatable alone, so none may be
 * skipped, and terms must never be read from a contract whose code and factory
 * have not been established as ours.
 */
import { verifyEscrow } from '@/lib/escrow/verifyEscrow';

const IMPL = '0x1234567890abcdef1234567890abcdef12345678';
const FACTORY = '0x95b1d60fdafd727378ef2c16108351b619f8f5e5';
const ROGUE_FACTORY = '0xdddddddddddddddddddddddddddddddddddddddd';
const ADDR = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const BUYER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SELLER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const ATTACKER = '0xcccccccccccccccccccccccccccccccccccccccc';

const cloneOf = (impl: string) =>
  `0x363d3d373d3d3d363d73${impl.replace(/^0x/, '')}5af43d82803e903d91602b57fd5bf3`;

const expected = { buyer: BUYER, seller: SELLER, amount: '5000000', token: TOKEN };
const goodTerms = { buyer: BUYER, seller: SELLER, amount: BigInt(5000000), token: TOKEN };

const readerWith = (code: string, terms: any, factory: string = FACTORY) => ({
  getCode: jest.fn().mockResolvedValue(code),
  getEscrowFactory: jest.fn().mockResolvedValue(factory),
  getEscrowTerms: jest.fn().mockResolvedValue(terms),
});

beforeAll(() => {
  process.env.NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS = IMPL;
  process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS = FACTORY;
});

describe('verifyEscrow', () => {
  it('passes when the code is ours and the terms match', async () => {
    const r = readerWith(cloneOf(IMPL), goodTerms);
    await expect(verifyEscrow(ADDR, expected, r)).resolves.toEqual({ ok: true });
  });

  it('rejects a genuine clone carrying a swapped seller', async () => {
    // The attack bytecode verification alone cannot see.
    const r = readerWith(cloneOf(IMPL), { ...goodTerms, seller: ATTACKER });
    const v = await verifyEscrow(ADDR, expected, r);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error('unreachable');
    expect(v.stage).toBe('terms');
    expect(v.detail).toContain(ATTACKER);
  });

  it('rejects correct terms on a contract that is not ours', async () => {
    // The attack terms verification alone cannot see.
    const r = readerWith(cloneOf(ATTACKER), goodTerms);
    const v = await verifyEscrow(ADDR, expected, r);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.stage).toBe('bytecode');
  });

  it('does not read terms from a contract that failed bytecode verification', async () => {
    const r = readerWith('0x', goodTerms);
    const v = await verifyEscrow(ADDR, expected, r);
    expect(v.ok).toBe(false);
    expect(r.getEscrowTerms).not.toHaveBeenCalled();
  });

  it('fails closed when the terms read throws', async () => {
    const r = {
      getCode: jest.fn().mockResolvedValue(cloneOf(IMPL)),
      getEscrowFactory: jest.fn().mockResolvedValue(FACTORY),
      getEscrowTerms: jest.fn().mockRejectedValue(new Error('rpc down')),
    };
    const v = await verifyEscrow(ADDR, expected, r);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.stage).toBe('terms');
      expect(v.detail).toContain('Refusing to proceed');
    }
  });

  // ── the factory: a genuine clone, initialized by someone else's contract ──────────

  it('rejects a genuine clone with the right terms that another factory created', async () => {
    // The attack bytecode and terms together cannot see: someone's own factory clones our
    // implementation and initializes it with the user's terms plus a partner and fee our
    // signer never approved.
    const r = readerWith(cloneOf(IMPL), goodTerms, ROGUE_FACTORY);
    const v = await verifyEscrow(ADDR, expected, r);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error('unreachable');
    expect(v.stage).toBe('factory');
    expect(v.detail).toContain(ROGUE_FACTORY);
    expect(r.getEscrowTerms).not.toHaveBeenCalled();
  });

  it('accepts our factory however it is capitalised', async () => {
    const r = readerWith(cloneOf(IMPL), goodTerms, '0x95B1d60FdaFd727378EF2c16108351b619F8F5e5');
    await expect(verifyEscrow(ADDR, expected, r)).resolves.toEqual({ ok: true });
  });

  it('fails closed when FACTORY() cannot be read', async () => {
    const r = {
      getCode: jest.fn().mockResolvedValue(cloneOf(IMPL)),
      getEscrowFactory: jest.fn().mockRejectedValue(new Error('rpc down')),
      getEscrowTerms: jest.fn().mockResolvedValue(goodTerms),
    };
    const v = await verifyEscrow(ADDR, expected, r);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.stage).toBe('factory');
  });

  it('refuses when no factory is pinned in this build, rather than trusting any', async () => {
    const saved = process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS;
    delete process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS;
    try {
      const v = await verifyEscrow(ADDR, expected, readerWith(cloneOf(IMPL), goodTerms));
      expect(v.ok).toBe(false);
      if (!v.ok) {
        expect(v.stage).toBe('factory');
        expect(v.detail).toContain('NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS');
      }
    } finally {
      process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS = saved;
    }
  });

  it('refuses when no build-time RPC is configured, rather than falling back', async () => {
    // The fallback that must never exist: using the application's RPC, whose
    // endpoint the API supplies, would make verification circular again.
    const { __resetVerificationReader } = require('@/lib/escrow/verificationRpc');
    const saved = process.env.NEXT_PUBLIC_RPC_URL;
    delete process.env.NEXT_PUBLIC_RPC_URL;
    __resetVerificationReader();
    try {
      const v = await verifyEscrow(ADDR, expected);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.detail).toContain('NEXT_PUBLIC_RPC_URL');
    } finally {
      if (saved !== undefined) process.env.NEXT_PUBLIC_RPC_URL = saved;
      __resetVerificationReader();
    }
  });
});
