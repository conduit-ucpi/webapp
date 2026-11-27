import { useLocale } from '@conduit-ucpi/whitelabel-sdk';
import { usePageT } from '@/config/locales';
import LegalDocument from './LegalDocument';
import TermsTextEn from './TermsText';
import TermsTextEs from './TermsText.es';

/**
 * The Terms of Service in the reader's language, for /terms-of-service and the Terms tab on /plugin.
 * The English text (TermsText.tsx) is the one that applies; any other language says so.
 */
export default function TermsOfService({ lastUpdated, version }: { lastUpdated: string; version: string | null }) {
  const t = usePageT();
  const locale = useLocale();
  return (
    <LegalDocument title={t('legal.termsTitle')} lastUpdated={lastUpdated} version={version} englishHref="/terms-of-service?lang=en">
      {locale === 'es' ? <TermsTextEs /> : <TermsTextEn />}
    </LegalDocument>
  );
}
