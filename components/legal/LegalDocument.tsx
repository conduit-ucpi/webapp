import type { ReactNode } from 'react';
import { useLocale } from '@conduit-ucpi/whitelabel-sdk';
import { usePageT } from '@/config/locales';

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * 'D Month YYYY' (lastTextChange's English date) in the reader's language. A fixed table, like
 * lastTextChange's own, so the output never depends on the machine's ICU data.
 */
export function localDate(date: string, locale: string): string {
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(date);
  const month = m ? MONTHS_EN.indexOf(m[2]) : -1;
  if (locale !== 'es' || !m || month < 0) return date;
  return `${m[1]} de ${MONTHS_ES[month]} de ${m[3]}`;
}

/**
 * A legal document in the reader's language: its title, its date (and version, for the Terms),
 * and, when it is not English, a notice that the English text is the one that applies, with a link
 * to it. `children` picks the text for the locale; the English text is what governs.
 */
export default function LegalDocument({
  title,
  lastUpdated,
  version,
  englishHref,
  children,
}: {
  title: string;
  lastUpdated: string;
  version?: string | null;
  /** Where the English text is: the page with ?lang=en. */
  englishHref: string;
  children: ReactNode;
}) {
  const t = usePageT();
  const locale = useLocale();
  return (
    <>
      <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-8">{title}</h1>

      <p className="text-secondary-600 dark:text-secondary-300 mb-6">
        <strong>{t('legal.lastUpdated')}</strong> {localDate(lastUpdated, locale)}
        {version && <> &middot; <strong>{t('legal.version')}</strong> <code>{version}</code></>}
      </p>

      {locale !== 'en' && (
        <p role="note" className="mb-8 p-4 rounded-lg bg-secondary-50 dark:bg-secondary-800 text-sm text-secondary-700 dark:text-secondary-200">
          {t('legal.translationNotice')}{' '}
          {/* A full page load on purpose: the locale is resolved when the page loads, from ?lang=. */}
          <a href={englishHref} className="text-primary-600 hover:text-primary-500 underline">
            {t('legal.readEnglish')}
          </a>
        </p>
      )}

      {children}
    </>
  );
}
