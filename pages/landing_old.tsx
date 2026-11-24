import { useEffect, useState } from 'react';
import Head from 'next/head';
import { GetStaticProps } from 'next';
import SEO from '@/components/SEO';
import { financialServiceSchema, articleSchema } from '@/utils/structuredData';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { isr } from '@/utils/isr';
import SiteNav from '@/components/layout/SiteNav';
import HomeSections, { HomeHero } from '@/components/landing-test/HomeSections';
import LandingFooter from '@/components/landing-test/LandingFooter';
import { lt, themeCss } from '@/components/landing-test/theme';
import { LANDING_PAGE_LOOK } from '@/config/looks';
import { Announcement } from '@/components/landing-test/scrolly';
import { SEO_DESCRIPTION_GETPAID, SEO_KEYWORDS, SEO_TITLE_GETPAID } from '@/components/landing-test/content';

/*
 * The homepage as it was until 24 Nov 2026, kept at /landing_old for reference. Not indexed:
 * its text lives on in the homepage's "Learn more" section (components/landing-test/HomeSections).
 * Layout.tsx renders no site header or footer here; the page carries its own.
 */

const ID = 'landing-old';

export default function LandingOld() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE_GETPAID} description={SEO_DESCRIPTION_GETPAID} keywords={SEO_KEYWORDS} canonical="/landing_old" noindex structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* The landing page's look is chosen in config/looks/index.ts. */}
        {LANDING_PAGE_LOOK.fontsHref && (
          // eslint-disable-next-line @next/next/no-page-custom-font -- this page's own face, not a site-wide font
          <link href={LANDING_PAGE_LOOK.fontsHref} rel="stylesheet" />
        )}
        <style>{themeCss(ID, LANDING_PAGE_LOOK.landing, LANDING_PAGE_LOOK.landing)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <Announcement />
        {/* The site-wide bar, dark here because this page is. */}
        <SiteNav forceDark className="sticky top-0 z-40" />

        <HomeHero brand={siteName} />

        <HomeSections />

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
