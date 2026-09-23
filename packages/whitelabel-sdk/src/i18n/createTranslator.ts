import { useCallback } from 'react';
import { DEFAULT_LOCALE, Locale } from './resolveLocale';
import { useLocale } from './I18nProvider';
import { interpolate } from './interpolate';

/**
 * A translator for strings the SDK does not own.
 *
 * The SDK's own catalogue covers the product surfaces it ships — the wizard,
 * the dashboard, the payer pages. It deliberately does not cover copy that
 * belongs to whoever is hosting it: a landing page's pitch, a partner's
 * white-labelled banner. Those strings change per deployment, and folding them
 * into the SDK catalogue would mean every tenant inheriting every other
 * tenant's marketing copy.
 *
 * So the host keeps its own catalogue and gets its own hook from here. Both
 * read the same resolved locale, so there is still exactly one answer to "what
 * language is this page in" — see I18nProvider, which resolves it.
 *
 * Usage, in the host:
 *
 *     const en = { 'hero.title': 'Get paid safely' } as const;
 *     const es: PageCatalogue<typeof en> = { 'hero.title': 'Cobra seguro' };
 *     export const usePageT = createTranslator({ en, es });
 *
 * Typing `es` as PageCatalogue<typeof en> is what makes a missing translation a
 * compile error instead of a string that quietly renders in English.
 */

/** The same keys as the source catalogue, all of them required. */
export type PageCatalogue<Source extends Record<string, string>> = Record<
  keyof Source,
  string
>;

export type PageTranslateFn<Source extends Record<string, string>> = (
  key: keyof Source,
  vars?: Record<string, string | number>
) => string;

export interface TranslatorCatalogues<Source extends Record<string, string>> {
  /** The source language. Required — it is what everything falls back to. */
  en: Source;
  es?: PageCatalogue<Source>;
}

export function createTranslator<Source extends Record<string, string>>(
  catalogues: TranslatorCatalogues<Source>
): () => PageTranslateFn<Source> {
  const byLocale: Partial<Record<Locale, PageCatalogue<Source>>> = {
    en: catalogues.en,
    ...(catalogues.es ? { es: catalogues.es } : {}),
  };

  return function usePageTranslation(): PageTranslateFn<Source> {
    const locale = useLocale();

    return useCallback(
      (key, vars) => {
        // Falling back through English to the key itself, for the same reason
        // useT() does: an untranslated string is a smaller failure than a blank
        // or a raw key shown to a customer.
        const template =
          byLocale[locale]?.[key] ?? byLocale[DEFAULT_LOCALE]?.[key] ?? String(key);
        return interpolate(template, vars);
      },
      [locale]
    );
  };
}
