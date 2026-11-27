import { useLocale } from '@conduit-ucpi/whitelabel-sdk';
import { usePageT } from '@/config/locales';
import LegalDocument from './LegalDocument';
import PrivacyTextEn from './PrivacyText';
import PrivacyTextEs from './PrivacyText.es';

/** The file whose last change is the Privacy Policy's "Last Updated" date: its English text. */
export const PRIVACY_FILE = 'components/legal/PrivacyText.tsx';

/**
 * The Privacy Policy in the reader's language, for /privacy-policy and the Privacy tab on /plugin.
 * The English text (PrivacyText.tsx) is the one that applies; any other language says so.
 */
export default function PrivacyPolicy({ lastUpdated }: { lastUpdated: string }) {
  const t = usePageT();
  const locale = useLocale();
  return (
    <LegalDocument title={t('legal.privacyTitle')} lastUpdated={lastUpdated} englishHref="/privacy-policy?lang=en">
      {locale === 'es' ? <PrivacyTextEs /> : <PrivacyTextEn />}
    </LegalDocument>
  );
}
