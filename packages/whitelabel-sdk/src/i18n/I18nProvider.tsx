import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  Locale,
  LocaleResolution,
  resolveLocale,
} from './resolveLocale';
import { CATALOGUES, MessageKey } from './messages';

/**
 * Locale resolution and message lookup.
 *
 * Sits under BrandProvider, because the brand supplies the default locale — a
 * partner serving Venezuela sets locale: 'es' and their visitors get Spanish
 * without a query parameter.
 *
 * Resolution runs in an effect, not during the first render. `navigator` does
 * not exist on the server, so translating on first paint would make the client
 * disagree with the pre-rendered HTML and React would discard the tree. Same
 * constraint as the brand: match the server, then update.
 */

export type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  source: LocaleResolution['source'];
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

export interface I18nProviderProps {
  children: React.ReactNode;
  /** Usually the active brand's `locale`. */
  brandLocale?: string | null;
}

export function I18nProvider({ children, brandLocale }: I18nProviderProps) {
  const [resolution, setResolution] = useState<LocaleResolution>({
    locale: DEFAULT_LOCALE,
    source: 'default',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = resolveLocale({
      search: window.location.search,
      brandLocale,
      navigatorLocales: navigator.languages ?? [navigator.language],
    });
    setResolution((prev) =>
      prev.locale === next.locale && prev.source === next.source ? prev : next
    );
  }, [brandLocale]);

  // Reflect the language on <html> so screen readers announce the right voice
  // and CSS can hook onto it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = resolution.locale;
  }, [resolution.locale]);

  const value = useMemo<I18nContextValue>(() => {
    const catalogue = CATALOGUES[resolution.locale] ?? CATALOGUES[DEFAULT_LOCALE];
    const t: TranslateFn = (key, vars) => {
      // Falling back to English is better than rendering a key at someone, and
      // the Catalogue type means a missing translation is a compile error
      // rather than something discovered here.
      const template = catalogue[key] ?? CATALOGUES[DEFAULT_LOCALE][key] ?? key;
      return interpolate(template, vars);
    };
    return { locale: resolution.locale, source: resolution.source, t };
  }, [resolution]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Translate.
 *
 * Falls back to the English catalogue outside the provider rather than
 * throwing. The contrast with useBrand() is deliberate: rendering our colours
 * inside a partner's app is a wrong-looking page worth failing loudly over,
 * whereas a missing I18nProvider just means English — the source language, and
 * never wrong, only untranslated.
 *
 * It also keeps translated components renderable on their own, which unit tests
 * and any consumer mounting one in isolation both rely on.
 */
export function useT(): TranslateFn {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx.t;
  return (key, vars) => interpolate(CATALOGUES[DEFAULT_LOCALE][key] ?? key, vars);
}

export function useLocale(): Locale {
  return useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;
}
