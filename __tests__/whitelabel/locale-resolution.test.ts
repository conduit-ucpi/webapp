/**
 * Which language a visitor gets.
 *
 * Pure, so the order is pinned without a browser. The brand deliberately
 * outranks the visitor's browser: a partner serving Venezuela sets locale 'es'
 * because that is their market, and someone with an English-configured laptop
 * should still land on the partner's language. `?lang=` is the escape hatch.
 */

import { resolveLocale } from '@conduit-ucpi/whitelabel-sdk';

describe('locale resolution', () => {
  describe('the query parameter', () => {
    it('wins over everything else', () => {
      expect(
        resolveLocale({ search: '?lang=en', brandLocale: 'es', navigatorLocales: ['es-VE'] })
      ).toEqual({ locale: 'en', source: 'query' });
    });

    it('accepts the ?locale= spelling', () => {
      expect(resolveLocale({ search: '?locale=es' })).toEqual({ locale: 'es', source: 'query' });
    });

    it('is ignored when it names a language we do not ship', () => {
      expect(resolveLocale({ search: '?lang=fr', brandLocale: 'es' })).toEqual({
        locale: 'es',
        source: 'brand',
      });
    });
  });

  describe('the brand', () => {
    it('sets the language for a partner with no parameter present', () => {
      expect(resolveLocale({ brandLocale: 'es' })).toEqual({ locale: 'es', source: 'brand' });
    });

    it("outranks the visitor's browser", () => {
      expect(resolveLocale({ brandLocale: 'es', navigatorLocales: ['en-GB'] })).toEqual({
        locale: 'es',
        source: 'brand',
      });
    });
  });

  describe('the browser', () => {
    it('is used when the brand names no locale', () => {
      expect(resolveLocale({ navigatorLocales: ['es-VE', 'en'] })).toEqual({
        locale: 'es',
        source: 'navigator',
      });
    });

    it('skips languages we do not ship and takes the next it can', () => {
      expect(resolveLocale({ navigatorLocales: ['fr-FR', 'de', 'es'] })).toEqual({
        locale: 'es',
        source: 'navigator',
      });
    });
  });

  describe('regional tags', () => {
    // One Spanish catalogue serves all of them. Rejecting 'es-VE' for not being
    // exactly 'es' would be a bug, not strictness.
    it.each(['es-VE', 'es-419', 'es_MX', 'ES'])('%s resolves to Spanish', (tag) => {
      expect(resolveLocale({ brandLocale: tag }).locale).toBe('es');
    });
  });

  it('falls back to English when nothing matches', () => {
    expect(resolveLocale({ navigatorLocales: ['fr-FR'] })).toEqual({
      locale: 'en',
      source: 'default',
    });
    expect(resolveLocale({})).toEqual({ locale: 'en', source: 'default' });
  });
});
