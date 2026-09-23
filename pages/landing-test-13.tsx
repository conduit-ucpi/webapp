import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import SEO from '@/components/SEO';
import Fade from '@/components/ui/Fade';
import { financialServiceSchema, articleSchema } from '@/utils/structuredData';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { isr } from '@/utils/isr';
import LandingNav from '@/components/landing-test/LandingNav';
import EscrowEstimator from '@/components/landing-test/EscrowEstimator';
import EscrowTimeline from '@/components/landing-test/EscrowTimeline';
import AudienceTabs from '@/components/landing-test/AudienceTabs';
import EmbedExamples from '@/components/landing-test/EmbedExamples';
import DemoButtons from '@/components/landing-test/DemoButtons';
import LandingFooter from '@/components/landing-test/LandingFooter';
import { lt, themeCss } from '@/components/landing-test/theme';
import { BENTO, BENTO_FONTS_HREF } from '@/components/landing-test/themes';
import { Announcement, Chapter, CheckoutMock, HoverChapter, HoverGrid, ScrollyHero, Term, card, section } from '@/components/landing-test/scrolly';
import {
  AGENT_INTRO,
  AGENT_POINTS,
  API_DOC_URL,
  BENEFITS,
  BUYER_POINTS,
  GLOSSARY,
  HOW_IT_WORKS,
  MERCHANT_POINTS,
  PRICING_ROWS,
  SEO_DESCRIPTION_GETPAID,
  SEO_KEYWORDS,
  SEO_TITLE_GETPAID,
} from '@/components/landing-test/content';

/*
 * Landing test 13 — "the words explained".
 * Short tiles, three across, every one a single sentence you can take in at a glance;
 * hover a tile and the left panel says it louder. The jargon is underlined and defines
 * itself on hover — escrow, payout date, dispute, gas, MCP — so the copy can stay short
 * without assuming anyone knows the words.
 */

const ID = 'lt-13';

