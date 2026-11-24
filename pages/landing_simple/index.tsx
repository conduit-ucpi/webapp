import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import SEO from '@/components/SEO';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { isr } from '@/utils/isr';
import SiteNav from '@/components/layout/SiteNav';
import LandingFooter from '@/components/landing-test/LandingFooter';
import { lt, themeCss } from '@/components/landing-test/theme';
import { LANDING_PAGE_LOOK } from '@/config/looks';
import { Announcement, card, section } from '@/components/landing-test/scrolly';
import { SEO_DESCRIPTION_GETPAID, SEO_KEYWORDS } from '@/components/landing-test/content';

/*
 * A one-screen landing page: the homepage's header and footer, a single heading, and a
 * "which one are you" choice. Nothing below the fold. Each choice is its own copy of the
 * homepage in pages/landing_simple/, so each can be rewritten for its audience.
 *
 * The choices are buttons, not a dropdown: all seven are visible at once, each is one
 * click, and each is a real link (crawlable, opens in a new tab).
 */

const ID = 'landing-simple';

const CHOICES = [
  { href: '/landing_simple/checkout', label: 'I want to put a checkout on my site' },
  { href: '/landing_simple/business', label: 'I am a business billing/paying another business' },
  { href: '/landing_simple/send-money', label: 'I want to send money to another person' },
  { href: '/landing_simple/payment-requests', label: 'I want to auto-generate payment requests' },
  { href: '/landing_simple/partner', label: 'I want to partner with Stabledrop' },
  { href: '/landing_simple/ai-agent', label: "I want a veto over my AI agent's payments" },
  { href: '/landing_simple/help', label: "I'm not any of these things, help me anyway" },
];

export default function LandingSimple() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO
        title="Protected Payments for everyone, for 1%"
        description={SEO_DESCRIPTION_GETPAID}
        keywords={SEO_KEYWORDS}
        canonical="/landing_simple"
        noindex
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
        </main>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
