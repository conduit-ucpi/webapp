import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { motion } from 'framer-motion';
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
import {
  AGENT_INTRO,
  AGENT_POINTS,
  API_DOC_URL,
  BENEFITS,
  BUYER_POINTS,
  HOW_IT_WORKS,
  MCP_URL,
  MERCHANT_POINTS,
  PRICING_ROWS,
  PROOF_POINTS,
  SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SEO_TITLE,
  SOURCE_URL,
} from '@/components/landing-test/content';

/*
 * Landing test 09 — "scrollytelling", in 05's colours.
 * Stripe's product pages: the copy for each chapter sticks on the left while the product
 * scrolls past on the right — the escrow itself, the checkout, the code, the agent. Made
 * for developers and the agent crowd; the merchant story is still here but comes after.
 */

const ID = 'lt-09';
const section = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
const eyebrow = `text-xs font-medium uppercase tracking-[0.18em] ${lt.accentText}`;
const h2 = `mt-3 text-3xl sm:text-[2.6rem] font-medium tracking-tight leading-[1.08] ${lt.fg}`;
const card = `${lt.card} border ${lt.border} ${lt.radius}`;

/** A chapter: sticky copy on the left, whatever the chapter shows on the right. */
function Chapter({ id, label, title, children, aside, ariaLabel }: { id?: string; label: string; title: string; children: React.ReactNode; aside: React.ReactNode; ariaLabel: string }) {
  return (
    <section id={id} className={`border-t ${lt.border}`} aria-label={ariaLabel}>
      <div className={`${section} py-20 grid lg:grid-cols-12 gap-10`}>
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Fade>
              <p className={eyebrow}>{label}</p>
              <h2 className={h2}>{title}</h2>
              <div className="mt-5">{children}</div>
            </Fade>
          </div>
        </div>
        <div className="lg:col-span-7 space-y-6">{aside}</div>
      </div>
    </section>
  );
}

