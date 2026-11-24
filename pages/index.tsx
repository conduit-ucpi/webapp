import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
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
import { Announcement, card, section } from '@/components/landing-test/scrolly';
import { SEO_DESCRIPTION_GETPAID, SEO_KEYWORDS } from '@/components/landing-test/content';

/*
 * The homepage: the site header and footer, one heading, and a "which one are you" choice,
 * with nothing below the fold. Each choice leads to its own copy of the previous homepage in
 * pages/landing_simple/, so each can be rewritten for its audience. The previous homepage
 * itself is kept at /landing_old; /landing_simple renders this page.
 *
 * The choices are buttons, not a dropdown: all seven are visible at once, each is one
 * click, and each is a real link (crawlable, opens in a new tab).
 *
 * The previous homepage's text (its hero lines and every section under it) is in this page's
 * HTML too, collapsed behind "Learn more about Stabledrop", so search engines read it. It is
 * behind a control the visitor can open, never invisible outright: text served to bots but not
 * to people is "hidden text" under Google's spam rules. A link to an anchor inside it (the
 * nav's "Pricing" is /#pricing) opens it.
 */

const ID = 'home';

const CHOICES = [
  { href: '/landing_simple/checkout', label: 'I want to put a checkout on my site' },
  { href: '/landing_simple/business', label: 'I am a business billing/paying another business' },
  { href: '/landing_simple/send-money', label: 'I want to send money to another person' },
  { href: '/landing_simple/payment-requests', label: 'I want to auto-generate payment requests' },
  { href: '/landing_simple/partner', label: 'I want to partner with Stabledrop' },
  { href: '/landing_simple/ai-agent', label: "I want a veto over my AI agent's payments" },
  { href: '/landing_simple/help', label: "I'm not any of these things, help me anyway" },
];

export default function Home() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);
  const [learnMore, setLearnMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  // Where to land once the section is open: the section itself, or the anchor a link asked for.
  const [target, setTarget] = useState<string | null>(null);

  // A link to an anchor inside the collapsed section (/#pricing, #demo) opens it first.
  useEffect(() => {
    const openForHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el && moreRef.current?.contains(el)) {
        setLearnMore(true);
        setTarget(id);
      }
    };
    openForHash();
    window.addEventListener('hashchange', openForHash);
    return () => window.removeEventListener('hashchange', openForHash);
  }, []);

  useEffect(() => {
    if (!learnMore || !target) return;
    document.getElementById(target)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    setTarget(null);
  }, [learnMore, target]);

  return (
    <>
      <SEO
        title="Protected Payments for everyone, for 1%"
        description={SEO_DESCRIPTION_GETPAID}
        keywords={SEO_KEYWORDS}
        canonical="/"
        structuredData={[financialServiceSchema, articleSchema]}
      />
      <Head>
        {LANDING_PAGE_LOOK.fontsHref && (
          // eslint-disable-next-line @next/next/no-page-custom-font -- this page's own face, not a site-wide font
          <link href={LANDING_PAGE_LOOK.fontsHref} rel="stylesheet" />
        )}
        <style>{themeCss(ID, LANDING_PAGE_LOOK.landing, LANDING_PAGE_LOOK.landing)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg} min-h-screen flex flex-col`} style={{ fontFamily: 'var(--lt-font)' }}>
        <Announcement />
        <SiteNav forceDark className="sticky top-0 z-40" />

        <main className={`${section} flex-1 w-full flex flex-col justify-center py-10 lg:py-14`} aria-label="Hero">
          <h1 className={`text-4xl sm:text-5xl lg:text-[3.9rem] font-medium tracking-tight leading-[1.02] ${lt.fg}`}>
            Protected Payments for everyone, <span className={lt.accentText}>for 1%</span>
          </h1>
          <p className={`mt-5 text-lg ${lt.muted}`}>What brings you here?</p>

          <ul className="mt-7 grid sm:grid-cols-2 gap-3">
            {CHOICES.map((c, i) => (
              <li key={c.href} className={i === CHOICES.length - 1 ? 'sm:col-span-2' : ''}>
                <Link
                  href={c.href}
                  className={`${card} group flex items-center justify-between gap-4 px-5 py-4 h-full hover:border-[color:var(--lt-accent)] transition-colors`}
                >
                  <span className={`font-medium ${lt.fg}`}>{c.label}</span>
                  <span aria-hidden className={`${lt.accentText} transition-transform group-hover:translate-x-1`}>&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <button
              type="button"
              aria-expanded={learnMore}
              aria-controls="learn-more"
              onClick={() => {
                setTarget(learnMore ? null : 'learn-more');
                setLearnMore((o) => !o);
              }}
              className={`text-sm underline underline-offset-4 ${lt.muted} hover:text-[color:var(--lt-fg)] transition-colors`}
            >
              {learnMore ? 'Show less' : 'Learn more about Stabledrop'}
            </button>
          </div>
        </main>

        {/* In the HTML whether open or not; see the note at the top. */}
        <div id="learn-more" ref={moreRef} hidden={!learnMore} className="scroll-mt-20">
          <div className={`border-t ${lt.border}`}>
            <HomeHero brand={siteName} headingLevel={2} />
          </div>
          <HomeSections />
        </div>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
