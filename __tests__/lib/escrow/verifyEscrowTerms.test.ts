import { verifyEscrowTerms, ExpectedTerms, OnChainTerms } from '@/lib/escrow/verifyEscrowTerms';

const BUYER = '0xAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaa';
const SELLER = '0xBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbbBBbb';
const TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
const ATTACKER = '0xCCccCCccCCccCCccCCccCCccCCccCCccCCccCCcc';

const expected: ExpectedTerms = { buyer: BUYER, seller: SELLER, amount: '5000000', token: TOKEN };
const onChain: OnChainTerms = {
  buyer: BUYER.toLowerCase(),
  seller: SELLER.toLowerCase(),
  amount: BigInt(5000000),
  token: TOKEN.toLowerCase(),
};

describe('verifyEscrowTerms', () => {
  it('accepts terms that match', () => {
    expect(verifyEscrowTerms(expected, onChain)).toEqual({ ok: true });
  });

  it('ignores address checksum casing', () => {
    expect(
      verifyEscrowTerms(expected, { ...onChain, seller: SELLER.toUpperCase().replace('0X', '0x') })
    ).toEqual({ ok: true });
  });

  it('accepts the amount as string, number or bigint', () => {
    for (const amount of ['5000000', 5000000, BigInt(5000000)]) {
      expect(verifyEscrowTerms({ ...expected, amount }, onChain).ok).toBe(true);
    }
  });

  // The attack this exists to stop: a genuine clone, wrong payee.
  it('rejects a swapped seller', () => {
    const v = verifyEscrowTerms(expected, { ...onChain, seller: ATTACKER });
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error('unreachable');
    expect(v.mismatched).toEqual(['seller']);
    expect(v.detail).toContain(ATTACKER);
  });

  it('rejects an inflated amount', () => {
    const v = verifyEscrowTerms(expected, { ...onChain, amount: BigInt(50000000) });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.mismatched).toEqual(['amount']);
  });

  it('rejects a substituted token', () => {
    const v = verifyEscrowTerms(expected, { ...onChain, token: ATTACKER });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.mismatched).toEqual(['token']);
  });

  it('rejects a swapped buyer', () => {
    const v = verifyEscrowTerms(expected, { ...onChain, buyer: ATTACKER });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.mismatched).toEqual(['buyer']);
  });

  it('reports every mismatched field, not just the first', () => {
    const v = verifyEscrowTerms(expected, {
      buyer: ATTACKER, seller: ATTACKER, amount: BigInt(1), token: ATTACKER,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.mismatched.sort()).toEqual(['amount', 'buyer', 'seller', 'token']);
  });

  it('is exact: one base unit off is a mismatch', () => {
    expect(verifyEscrowTerms(expected, { ...onChain, amount: BigInt(4999999) }).ok).toBe(false);
    expect(verifyEscrowTerms(expected, { ...onChain, amount: BigInt(5000001) }).ok).toBe(false);
  });

  // Fails closed rather than coercing something it cannot compare.
  it('refuses an amount it cannot interpret as an integer', () => {
    for (const amount of ['', '5.5', 'abc', '5e6', NaN, 5.5, '0x10']) {
      const v = verifyEscrowTerms({ ...expected, amount: amount as any }, onChain);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.mismatched).toContain('amount');
    }
  });

  it('refuses missing or malformed addresses rather than passing them', () => {
    for (const bad of [undefined, null, '', 123]) {
      expect(verifyEscrowTerms({ ...expected, seller: bad as any }, onChain).ok).toBe(false);
    }
  });
});
