import { lastTextChange, lastTextChangeVersion } from '@/lib/server/lastTextChange';
import { TERMS_FILE } from '@/lib/server/gitFileVersion';
import { useState } from 'react'
import Head from 'next/head'
import { useLocale } from '@conduit-ucpi/whitelabel-sdk'
import { usePageT } from '@/config/locales'
import TermsOfService from '@/components/legal/TermsOfService'
import PrivacyPolicy, { PRIVACY_FILE } from '@/components/legal/PrivacyPolicy'
import DisputePolicyText from '@/components/legal/DisputePolicyText'
import FaqSections, { useFaqContent } from '@/components/faq/FaqSections'

/** The tabs, in order, and the label each takes. */
const SECTIONS = {
  faq: 'plugin.tabFaq',
  terms: 'plugin.tabTerms',
  privacy: 'plugin.tabPrivacy',
  disputes: 'plugin.tabDisputes',
} as const

/**
 * Build-time only; Next strips getStaticProps and its imports from the client bundle. The tabs
 * show the real documents, so they carry the real documents' dates and terms version: from their
 * text files, the same as /terms-of-service and /privacy-policy.
 */
export async function getStaticProps() {
  const terms = lastTextChangeVersion(TERMS_FILE, '29 July 2026')
  return {
    props: {
      termsUpdated: terms.date,
      termsVersion: terms.version,
      privacyUpdated: lastTextChange(PRIVACY_FILE, '25 February 2026'),
    },
  }
}

interface PluginPageProps {
  termsUpdated: string
  termsVersion: string | null
  privacyUpdated: string
}

export default function PluginPage({ termsUpdated, termsVersion, privacyUpdated }: PluginPageProps) {
  const t = usePageT()
  const locale = useLocale()
  const [activeSection, setActiveSection] = useState<keyof typeof SECTIONS>('faq')

  return (
    <>
      <Head children={
        <>
          <title>{`${t('plugin.title')} - Stabledrop`}</title>
          <meta name="description" content={`${t('plugin.tabFaq')}, ${t('plugin.tabTerms')}, ${t('plugin.tabPrivacy')}, ${t('plugin.tabDisputes')} - Stabledrop`} />
        </>
      } />

      <div className="min-h-screen bg-white dark:bg-secondary-900 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-lg dark:shadow-none">
            {/* Header */}
            <div className="px-6 py-4 border-b border-secondary-200 dark:border-secondary-700">
              <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">{t('plugin.title')}</h1>
            </div>

            {/* Navigation */}
            <div className="border-b border-secondary-200 dark:border-secondary-700">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeSection === key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200 hover:border-secondary-300 dark:hover:border-secondary-600'
                    }`}
                  >
                    {t(SECTIONS[key])}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
              {activeSection === 'faq' && <FAQSection />}
              {activeSection === 'terms' && (
                <div className="prose max-w-none"><TermsOfService lastUpdated={termsUpdated} version={termsVersion} /></div>
              )}
              {activeSection === 'privacy' && (
                <div className="prose max-w-none"><PrivacyPolicy lastUpdated={privacyUpdated} /></div>
              )}
              {activeSection === 'disputes' && (
                <>
                  {locale !== 'en' && (
                    <p role="note" className="mb-6 p-4 rounded-lg bg-secondary-50 dark:bg-secondary-800 text-sm text-secondary-700 dark:text-secondary-200">
                      {t('plugin.disputesEnglishOnly')}
                    </p>
                  )}
                  <div lang="en"><DisputePolicyText /></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * The same FAQ as /faq (components/faq/FaqSections), in the visitor's language. This tab used to
 * carry its own nine-question copy, which went stale.
 */
function FAQSection() {
  const content = useFaqContent()
  return (
    <div className="-mx-6 -my-8">
      <h2 className="px-6 pt-8 pb-4 text-2xl font-bold text-secondary-900 dark:text-white">{content.hero.heading}</h2>
      <FaqSections content={content} />
    </div>
  )
}