export default function LandingTest09() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-09" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href={BENTO_FONTS_HREF} rel="stylesheet" />
        <style>{themeCss(ID, BENTO, BENTO)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <LandingNav brand={siteName} className={`sticky top-0 z-40 bg-[#131313]/85 backdrop-blur border-b ${lt.border}`} />

        {/* ============================ HERO ============================ */}
        <section className={`${section} pt-16 pb-16 lg:pt-24`} aria-label="Hero">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className={eyebrow}>Escrow as infrastructure</p>
              <h1 className={`mt-5 text-4xl sm:text-5xl lg:text-[3.9rem] font-medium tracking-tight leading-[1.02] ${lt.fg}`}>
                Money that waits for a date <span className={lt.accentText}>and can only go to one of two people.</span>
              </h1>
              <p className={`mt-6 text-lg leading-relaxed max-w-xl ${lt.muted}`}>
                A payment request, a plugin, a script tag or one MCP URL. Funds sit in an open-source contract on Base until the payout date; the buyer is protected and nothing can be charged back.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/create" className={lt.btnPrimary}>Request payment</Link>
                <Link href="/plugins" className={lt.btnSecondary}>View integrations</Link>
              </div>
              <div className="mt-4">
                <Link href="/dashboard" className={`${lt.btnSecondary} ${lt.btnSm}`}>Already using {siteName}? Go to your dashboard</Link>
              </div>
              <div className={`mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs ${lt.muted}`}>
                {PROOF_POINTS.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Open source</a>
              </div>
            </motion.div>
            <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              <EscrowTimeline />
            </motion.div>
          </div>
        </section>

        {/* ============================ CHAPTER: HOW IT WORKS ============================ */}
        <Chapter
          label="How it works"
          title="Three states. Nothing in between."
          ariaLabel="How it works"
          aside={HOW_IT_WORKS.map((s) => (
            <div key={s.num} className={`${card} p-6`}>
              <span className={`text-sm ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>{s.num}</span>
              <h3 className={`mt-3 text-2xl font-medium ${lt.fg}`}>{s.title}</h3>
              <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
            </div>
          ))}
        >
          <p className={lt.muted}>The contract has no admin function. It can pay the seller on the date, pay the buyer if both agree a refund, or wait. That is the whole API.</p>
          <div className="mt-6">
            <Link href="/how-it-works" className={lt.btnSecondary}>Watch a payment happen</Link>
          </div>
        </Chapter>

        {/* ============================ CHAPTER: THE CHECKOUT ============================ */}
        <Chapter
          label="Live demo"
          title="See what your customers see."
          ariaLabel="Try the checkout"
          aside={
            <>
              <div className={`${card} p-6`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${lt.fg}`}>Basic Product — One-time Payment</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${lt.accentSoft} ${lt.accentText}`}>USDC</span>
                </div>
                <p className={`mt-6 text-4xl font-medium tracking-tight ${lt.fg}`}>$0.001</p>
                <p className={`mt-1 text-xs ${lt.muted}`}>Held in escrow until the payout date. Dispute before then to freeze it.</p>
                <div className={`${lt.btnPrimary} w-full mt-6 pointer-events-none`} aria-hidden="true">Pay with USDC</div>
                <p className={`mt-3 text-[11px] text-center ${lt.muted}`}>Sign in with Google or email · gas covered</p>
              </div>
              <EscrowEstimator />
            </>
          }
        >
          <p className={lt.muted}>
            This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site. Below it, the estimator: fee, net, and what the payment is worth today.
          </p>
          <DemoButtons className="mt-6" />
        </Chapter>

        {/* ============================ CHAPTER: EMBED ============================ */}
        <Chapter
          label="Developers"
          title="Embed it in your platform in an afternoon."
          ariaLabel="Embed in your platform"
          aside={<EmbedExamples layout="side" />}
        >
          <p className={lt.muted}>A plugin for WordPress and Shopify, one script tag for everything else, and one URL for any AI agent. No backend to write, no keys to keep.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/integrate" className={lt.btnPrimary}>Read the SDK guide</Link>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>Source code</a>
          </div>
        </Chapter>

        {/* ============================ CHAPTER: AGENTS ============================ */}
        <Chapter
          label="For AI agents"
          title="Let an agent pay on your behalf. Keep the right to object."
          ariaLabel="For AI agents"
          aside={
            <>
              <div className={`${card} p-6`}>
                <p className={`text-xs uppercase tracking-[0.18em] ${lt.muted}`}>One URL</p>
                <pre className={`mt-3 text-sm ${lt.accentText} overflow-x-auto`} style={{ fontFamily: 'var(--lt-font-mono)' }}>{MCP_URL}</pre>
                <p className={`mt-3 text-sm ${lt.muted}`}>Streamable HTTP. No API key, no sign-up.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {AGENT_POINTS.map((a) => (
                  <div key={a.label} className={`${card} p-5`}>
                    <h3 className={`font-semibold ${lt.fg}`}>{a.label}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{a.text}</p>
                  </div>
                ))}
              </div>
            </>
          }
        >
          <p className={lt.muted}>{AGENT_INTRO}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
            <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>API reference</a>
          </div>
        </Chapter>

        {/* ============================ CHAPTER: MERCHANTS ============================ */}
        <Chapter
          label="For merchants"
          title="Everything traditional processors take from you, we don't."
          ariaLabel="For merchants"
          aside={
            <div className="grid sm:grid-cols-2 gap-4">
              {MERCHANT_POINTS.map((m) => (
                <div key={m.label} className={`${card} p-5`}>
                  <h3 className={`font-semibold ${lt.fg}`}>{m.label}</h3>
                  <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                </div>
              ))}
            </div>
          }
        >
          <p className={lt.muted}>No chargebacks, no floats, no freezes, no vetting. One percent, and a free test before you commit.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/merchant-savings-calculator" className={lt.btnPrimary}>Calculate savings</Link>
            <Link href="/merchant" className={lt.btnSecondary}>For online stores</Link>
          </div>
        </Chapter>

        {/* ============================ CHAPTER: BUYERS ============================ */}
        <Chapter
          label="For buyers"
          title="Pay with stablecoins and actually be protected."
          ariaLabel="For buyers"
          aside={
            <div className="grid sm:grid-cols-2 gap-4">
              {BUYER_POINTS.map((b) => (
                <div key={b.label} className={`${card} p-5`}>
                  <h3 className={`font-semibold ${lt.fg}`}>{b.label}</h3>
                  <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                </div>
              ))}
            </div>
          }
        >
          <p className={lt.muted}>Sign in with Google or email. No wallet to set up, no gas to buy, no network to choose.</p>
          <div className="mt-6">
            <Link href="/p2p" className={lt.btnSecondary}>Buying from a stranger?</Link>
          </div>
        </Chapter>

        {/* ============================ CHAPTER: AUDIENCES ============================ */}
        <Chapter
          label="Who it's for"
          title="Personal, business, platform."
          ariaLabel="Who it is for"
          aside={<AudienceTabs columns={2} />}
        >
          <p className={lt.muted}>Pick who you are and see how people like you use it.</p>
        </Chapter>

        {/* ============================ PRICING ============================ */}
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
              <Link href="/merchant-savings-calculator" className={`${lt.btnSecondary} mt-6`}>
                See how much you&apos;d save vs. Stripe, Square or PayPal
              </Link>
            </div>
          }
        >
          <p className={`text-[7rem] leading-none font-medium tracking-tighter ${lt.accentText}`}>1%</p>
        </Chapter>

        {/* ============================ BENEFITS + FINAL CTA ============================ */}
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
                  <h2 className={`text-3xl font-medium tracking-tight ${lt.fg}`}>Add stablecoin checkout to your store.</h2>
                  <p className={`mt-2 text-sm max-w-md ${lt.muted}`}>Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
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
