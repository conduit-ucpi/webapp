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
  HOW_IT_WORKS,
  MERCHANT_POINTS,
  PRICING_ROWS,
  PROOF_POINTS,
  SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SEO_TITLE,
  SOURCE_URL,
  WHY_STABLECOINS,
} from '@/components/landing-test/content';

/*
 * Landing test 08 — "calculator first", in 05's colours.
 * Wise's send-money page as a homepage: a short headline, then the estimator dead centre
 * and wide, then who it is for straight underneath. The page leads with the number the
 * visitor came to find out, and explains itself afterwards. Audience-led copy, with a
 * "why stablecoins" block for people who have never held one.
 */

const ID = 'lt-08';
const section = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
const eyebrow = `text-xs font-medium uppercase tracking-[0.18em] ${lt.accentText}`;
const h2 = `mt-3 text-3xl sm:text-[2.75rem] font-medium tracking-tight leading-[1.08] ${lt.fg}`;
const card = `${lt.card} border ${lt.border} ${lt.radius}`;

export default function LandingTest08() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-08" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href={BENTO_FONTS_HREF} rel="stylesheet" />
        <style>{themeCss(ID, BENTO, BENTO)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <LandingNav brand={siteName} ctaLabel="Get paid" className={`sticky top-0 z-40 bg-[#131313]/85 backdrop-blur border-b ${lt.border}`} />

        {/* ============================ HERO: THE CALCULATOR ============================ */}
        <section className={`${section} pt-14 pb-16 lg:pt-20`} aria-label="Hero">
          <motion.div className="text-center max-w-3xl mx-auto" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.05] ${lt.fg}`}>
              What would you keep if <span className={lt.accentText}>nobody took a cut?</span>
            </h1>
            <p className={`mt-5 text-lg ${lt.muted}`}>
              Set the amount and the payout date. See the fee, what lands, what a card processor would have taken, and what the payment is worth today.
            </p>
          </motion.div>

          <motion.div className="mt-10 grid lg:grid-cols-12 gap-6 items-stretch" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <div className="lg:col-span-7 lg:col-start-1">
              <EscrowEstimator ctaLabel="Get paid — request this payment" className="h-full" />
            </div>
            <div className={`lg:col-span-5 ${card} p-6 sm:p-8 flex flex-col`}>
              <p className={eyebrow}>Or start here</p>
              <div className="mt-5 grid gap-3">
                <Link href="/create" className={lt.btnPrimary}>Request a payment</Link>
                <Link href="/dashboard" className={lt.btnSecondary}>Go to your dashboard</Link>
                <a href="#demo" className={lt.btnSecondary}>See the checkout</a>
              </div>
              <ul className={`mt-8 space-y-3 text-sm ${lt.fg}`}>
                <li className="flex gap-3"><Check /> <span><strong>Low fees</strong> — 1% flat, no monthly, no chargeback fees</span></li>
                <li className="flex gap-3"><Check /> <span><strong>Lightning fast</strong> — money moves in seconds on the payout date</span></li>
                <li className="flex gap-3"><Check /> <span><strong>Perfectly predictable</strong> — locked until the date both sides agreed</span></li>
                <li className="flex gap-3"><Check /> <span><strong>Sell it early</strong> — cash today from the liquidity marketplace</span></li>
              </ul>
              <div className={`mt-auto pt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs ${lt.muted}`}>
                {PROOF_POINTS.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Open source</a>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ============================ AUDIENCES ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Who it is for">
          <div className={`${section} py-20`}>
            <Fade>
              <p className={eyebrow}>Who it&apos;s for</p>
              <h2 className={h2}>Personal. Business. Platform.</h2>
              <p className={`mt-4 max-w-xl ${lt.muted}`}>Pick who you are and see how people like you use it.</p>
            </Fade>
            <Fade delay={0.1}>
              <AudienceTabs className="mt-10" columns={4} />
            </Fade>
          </div>
        </section>

        {/* ============================ WHY STABLECOINS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Why stablecoins">
          <div className={`${section} py-20 grid lg:grid-cols-12 gap-12`}>
            <Fade className="lg:col-span-4">
              <p className={eyebrow}>Never held one?</p>
              <h2 className={h2}>Why a stablecoin, in plain terms.</h2>
              <div className="mt-8">
                <Link href="/how-it-works" className={lt.btnSecondary}>How it works, in detail</Link>
              </div>
            </Fade>
            <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
              {WHY_STABLECOINS.map((w, i) => (
                <Fade key={w.title} delay={i * 0.05}>
                  <div className={`${card} p-5 h-full`}>
                    <h3 className={`font-semibold ${lt.fg}`}>{w.title}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{w.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ HOW IT WORKS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="How it works">
          <div className={`${section} py-20`}>
            <Fade>
              <p className={eyebrow}>How it works</p>
              <h2 className={h2}>Three steps. No one in the middle.</h2>
            </Fade>
            <div className="mt-10 grid md:grid-cols-3 gap-4">
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
        <section id="demo" className={`border-t ${lt.border}`} aria-label="Try the checkout">
          <div className={`${section} py-20`}>
            <Fade>
              <div className={`${card} p-8 sm:p-10 lg:flex lg:items-center lg:justify-between gap-10`}>
                <div>
                  <p className={eyebrow}>Live demo</p>
                  <h2 className={h2}>See what your customers see.</h2>
                  <p className={`mt-3 max-w-md text-sm ${lt.muted}`}>
                    This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site.
                  </p>
                </div>
                <DemoButtons className="mt-6 lg:mt-0 shrink-0" />
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ MERCHANTS + BUYERS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="For merchants and buyers">
          <div className={`${section} py-20 grid lg:grid-cols-2 gap-6`}>
            <Fade>
              <div className={`${card} p-6 sm:p-8 h-full`}>
                <p className={eyebrow}>For merchants</p>
                <h2 className={h2}>Everything traditional processors take from you, we don&apos;t.</h2>
                <div className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-6">
                  {MERCHANT_POINTS.map((m) => (
                    <div key={m.label}>
                      <h3 className={`font-semibold ${lt.fg}`}>{m.label}</h3>
                      <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
                  <Link href="/merchant-savings-calculator" className={lt.btnSecondary}>Calculate savings</Link>
                </div>
              </div>
            </Fade>
            <Fade delay={0.1}>
              <div className={`${card} p-6 sm:p-8 h-full`}>
                <p className={eyebrow}>For buyers</p>
                <h2 className={h2}>Pay and actually be protected.</h2>
                <div className="mt-8 space-y-6">
                  {BUYER_POINTS.map((b) => (
                    <div key={b.label}>
                      <h3 className={`font-semibold ${lt.fg}`}>{b.label}</h3>
                      <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ AGENTS + EMBED ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="For AI agents and developers">
          <div className={`${section} py-20 grid lg:grid-cols-12 gap-6`}>
            <Fade className="lg:col-span-5">
              <div className={`${card} p-6 sm:p-8 h-full`}>
                <p className={eyebrow}>For AI agents</p>
                <h2 className={h2}>Let an agent pay. Keep the veto.</h2>
                <p className={`mt-3 text-sm ${lt.muted}`}>{AGENT_INTRO}</p>
                <div className="mt-8 space-y-5">
                  {AGENT_POINTS.map((a) => (
                    <div key={a.label}>
                      <h3 className={`font-semibold ${lt.fg}`}>{a.label}</h3>
                      <p className={`mt-1 text-sm leading-relaxed ${lt.muted}`}>{a.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
                  <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>API reference</a>
                </div>
              </div>
            </Fade>
            <Fade className="lg:col-span-7" delay={0.1}>
              <div className={`${card} p-6 sm:p-8 h-full`}>
                <p className={eyebrow}>Developers</p>
                <h2 className={h2}>Works everywhere you sell.</h2>
                <EmbedExamples className="mt-8" />
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section id="pricing" className={`border-t ${lt.border}`} aria-label="Pricing">
          <div className={`${section} py-20 grid lg:grid-cols-12 gap-6`}>
            <Fade className="lg:col-span-5">
              <div className={`${lt.accentBg} ${lt.radius} p-6 sm:p-8 h-full`}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#131313]/70">Pricing</p>
                <p className="mt-4 text-[8rem] sm:text-[10rem] leading-none font-medium tracking-tighter text-[#131313]">1%</p>
                <p className="mt-2 text-[#131313]/80">per transaction. Nothing else.</p>
              </div>
            </Fade>
            <Fade className="lg:col-span-7" delay={0.1}>
              <div className={`${card} p-6 sm:p-8 h-full`}>
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

function Check() {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 w-5 h-5 mt-0.5 rounded-full items-center justify-center ${lt.accentBg} text-[#131313]`}>
      <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    </span>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
