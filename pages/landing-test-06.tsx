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
  FEE_COMPARISON,
  HOW_IT_WORKS,
  MERCHANT_POINTS,
  PRICING_ROWS,
  PROOF_POINTS,
  SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SEO_TITLE,
  SOURCE_URL,
} from '@/components/landing-test/content';

/*
 * Landing test 06 — "split classic", in 05's colours.
 * The conventional long page, ordered the way Stripe orders it: split hero with the copy
 * on the left and the product (estimator) on the right, a works-with strip, then one
 * section per idea with a wide CTA band before the footer. Merchant-led copy.
 */

const ID = 'lt-06';
const section = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
const eyebrow = `text-xs font-medium uppercase tracking-[0.18em] ${lt.accentText}`;
const h2 = `mt-3 text-3xl sm:text-[2.75rem] font-medium tracking-tight leading-[1.08] ${lt.fg}`;
const card = `${lt.card} border ${lt.border} ${lt.radius}`;

export default function LandingTest06() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-06" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href={BENTO_FONTS_HREF} rel="stylesheet" />
        <style>{themeCss(ID, BENTO, BENTO)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <LandingNav brand={siteName} className={`sticky top-0 z-40 bg-[#131313]/85 backdrop-blur border-b ${lt.border}`} />

        {/* ============================ HERO ============================ */}
        <section className={`${section} pt-16 pb-20 lg:pt-24 lg:pb-28`} aria-label="Hero">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className={eyebrow}>Stablecoin checkout with buyer protection</p>
              <h1 className={`mt-5 text-4xl sm:text-5xl lg:text-[4rem] font-medium tracking-tight leading-[1.02] ${lt.fg}`}>
                Take payments your customers trust,{' '}
                <span className={lt.accentText}>without a processor taking a cut.</span>
              </h1>
              <p className={`mt-6 text-lg leading-relaxed max-w-xl ${lt.muted}`}>
                A payment request in a few clicks, or put a checkout on your site in ten minutes. Funds sit in a smart contract until the payout date, so the buyer is protected and you can&apos;t be charged back. 1% flat.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/create" className={lt.btnPrimary}>Request payment</Link>
                <Link href="/dashboard" className={lt.btnSecondary}>Go to your dashboard</Link>
              </div>
              <p className={`mt-3 text-xs ${lt.muted}`}>Already using {siteName}? The dashboard has everything you&apos;ve sent or requested.</p>
              <div className={`mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs ${lt.muted}`}>
                {PROOF_POINTS.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Open source</a>
              </div>
            </motion.div>
            <motion.div className="lg:col-span-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              <EscrowEstimator />
            </motion.div>
          </div>
        </section>

        {/* ============================ WORKS WITH ============================ */}
        <section className={`border-y ${lt.border}`} aria-label="Works with">
          <div className={`${section} py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-medium tracking-wide ${lt.muted}`}>
            <span className={`text-xs uppercase tracking-[0.18em]`}>Works with</span>
            {['WordPress', 'Shopify', 'Claude', 'ChatGPT', 'Cursor', 'Base', 'USDC', 'USDT'].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </section>

        {/* ============================ MERCHANTS ============================ */}
        <section className={`${section} py-24`} aria-label="For merchants">
          <div className="grid lg:grid-cols-12 gap-12">
            <Fade className="lg:col-span-5">
              <p className={eyebrow}>For merchants</p>
              <h2 className={h2}>Everything traditional processors take from you, we don&apos;t.</h2>
              <p className={`mt-5 ${lt.muted}`}>A card processor charges a percentage, a fixed fee, a reserve, a chargeback penalty and a three-day wait. It does that to give the buyer confidence. Escrow gives them the same confidence directly.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
                <Link href="/merchant-savings-calculator" className={lt.btnSecondary}>Calculate savings</Link>
              </div>
            </Fade>
            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
              {MERCHANT_POINTS.map((m, i) => (
                <Fade key={m.label} delay={i * 0.05}>
                  <div className={`${card} p-5 h-full`}>
                    <h3 className={`font-semibold ${lt.fg}`}>{m.label}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ COMPARISON ============================ */}
        <section className={`${section} pb-24`} aria-label="Fee comparison">
          <Fade>
            <div className={`${card} overflow-hidden`}>
              <div className={`grid grid-cols-3 text-xs uppercase tracking-[0.18em] px-6 py-4 border-b ${lt.border} ${lt.muted}`}>
                <span>Line item</span>
                <span>Card processor</span>
                <span className={lt.accentText}>{siteName}</span>
              </div>
              {FEE_COMPARISON.map((r) => (
                <div key={r.item} className={`grid grid-cols-3 px-6 py-4 text-sm border-b last:border-b-0 ${lt.border}`}>
                  <span className={lt.muted}>{r.item}</span>
                  <span className={lt.fg}>{r.processor}</span>
                  <span className={`font-semibold ${lt.accentText}`}>{r.us}</span>
                </div>
              ))}
            </div>
          </Fade>
        </section>

        {/* ============================ HOW IT WORKS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="How it works">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>How it works</p>
              <h2 className={h2}>Three steps. No one in the middle.</h2>
            </Fade>
            <div className="mt-12 grid md:grid-cols-3 gap-4">
              {HOW_IT_WORKS.map((s, i) => (
                <Fade key={s.num} delay={i * 0.1}>
                  <div className={`${card} p-6 h-full`}>
                    <span className={`text-sm ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>{s.num}</span>
                    <h3 className={`mt-3 text-2xl font-medium ${lt.fg}`}>{s.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ LIVE DEMO ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Try the checkout">
          <div className={`${section} py-24 grid lg:grid-cols-2 gap-12 items-center`}>
            <Fade>
              <p className={eyebrow}>Live demo</p>
              <h2 className={h2}>See what your customers see.</h2>
              <p className={`mt-4 max-w-md ${lt.muted}`}>
                This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site.
              </p>
              <DemoButtons className="mt-8" />
            </Fade>
            <Fade delay={0.1}>
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
            </Fade>
          </div>
        </section>

        {/* ============================ AUDIENCES ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Who it is for">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>Solutions</p>
              <h2 className={h2}>Flexible escrow for every business model.</h2>
            </Fade>
            <Fade delay={0.1}>
              <AudienceTabs className="mt-10" columns={4} />
            </Fade>
          </div>
        </section>

        {/* ============================ BUYERS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="For buyers">
          <div className={`${section} py-24 grid lg:grid-cols-12 gap-12`}>
            <Fade className="lg:col-span-5">
              <p className={eyebrow}>For buyers</p>
              <h2 className={h2}>Pay with stablecoins and actually be protected.</h2>
            </Fade>
            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
              {BUYER_POINTS.map((b, i) => (
                <Fade key={b.label} delay={i * 0.05}>
                  <div className={`${card} p-5 h-full`}>
                    <h3 className={`font-semibold ${lt.fg}`}>{b.label}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ AGENTS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="For AI agents">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>For AI agents</p>
              <h2 className={h2}>Let an agent pay on your behalf. Keep the right to object.</h2>
              <p className={`mt-4 max-w-xl ${lt.muted}`}>{AGENT_INTRO}</p>
            </Fade>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {AGENT_POINTS.map((a, i) => (
                <Fade key={a.label} delay={i * 0.05}>
                  <div className={`${card} p-5 h-full`}>
                    <h3 className={`font-semibold ${lt.fg}`}>{a.label}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{a.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.3}>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
                <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>API reference</a>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ EMBED ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Embed in your platform">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>Developers</p>
              <h2 className={h2}>Embed it in your platform in an afternoon.</h2>
            </Fade>
            <Fade delay={0.1}>
              <EmbedExamples className="mt-10" layout="side" />
            </Fade>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section id="pricing" className={`border-t ${lt.border}`} aria-label="Pricing">
          <div className={`${section} py-24 grid lg:grid-cols-2 gap-12 items-center`}>
            <Fade>
              <p className={eyebrow}>Pricing</p>
              <p className={`mt-2 text-[7rem] sm:text-[10rem] leading-none font-medium tracking-tighter ${lt.accentText}`}>1%</p>
              <p className={`mt-2 ${lt.muted}`}>per transaction. Nothing else.</p>
            </Fade>
            <Fade delay={0.1}>
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
            </Fade>
          </div>
        </section>

        {/* ============================ BENEFITS + CTA BAND ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Why switch">
          <div className={`${section} py-24`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {BENEFITS.map((b, i) => (
                <Fade key={b.title} delay={i * 0.06}>
                  <div className={`border-l-2 border-[color:var(--lt-accent)] pl-5`}>
                    <h3 className={`text-lg font-semibold leading-snug ${lt.fg}`}>{b.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.2}>
              <div className={`mt-16 p-8 sm:p-12 ${lt.radius} ${lt.accentBg} text-[#131313] flex flex-col md:flex-row md:items-center md:justify-between gap-6`}>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-medium tracking-tight">Add stablecoin checkout to your store.</h2>
                  <p className="mt-2 text-sm opacity-80 max-w-md">Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
                </div>
                <Link href="/plugins" className={`${lt.btnPrimary} !bg-[#131313] !text-[#c8ff3d]`}>Explore plugins</Link>
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
