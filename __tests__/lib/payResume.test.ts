/**
 * A /pay payment carried in its URL. The external id is what makes a resume land on the SAME
 * escrow, so it must survive the round trip exactly; anything malformed is ignored.
 */

import { decodePayResume, encodePayResume, PayResume } from '@/lib/payResume';

const RESUME: PayResume = {
  seller: 'señora@example.com',
  amount: '12.50',
  expiryTimestamp: 1793500000,
  description: 'Logo design — final files',
  tokenSymbol: 'USDC',
  externalId: 'mcp-9ca9d47e-4cea-491d-acb6-2ece2a178968',
};

describe('pay resume links', () => {
  it('round-trips every term exactly, including non-ASCII text', () => {
    expect(decodePayResume(encodePayResume(RESUME))).toEqual(RESUME);
  });

  it('is safe to put in a URL without escaping', () => {
    expect(encodePayResume(RESUME)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['missing', undefined],
    ['not a string', ['a']],
    ['not base64 JSON', 'not-a-payment'],
    ['no external id', encodePayResume({ ...RESUME, externalId: '' })],
    ['an amount that is not a number', encodePayResume({ ...RESUME, amount: '1e6' })],
    ['a fractional expiry', encodePayResume({ ...RESUME, expiryTimestamp: 1.5 })],
    ['no seller', encodePayResume({ ...RESUME, seller: ' ' })],
  ])('ignores a resume that is %s', (_why, value) => {
    expect(decodePayResume(value)).toBeNull();
  });

  it('keeps only the fields it knows', () => {
    const extra = encodePayResume({ ...RESUME, signature: '0xabc' } as PayResume);
    expect(decodePayResume(extra)).toEqual(RESUME);
  });
});
