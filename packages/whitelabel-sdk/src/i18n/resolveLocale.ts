/**
 * Choosing which language to render.
 *
 * Client-side by necessity: Next's built-in i18n routing needs a server, and
 * the frontend is a static export. So there are no /es/ URLs — the locale is
 * resolved in the browser and the catalogue is swapped.
 *
 * Precedence: an explicit ?lang=, then the brand's own locale, then the
 * visitor's browser, then English.
 *
 * The brand outranks the browser deliberately. A partner serving Venezuela sets
 * locale: 'es' because that is their market, and a visitor with an
 * English-configured laptop should still land on the partner's language rather
 * than ours. ?lang= is the escape hatch for anyone who wants otherwise, and is
 * what a language switcher would set.
 */

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_QUERY_KEYS = ['lang', 'locale'] as const;

export type LocaleSource = 'query' | 'brand' | 'navigator' | 'default';

export interface LocaleResolution {
  locale: Locale;
  source: LocaleSource;
}

export interface ResolveLocaleInput {
  /** `window.location.search`, or any query string. */
  search?: string;
  /** `locale` from the active brand config. */
  brandLocale?: string | null;
  /** `navigator.languages` or `[navigator.language]`. */
  navigatorLocales?: readonly string[] | null;
}

/**
 * Match a BCP 47 tag to something we actually ship.
 *
 * Only the primary subtag is compared, so 'es-VE', 'es-419' and 'es' all land
 * on Spanish. That is the right granularity here: we have one Spanish
 * catalogue, and refusing 'es-VE' because it is not exactly 'es' would be a
 * bug, not strictness.
 */
function toSupported(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(primary)
    ? (primary as Locale)
    : null;
}

function firstQueryValue(search: string | undefined): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of LOCALE_QUERY_KEYS) {
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

export function resolveLocale({
  search,
  brandLocale,
  navigatorLocales,
}: ResolveLocaleInput): LocaleResolution {
  const fromQuery = toSupported(firstQueryValue(search));
  if (fromQuery) return { locale: fromQuery, source: 'query' };

  const fromBrand = toSupported(brandLocale);
  if (fromBrand) return { locale: fromBrand, source: 'brand' };

  for (const tag of navigatorLocales ?? []) {
    const match = toSupported(tag);
    if (match) return { locale: match, source: 'navigator' };
  }

  return { locale: DEFAULT_LOCALE, source: 'default' };
}
