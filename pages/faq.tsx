import SEO from '@/components/SEO'
import Link from 'next/link'
import Head from 'next/head'
import { GetStaticProps } from 'next'
import { faqSchema } from '@/components/faq/FaqAnswer'
import FaqSections, { EYEBROW, useFaqContent } from '@/components/faq/FaqSections'
import Fade from '@/components/ui/Fade';
import { isr } from '@/utils/isr';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * The words live in config/faq/<locale>.ts and the sections in components/faq/FaqSections (shared
 * with /plugin); this file is the page around them. The locale is the one every page resolves
 * (?lang=, then the brand's own locale, then the browser): a Spanish-language brand gets Spanish.
 */
export default function FAQ() {
  const content = useFaqContent();

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        keywords={content.seo.keywords}
        canonical="/faq"
        structuredData={faqSchema(content)}
      />
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors">

        {/* HERO */}
        <section className="flex items-center" aria-label="Hero">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-10 lg:pb-12 w-full">
            <Fade>
              <p className={`${EYEBROW} mb-10`}>{content.hero.eyebrow}</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl">
                {content.hero.heading}
              </h1>
            </Fade>
          </div>
        </section>

        <FaqSections content={content} />

        {/* FOOTER */}
        <section className="border-t border-secondary-100 dark:border-secondary-800">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8">
            <Fade>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
                <Link href="/" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  {content.footer.home}
                </Link>
                <a href="mailto:info@stabledrop.me" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  {content.footer.support}
                </a>
              </div>
            </Fade>
          </div>
        </section>

      </div>
    </>
  )
}

// Static generation for SEO
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    ...isr(86400), // Revalidate daily
  };
};
