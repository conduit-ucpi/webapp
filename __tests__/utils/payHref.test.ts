/**
 * Where the dashboard sends a buyer to pay. /contract-pay cannot pay an escrow put on file by
 * ap2service (buyer fixed, other seed), so contractservice supplies a /pay link for those.
 */
import { payHref } from '@/utils/payHref';
import { transformCombinedContractItem } from '@/hooks/useCombinedContracts';

const branded = (href: string) => `${href}${href.includes('?') ? '&' : '?'}b=escrow-me`;

describe('payHref', () => {
  it("follows contractservice's /pay link by path and query, so a partner keeps its domain", () => {
    expect(payHref({ id: 'c1', payLink: 'https://stabledrop.me/pay?resume=abc&b=escrow-me' }, branded)).toBe(
      '/pay?resume=abc&b=escrow-me'
    );
  });

  it('uses /contract-pay for everything else', () => {
    expect(payHref({ id: 'c1' }, branded)).toBe('/contract-pay?contractId=c1&b=escrow-me');
    expect(payHref({ id: 'c1', payLink: null }, branded)).toBe('/contract-pay?contractId=c1&b=escrow-me');
  });

  it('ignores a malformed link rather than following it', () => {
    expect(payHref({ id: 'c1', payLink: 'not a url' }, branded)).toBe('/contract-pay?contractId=c1&b=escrow-me');
  });

  it('has nowhere to go with neither', () => {
    expect(payHref({}, branded)).toBeNull();
  });
});

describe('the dashboard rows', () => {
  it('carry the pay link through, reserved address and all', () => {
    const row = transformCombinedContractItem({
      contract: { id: 'c1', chainAddress: '0x8b18', sellerAddress: '0xs', amount: 1000000, description: 'd' },
      status: 'AWAITING_FUNDING',
      ctaType: 'ACCEPT_CONTRACT',
      payLink: 'https://stabledrop.me/pay?resume=abc',
      discrepancies: {},
    });
    expect(row?.payLink).toBe('https://stabledrop.me/pay?resume=abc');
  });
});
