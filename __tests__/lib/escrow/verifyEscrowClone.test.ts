/**
 * The bytecode template here must match what the chain actually deploys. If it
 * drifts, every escrow fails verification (loud, safe) — or worse, a wrong
 * template accepts something it should not (silent, unsafe). So the template is
 * asserted against the literal OfferVaultFactory.sol uses on-chain.
 */
import {
  expectedCloneRuntime,
  verifyCloneBytecode,
  assertVerifiableAddress,
  CLONE_RUNTIME_BYTES,
} from '@/lib/escrow/verifyEscrowClone';

const IMPL = '0x1234567890AbcdEF1234567890aBcdef12345678';
const OTHER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

const cloneOf = (impl: string) =>
  `0x363d3d373d3d3d363d73${impl.replace(/^0x/, '').toLowerCase()}5af43d82803e903d91602b57fd5bf3`;

describe('expectedCloneRuntime', () => {
  it('matches the ERC-1167 template OfferVaultFactory.sol embeds on-chain', () => {
    // hex"363d3d373d3d3d363d73" + implementation + hex"5af43d82803e903d91602b57fd5bf3"
    expect(expectedCloneRuntime(IMPL)).toBe(cloneOf(IMPL));
  });

  it('is 45 bytes: 10 prefix + 20 address + 15 suffix', () => {
    const hex = expectedCloneRuntime(IMPL).slice(2);
    expect(hex.length / 2).toBe(CLONE_RUNTIME_BYTES);
    expect(CLONE_RUNTIME_BYTES).toBe(45);
  });

  it('lowercases the implementation so comparison is checksum-insensitive', () => {
    expect(expectedCloneRuntime(IMPL)).toBe(expectedCloneRuntime(IMPL.toLowerCase()));
  });

  it('refuses a non-address', () => {
    expect(() => expectedCloneRuntime('0xnope')).toThrow();
  });
});

describe('verifyCloneBytecode', () => {
  it('accepts a genuine clone of the expected implementation', () => {
    expect(verifyCloneBytecode(cloneOf(IMPL), IMPL)).toEqual({
      ok: true,
      implementation: IMPL.toLowerCase(),
    });
  });

  it('accepts regardless of hex casing from the RPC provider', () => {
    expect(verifyCloneBytecode(cloneOf(IMPL).toUpperCase().replace('0X', '0x'), IMPL).ok).toBe(true);
  });

  it('rejects a clone of a DIFFERENT implementation, naming what it found', () => {
    const v = verifyCloneBytecode(cloneOf(OTHER), IMPL);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error('unreachable');
    expect(v.reason).toBe('wrong-implementation');
    // The attacker's implementation must appear in the message — that is the
    // whole point of distinguishing this case.
    expect(v.detail).toContain(OTHER);
    expect(v.detail).toContain(IMPL.toLowerCase());
  });

  it('rejects an address with no code (EOA or undeployed)', () => {
    for (const empty of ['0x', '', null, undefined]) {
      const v = verifyCloneBytecode(empty, IMPL);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe('not-a-contract');
    }
  });

  it('rejects an unrelated contract', () => {
    const v = verifyCloneBytecode('0x608060405234801561001057600080fd5b50', IMPL);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('not-a-minimal-proxy');
  });

  it('rejects a proxy with trailing bytes appended', () => {
    const v = verifyCloneBytecode(cloneOf(IMPL) + 'ff', IMPL);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('not-a-minimal-proxy');
  });

  it('rejects truncated bytecode', () => {
    const v = verifyCloneBytecode(cloneOf(IMPL).slice(0, -4), IMPL);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('not-a-minimal-proxy');
  });

  it('refuses to pass when no implementation is baked into the build', () => {
    for (const missing of ['', null, undefined, 'not-an-address']) {
      const v = verifyCloneBytecode(cloneOf(IMPL), missing);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe('no-expected-implementation');
    }
  });

  it('fails closed: a correct clone still fails without a known-good implementation', () => {
    // Guards the most dangerous regression — treating "cannot verify" as "verified".
    expect(verifyCloneBytecode(cloneOf(IMPL), undefined).ok).toBe(false);
  });
});

describe('assertVerifiableAddress', () => {
  it('passes a well-formed address', () => {
    expect(assertVerifiableAddress(IMPL)).toBeNull();
  });

  it('rejects malformed input', () => {
    for (const bad of ['', '0x', '0x123', 'nonsense', IMPL + 'ff']) {
      const v = assertVerifiableAddress(bad);
      expect(v).not.toBeNull();
      expect(v!.ok).toBe(false);
      if (v && !v.ok) expect(v.reason).toBe('malformed-address');
    }
  });
});

describe('verifyEscrowAddress (fetches from chain, fails closed)', () => {
  const { verifyEscrowAddress } = require('@/lib/escrow/verifyEscrowClone');

  it('accepts a genuine clone read from the chain', async () => {
    const rpc = { getCode: jest.fn().mockResolvedValue(cloneOf(IMPL)) };
    await expect(verifyEscrowAddress(IMPL, rpc, IMPL)).resolves.toEqual({
      ok: true,
      implementation: IMPL.toLowerCase(),
    });
    expect(rpc.getCode).toHaveBeenCalledWith(IMPL);
  });

  it('rejects when the chain shows a different implementation', async () => {
    const rpc = { getCode: jest.fn().mockResolvedValue(cloneOf(OTHER)) };
    const v = await verifyEscrowAddress(IMPL, rpc, IMPL);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('wrong-implementation');
  });

  it('fails closed when the RPC call throws — never treats an error as a pass', async () => {
    const rpc = { getCode: jest.fn().mockRejectedValue(new Error('network down')) };
    const v = await verifyEscrowAddress(IMPL, rpc, IMPL);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain('Refusing to proceed');
  });

  it('does not call the chain at all for a malformed address', async () => {
    const rpc = { getCode: jest.fn() };
    const v = await verifyEscrowAddress('0xnope', rpc, IMPL);
    expect(v.ok).toBe(false);
    expect(rpc.getCode).not.toHaveBeenCalled();
  });
});
