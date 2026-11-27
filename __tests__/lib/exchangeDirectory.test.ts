/**
 * The list under "More places to buy": the card services come first, and a link carries the
 * purchase only where that has been seen to work (USDC on Base, MoonPay and Onramp.money).
 */
import { EXCHANGE_REGIONS, exchangeLink, regionOf, type Exchange } from '@/lib/exchangeDirectory';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const named = (name: string): Exchange =>
  EXCHANGE_REGIONS.flatMap((region) => region.exchanges).find((exchange) => exchange.name === name)!;
const usdcOnBase = { tokenSymbol: 'USDC', chainId: 8453, walletAddress: WALLET, amount: 99.99 };

describe('the exchange directory', () => {
  it('lists the card services first: they are the way to pay by card with no exchange account', () => {
    expect(EXCHANGE_REGIONS[0].id).toBe('card-services');
  });

  it('names every company once', () => {
    const names = EXCHANGE_REGIONS.flatMap((region) => region.exchanges).map((exchange) => exchange.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('sends a buyer to where a person buys, not to a page for businesses', () => {
    expect(named('Transak').url).toBe('https://global.transak.com');
    expect(named('Mercuryo').url).toBe('https://exchange.mercuryo.io');
    expect(named('Banxa').url).toBe('https://checkout.banxa.com');
  });

  it('opens MoonPay with USDC on Base, the wallet and the amount filled in', () => {
    const url = new URL(exchangeLink(named('MoonPay'), usdcOnBase));
    expect(`${url.origin}${url.pathname}`).toBe('https://buy.moonpay.com/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ currencyCode: 'usdc_base', walletAddress: WALLET, quoteCurrencyAmount: '99.99' });
  });

  it('opens Onramp.money with USDC on Base, the wallet and the amount filled in', () => {
    const url = new URL(exchangeLink(named('Onramp.money'), usdcOnBase));
    expect(`${url.origin}${url.pathname}`).toBe('https://onramp.money/main/buy/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ appId: '1', coinCode: 'usdc', network: 'base', walletAddress: WALLET, coinAmount: '99.99' });
  });

  it('leaves out what it does not know rather than sending it empty', () => {
    const url = new URL(exchangeLink(named('MoonPay'), { tokenSymbol: 'USDC', chainId: 8453 }));
    expect(Object.fromEntries(url.searchParams)).toEqual({ currencyCode: 'usdc_base' });
  });

  it.each([
    ['another token', { ...usdcOnBase, tokenSymbol: 'USDT' }],
    ['another network', { ...usdcOnBase, chainId: 1 }],
    ['no purchase at all', undefined],
  ])('falls back to the plain link for %s', (_, purchase) => {
    expect(exchangeLink(named('MoonPay'), purchase)).toBe('https://www.moonpay.com/buy');
    expect(exchangeLink(named('Onramp.money'), purchase)).toBe('https://onramp.money');
  });

  it('uses the plain link for a company with no filled-in form, and never puts the wallet in it', () => {
    for (const name of ['Transak', 'Banxa', 'Ramp Network', 'Coinbase']) {
      expect(exchangeLink(named(name), usdcOnBase)).toBe(named(name).url);
    }
  });
});

describe('regionOf', () => {
  it.each([
    ['GB', 'europe'],
    ['us', 'north-america'],
    ['AU', 'oceania'],
    ['MX', 'latin-america'],
    ['NG', 'africa-middle-east'],
    ['AE', 'africa-middle-east'],
    ['IN', 'asia'],
  ])('puts %s in %s', (country, region) => {
    expect(regionOf(country)).toBe(region);
  });

  it('has no region for an unknown country, or one in none of them', () => {
    expect(regionOf(null)).toBeNull();
    expect(regionOf(undefined)).toBeNull();
    expect(regionOf('AQ')).toBeNull();
  });

  // An exchange can be a local name outside its region too (Independent Reserve, listed under
  // Australia, in Singapore), so this asks only that its region is home to one of its countries.
  it('puts at least one country of every local exchange in the region the exchange is listed under', () => {
    for (const region of EXCHANGE_REGIONS) {
      if (region.id === 'worldwide' || region.id === 'card-services') continue;
      for (const exchange of region.exchanges) {
        if (!exchange.countries?.length) continue;
        expect(`${exchange.name}: ${exchange.countries.map(regionOf).includes(region.id)}`).toBe(`${exchange.name}: true`);
      }
    }
  });

  it('gives every country an exchange is a local name in, a region', () => {
    for (const exchange of EXCHANGE_REGIONS.flatMap((region) => region.exchanges)) {
      for (const country of exchange.countries ?? []) {
        expect(`${country}: ${regionOf(country) !== null}`).toBe(`${country}: true`);
      }
    }
  });

  it('lists no country under two regions', () => {
    const seen = new Map<string, string>();
    for (const country of ['GB', 'US', 'CA', 'AU', 'NZ', 'TR', 'MX', 'BR', 'ZA', 'AE', 'IN', 'SG', 'JP', 'KR']) {
      const region = regionOf(country)!;
      expect(seen.get(country) ?? region).toBe(region);
      seen.set(country, region);
    }
  });
});