export default function LandingTest13() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE_GETPAID} description={SEO_DESCRIPTION_GETPAID} keywords={SEO_KEYWORDS} canonical="/landing-test-13" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href={BENTO_FONTS_HREF} rel="stylesheet" />
        <style>{themeCss(ID, BENTO, BENTO)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <Announcement />
        <LandingNav brand={siteName} className={`sticky top-0 z-40 bg-[#131313]/85 backdrop-blur border-b ${lt.border}`} />

        <ScrollyHero
          brand={siteName}
          eyebrowText="Payments with buyer protection"
          headline={<>Get paid <span className={lt.accentText}>without anyone in the middle.</span></>}
          sub={
            <>
              The buyer pays into <Term word="escrow" />. On the <Term word="payout date" /> it lands with you. Before then they can raise a <Term word="dispute" />; there is no such thing as a <Term word="chargeback" />. Hover the underlined words.
            </>
          }
          primary={{ href: '/create', label: 'Request payment' }}
          secondary={{ href: '#demo', label: 'See the checkout' }}
          right={<EscrowTimeline />}
        />

        <HoverChapter
          label="How it works"
          title="Three tiles. That is the whole thing."
          ariaLabel="How it works"
          fallback="Create, fund, release. Hover a tile and it is repeated here."
          items={HOW_IT_WORKS.map((s) => ({ label: s.title, text: s.desc }))}
          columns={3}
          compact
          actions={<Link href="/how-it-works" className={lt.btnSecondary}>Watch a payment happen</Link>}
        />

        <Chapter
          id="demo"
          label="Live demo"
          title="See what your customers see."
          ariaLabel="Try the checkout"
          aside={
            <>
              <CheckoutMock />
              <EscrowEstimator />
            </>
          }
        >
          <p className={lt.muted}>
            The actual checkout, for a real $0.001 payment. The buyer signs in with Google or email; we cover the <Term word="gas" />. Under it, the estimator.
          </p>
          <DemoButtons className="mt-6" />
        </Chapter>

        <HoverChapter
          label="For merchants"
          title="Everything a processor takes, you keep."
          ariaLabel="For merchants"
          fallback="Six line items a card processor charges for. None of them exist here."
          items={MERCHANT_POINTS}
          columns={3}
          compact
          actions={
            <>
              <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
              <Link href="/merchant-savings-calculator" className={lt.btnSecondary}>Calculate savings</Link>
            </>
          }
        />

        <HoverChapter
          label="For buyers"
          title="Pay, and actually be protected."
          ariaLabel="For buyers"
          fallback="No wallet to set up, no gas to buy, no network to choose."
          items={BUYER_POINTS}
          columns={2}
          compact
          actions={<Link href="/p2p" className={lt.btnSecondary}>Buying from a stranger?</Link>}
        />

        <HoverChapter
          label="For AI agents"
          title={<>Let an agent pay for you over <Term word="MCP" />. Keep the veto.</>}
          ariaLabel="For AI agents"
          fallback={AGENT_INTRO}
          items={AGENT_POINTS}
          columns={3}
          compact
          actions={
            <>
              <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
              <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>API reference</a>
            </>
          }
        />

        <Chapter
          label="The words"
          title="Six words that do all the work."
          ariaLabel="Glossary"
          aside={<HoverGrid items={Object.entries(GLOSSARY).map(([label, text]) => ({ label, text }))} columns={2} reveal compact />}
        >
          <p className={lt.muted}>Hover any of them. The same definitions sit under the underlined words throughout the page.</p>
          <div className="mt-6">
            <Link href="/faq" className={lt.btnSecondary}>All questions</Link>
          </div>
        </Chapter>

        <Chapter label="Developers" title="Put it on your site in an afternoon." ariaLabel="Embed in your platform" aside={<EmbedExamples layout="side" />}>
          <p className={lt.muted}>A plugin for WordPress and Shopify, one script tag for everything else, and one URL for any AI agent.</p>
          <div className="mt-6">
            <Link href="/integrate" className={lt.btnSecondary}>Read the SDK guide</Link>
          </div>
        </Chapter>

        <Chapter label="Who it's for" title="Personal, business, platform." ariaLabel="Who it is for" aside={<AudienceTabs columns={2} />}>
          <p className={lt.muted}>Pick who you are and see how people like you use it.</p>
        </Chapter>

        <Chapter
          id="pricing"
          label="Pricing"
          title="1% per transaction. Nothing else."
          ariaLabel="Pricing"
          aside={
            <div className={`${card} p-6`}>
              {PRICING_ROWS.map(([k, v]) => (
                <div key={k} className={`flex justify-between py-3 border-b ${lt.border} text-sm`}>
                  <span className={lt.muted}>{k}</span>
                  <span className={`font-semibold ${lt.fg}`}>{v}</span>
                </div>
              ))}
              <Link href="/merchant-savings-calculator" className={`${lt.btnSecondary} mt-6`}>See how much you&apos;d save vs. Stripe, Square or PayPal</Link>
            </div>
          }
        >
          <p className={`text-[7rem] leading-none font-medium tracking-tighter ${lt.accentText}`}>1%</p>
        </Chapter>

        <section className={`border-t ${lt.border}`} aria-label="Why switch">
          <div className={`${section} py-20`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {BENEFITS.map((b, i) => (
                <Fade key={b.title} delay={i * 0.06}>
                  <div className={`${card} p-5 h-full hover:border-[color:var(--lt-accent)] transition-colors`}>
                    <h3 className={`text-lg font-semibold leading-snug ${lt.fg}`}>{b.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.2}>
              <div className={`${card} mt-4 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6`}>
                <div>
                  <h2 className={`text-3xl font-medium tracking-tight ${lt.fg}`}>Add a protected checkout to your store.</h2>
                  <p className={`mt-2 text-sm max-w-md ${lt.muted}`}>Ready-made plugins for the platforms you already sell on.</p>
                </div>
                <Link href="/plugins" className={lt.btnPrimary}>Explore plugins</Link>
              </div>
            </Fade>
          </div>
        </section>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
