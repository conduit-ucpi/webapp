import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '@conduit-ucpi/whitelabel-sdk';
import { useConfig } from '@/components/auth/ConfigProvider';
import Fade from '@/components/ui/Fade';
import FaqAnswer, { renderWithLinks } from '@/components/faq/FaqAnswer';
import { faqEn } from '@/config/faq/en';
import { faqEs } from '@/config/faq/es';
import type { FaqContent } from '@/config/faq/types';

/**
 * The FAQ's sections, questions and "still have questions?", in the visitor's language. Shared by
 * /faq and the FAQ tab on /plugin, so there is one FAQ: the words are in config/faq/<locale>.ts.
 */

const CONTENT: Record<string, FaqContent> = { en: faqEn, es: faqEs };

/** The FAQ in the locale every page resolves (?lang=, then the brand's locale, then the browser). */
export function useFaqContent(): FaqContent {
  return CONTENT[useLocale()] ?? faqEn;
}

export const EYEBROW = 'text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500';

// ---------------------------------------------------------------------------
// Collapsible FAQ item — question as clickable heading, answer toggles
// ---------------------------------------------------------------------------

export function FAQItem({
  question,
  children,
  defaultOpen = false,
}: {
  question: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left group cursor-pointer flex items-start justify-between gap-4 py-4"
      >
        <h3 className="text-sm font-medium text-secondary-900 dark:text-white leading-relaxed">
          {question}
        </h3>
        <span className="mt-0.5 flex-shrink-0 text-secondary-400 dark:text-secondary-500 transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export default function FaqSections({ content }: { content: FaqContent }) {
  const { config } = useConfig();
  return (
    <>
        {content.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="border-t border-secondary-100 dark:border-secondary-800"
            aria-label={section.eyebrow}
          >
            <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
              <Fade>
                <p className={`${EYEBROW} mb-3`}>{section.eyebrow}</p>
                <h2
                  className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                  style={{ fontFamily: 'var(--wl-font-accent)' }}
                >
                  {section.heading}
                </h2>
              </Fade>

              <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
                {section.items.map((item, index) => (
                  <Fade key={item.id} delay={index * 0.05}>
                    <FAQItem question={item.q}>
                      <FaqAnswer markdown={item.a} />
                      {item.showContractAddress && config?.contractAddress && (
                        <div className="mt-3 text-sm">
                          <p className="font-medium text-secondary-900 dark:text-white">{content.contractAddress.label}</p>
                          <code className="block mt-1 bg-secondary-100 dark:bg-secondary-800 px-3 py-2 rounded text-sm break-all text-secondary-700 dark:text-secondary-300">
                            {config.contractAddress}
                          </code>
                          <p className="mt-1 text-xs text-secondary-400 dark:text-secondary-500">{content.contractAddress.note}</p>
                        </div>
                      )}
                    </FAQItem>
                  </Fade>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* STILL HAVE QUESTIONS */}
        <section className="border-t border-secondary-100 dark:border-secondary-800" aria-label={content.more.heading}>
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className={`${EYEBROW} mb-3`}>{content.more.eyebrow}</p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {content.more.heading}
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">{renderWithLinks(content.more.body)}</p>
            </Fade>
          </div>
        </section>

    </>
  );
}
