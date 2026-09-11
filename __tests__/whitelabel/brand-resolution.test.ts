/**
 * Precedence rules for which brand a visitor sees.
 *
 * This is pure so the order can be pinned without a browser. The order is the
 * whole design: a payer arriving from a link days later has no session and no
 * query parameter, and must still see the partner's branding — which only the
 * contract can tell us.
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

    it('beats a different brand held in the session', () => {
      expect(resolve({ search: '?b=cobro', stored: 'stabledrop' })).toEqual({
        id: 'cobro',
        source: 'query',
      });
    });
  });

  describe('the session', () => {
    it('carries the brand once the parameter is gone', () => {
      expect(resolve({ search: '', stored: 'cobro' })).toEqual({
        id: 'cobro',
        source: 'session',
      });
    });

    it('is ignored when it holds a brand we do not have', () => {
      expect(resolve({ stored: 'deleted-partner' })).toEqual({
        id: 'stabledrop',
        source: 'default',
      });
    });
  });

  describe('the contract', () => {
    // The case that matters: the payer opens a link days later, on another
    // device, with no session and no parameter.
    it('brands a payment page with no other signal present', () => {
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
