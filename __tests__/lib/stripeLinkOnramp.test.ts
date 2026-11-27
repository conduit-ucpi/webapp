/**
 * Stripe's Link purchase page: only for what it delivers, asked for in tokens. It takes no wallet
 * address, so none is put in its address.
 */
import { linkDelivers, linkOnrampUrl } from '@/lib/stripeLinkOnramp';

describe('linkDelivers', () => {
  it.each([
    ['USDC', 8453, true],
    ['usdc', 8453, true],
    ['USDT', 8453, false],
    ['USDC', 1, false],
    ['USDC', undefined, false],
  ])('%s on chain %s: %s', (token, chain, expected) => {
    expect(linkDelivers(token as string, chain as number | undefined)).toBe(expected);
  });
});

describe('linkOnrampUrl', () => {
  it('fills in the token, network and token amount, and nothing else', () => {
    const url = new URL(linkOnrampUrl({ tokenSymbol: 'USDC', chainId: 8453, amount: 32.4 })!);
    expect(`${url.origin}${url.pathname}`).toBe('https://crypto.link.com/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      destination_currency: 'usdc',
      destination_network: 'base',
      destination_amount: '32.4',
    });
  });

  it('has no address for a token or chain Link does not deliver', () => {
    expect(linkOnrampUrl({ tokenSymbol: 'USDT', chainId: 8453, amount: 20 })).toBeNull();
    expect(linkOnrampUrl({ tokenSymbol: 'USDC', chainId: 1, amount: 20 })).toBeNull();
  });
});
