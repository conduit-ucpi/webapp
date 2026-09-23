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
import { Announcement, Chapter, CheckoutMock, HoverChapter, ScrollLinked, ScrollyHero, card, eyebrow, h2, section, useActiveIndex } from '@/components/landing-test/scrolly';
import {
  AGENT_INTRO,
  AGENT_POINTS,
  API_DOC_URL,
  BENEFITS,
  BUYER_POINTS,
  DISPUTE_FLOW,
  HOW_IT_WORKS,
  MERCHANT_POINTS,
  PRICING_ROWS,
  SEO_DESCRIPTION_GETPAID,
  SEO_KEYWORDS,
  SEO_TITLE_GETPAID,
} from '@/components/landing-test/content';

/*
 * Landing test 14 — "follow the money".
 * The animated escrow from 09's hero becomes the left panel of the first chapter, and
 * scrolling the three steps on the right drives it: create, fund, release happen on the
 * left as you read them on the right. Then the same trick for what happens on a dispute.
 * The rest is hover cards, folded.
 */

const ID = 'lt-14';

/** The escrow on the left, moved by the step under the reader's eye on the right. */
function FollowTheMoney() {
  const { active, setRef } = useActiveIndex(HOW_IT_WORKS.length);
  return (
    <section className={`border-t ${lt.border}`} aria-label="How it works">
      <div className={`${section} py-20 grid lg:grid-cols-12 gap-10`}>
        <div className="lg:col-span-6">
          <div className="lg:sticky lg:top-28">
            <Fade>
              <p className={eyebrow}>How it works</p>
              <h2 className={h2}>Scroll, and watch the money move.</h2>
              <div className="mt-6">
                <EscrowTimeline stage={active} />
              </div>
            </Fade>
          </div>
        </div>
        <div className="lg:col-span-6 space-y-4">
          {HOW_IT_WORKS.map((s, i) => (
            <div
              key={s.num}
              ref={setRef(i)}
              className={`${card} p-6 min-h-[45vh] flex flex-col justify-center transition-all duration-300 ${i === active ? 'border-[color:var(--lt-accent)] opacity-100' : 'opacity-60'}`}
            >
              <span className={`text-sm ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>{s.num}</span>
              <h3 className={`mt-3 text-3xl font-medium ${lt.fg}`}>{s.title}</h3>
              <p className={`mt-3 text-base leading-relaxed max-w-md ${lt.muted}`}>{s.desc}</p>
            </div>
          ))}
          <div className="pt-2">
            <Link href="/how-it-works" className={lt.btnSecondary}>Watch a real one happen</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingTest14() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE_GETPAID} description={SEO_DESCRIPTION_GETPAID} keywords={SEO_KEYWORDS} canonical="/landing-test-14" structuredData={[financialServiceSchema, articleSchema]} />
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
          headline={<>Get paid. <span className={lt.accentText}>Here is exactly what happens to the money.</span></>}
          sub="It goes into escrow, waits for the payout date, and lands with you. The buyer can freeze it before then; nobody can pull it back after. Scroll and watch."
          primary={{ href: '/create', label: 'Request payment' }}
          secondary={{ href: '#demo', label: 'See the checkout' }}
          right={<EscrowEstimator />}
        />

        <FollowTheMoney />

        <ScrollLinked
          label="If something goes wrong"
          title="A dispute freezes the money. It never takes it."
          ariaLabel="What happens on a dispute"
          items={DISPUTE_FLOW.map((d) => ({ label: d.title, text: d.text }))}
        >
          <Link href="/arbitration-policy" className={lt.btnSecondary}>Read the arbitration policy</Link>
        </ScrollLinked>

        <Chapter id="demo" label="Live demo" title="See what your customers see." ariaLabel="Try the checkout" aside={<CheckoutMock />}>
          <p className={lt.muted}>This opens the actual checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site.</p>
          <DemoButtons className="mt-6" />
        </Chapter>

        <HoverChapter
          label="For merchants"
          title="Everything a processor takes, you keep."
          ariaLabel="For merchants"
          fallback="Six things a card processor charges for. Hover any of them."
          items={MERCHANT_POINTS}
          reveal
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
          reveal
          actions={<Link href="/p2p" className={lt.btnSecondary}>Buying from a stranger?</Link>}
        />

        <HoverChapter
          label="For AI agents"
          title="Let an agent pay for you. Keep the veto."
          ariaLabel="For AI agents"
          fallback={AGENT_INTRO}
          items={AGENT_POINTS}
          reveal
          actions={
            <>
              <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
              <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>API reference</a>
            </>
          }
        />

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
                  <div className={`${card} p-5 h-full`}>
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
