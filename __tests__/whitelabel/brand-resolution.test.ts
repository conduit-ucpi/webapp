/**
 * Precedence rules for which brand a visitor sees.
 *
 * This is pure so the order can be pinned without a browser.
 *
 * The URL is authoritative and nothing is persisted, so a clean URL always
 * means our own brand. The contract outranks the URL because a payer arriving
 * from a link days later has nothing else to go on, and because it is the one
 * signal a visitor cannot forge.
 */

import { resolveBrandId, BrandRegistry } from '@conduit-ucpi/whitelabel-sdk';

const registry = {
  stabledrop: { id: 'stabledrop', name: 'Stabledrop.me' },
  cobro: { id: 'cobro', name: 'COBRO' },
} as unknown as BrandRegistry;

const resolve = (input: Partial<Parameters<typeof resolveBrandId>[0]>) =>
  resolveBrandId({ registry, fallbackId: 'stabledrop', ...input });

describe('brand resolution', () => {
  describe('the query parameter', () => {
    it('selects a partner brand', () => {
      expect(resolve({ search: '?b=cobro' })).toEqual({ id: 'cobro', source: 'query' });
    });

    it('accepts the long ?brand= spelling', () => {
      expect(resolve({ search: '?brand=cobro' })).toEqual({ id: 'cobro', source: 'query' });
    });

    it('survives other parameters around it', () => {
      expect(resolve({ search: '?utm_source=x&b=cobro&amount=40' }).id).toBe('cobro');
    });

    it('is case- and whitespace-insensitive', () => {
      expect(resolve({ search: '?b=%20CoBrO%20' }).id).toBe('cobro');
    });

  });

  describe('a clean URL', () => {
    // The regression this guards: the brand used to be held in sessionStorage,
    // so reloading a bare /create kept showing the last partner until the tab
    // was closed. Nothing persists now — no parameter means our own brand.
    it('always means the default brand, whatever was shown before', () => {
      expect(resolve({ search: '' })).toEqual({ id: 'stabledrop', source: 'default' });
      expect(resolve({ search: '?amount=40&tokenSymbol=USDC' })).toEqual({
        id: 'stabledrop',
        source: 'default',
      });
    });
  });

  describe('the contract', () => {
    // The case that matters: the payer opens a link days later, on another
    // device, with no session and no parameter.
    it('brands a payment page with no parameter present', () => {
      expect(resolve({ contractBrandId: 'cobro' })).toEqual({
        id: 'cobro',
        source: 'contract',
      });
    });

    it('outranks the URL, which a visitor can edit', () => {
      expect(resolve({ search: '?b=stabledrop', contractBrandId: 'cobro' })).toEqual({
        id: 'cobro',
        source: 'contract',
      });
    });
  });

  describe('unknown ids', () => {
    // The registry is the allowlist. Anyone can put anything in a query string,
    // so an id we do not hold must fall all the way back rather than produce a
    // half-branded page.
    it('fall back to the default rather than rendering a partial brand', () => {
      expect(resolve({ search: '?b=not-a-partner' })).toEqual({
        id: 'stabledrop',
        source: 'default',
      });
    });

    it('do not leak through as a contract id either', () => {
      expect(resolve({ contractBrandId: 'not-a-partner' }).id).toBe('stabledrop');
    });
  });

  it('defaults when nothing is supplied', () => {
    expect(resolve({})).toEqual({ id: 'stabledrop', source: 'default' });
  });
});
