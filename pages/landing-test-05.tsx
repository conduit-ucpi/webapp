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
import { LandingTheme, lt, themeCss } from '@/components/landing-test/theme';
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
} from '@/components/landing-test/content';

/*
 * Landing test 05 — bento.
 * Wise's boldness in the dark: charcoal, one lime accent, a grotesk face, and everything
 * laid out as tiles in a grid so the numbers lead — 1%, seconds, $0.001 — with the
 * calculator, the audience switch and the embed snippets each getting a tile of their own.
 */

const ID = 'lt-05';

const light: LandingTheme = BENTO;

/* This one is dark by design; the app's dark mode changes nothing. */
const dark: LandingTheme = BENTO;

const section = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
const tile = `${lt.card} border ${lt.border} ${lt.radius} p-6 sm:p-8`;
const h2 = `text-3xl sm:text-4xl font-medium tracking-tight leading-[1.1] ${lt.fg}`;
const eyebrow = `text-xs font-medium uppercase tracking-[0.18em] ${lt.accentText}`;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={`${tile} flex flex-col justify-between`}>
      <span className={`text-5xl sm:text-6xl font-medium tracking-tighter ${lt.accentText}`}>{value}</span>
      <span className={`mt-4 text-sm ${lt.muted}`}>{label}</span>
    </div>
  );
}

export default function LandingTest05() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-05" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href={BENTO_FONTS_HREF} rel="stylesheet" />
        <style>{themeCss(ID, light, dark)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <LandingNav brand={siteName} className={`sticky top-0 z-40 bg-[#131313]/85 backdrop-blur border-b ${lt.border}`} />

        {/* ============================ HERO GRID ============================ */}
        <section className={`${section} pt-10 pb-16 lg:pt-14`} aria-label="Hero">
          <div className="grid lg:grid-cols-12 gap-4">
            <motion.div className={`${tile} lg:col-span-7 flex flex-col justify-between`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div>
                <p className={eyebrow}>Stablecoin escrow</p>
                <h1 className={`mt-5 text-4xl sm:text-5xl lg:text-[3.8rem] font-medium tracking-tight leading-[1.02] ${lt.fg}`}>
                  Get paid in stablecoins.
                  <br />
                  <span className={lt.accentText}>Nobody can charge you back.</span>
                </h1>
                <p className={`mt-6 text-base sm:text-lg leading-relaxed max-w-lg ${lt.muted}`}>
                  Request a payment in a few clicks. Funds sit in a smart contract until the payout date — the buyer is protected, and no processor holds your money.
                </p>
              </div>
              <div className="mt-10">
                <div className="flex flex-wrap gap-3">
                  <Link href="/create" className={lt.btnPrimary}>Request payment</Link>
                  <a href="#demo" className={lt.btnOutline}>See the checkout</a>
                </div>
                <Link href="/dashboard" className={`${lt.btnGhost} mt-5`}>
                  Already using {siteName}? Go to your dashboard <span aria-hidden="true">→</span>
                </Link>
                <div className={`mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs ${lt.muted}`}>
                  {PROOF_POINTS.map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                  <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Open source</a>
                </div>
              </div>
            </motion.div>

            <motion.div className="lg:col-span-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              <EscrowEstimator className="h-full" />
            </motion.div>

            <motion.div className="lg:col-span-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Stat value="1%" label="Flat fee. No monthly, no chargeback, no reserve." />
            </motion.div>
            <motion.div className="lg:col-span-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <Stat value="10 min" label="To put a checkout on your site. A one-off payment request takes a few clicks." />
            </motion.div>
            <motion.div className="lg:col-span-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <Stat value="0 gas" label="The buyer never needs ETH. Gas is covered." />
            </motion.div>
            <motion.div className="lg:col-span-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
              <Stat value="$0.001" label="A real end-to-end test payment, free." />
            </motion.div>
          </div>
        </section>

        {/* ============================ HOW IT WORKS + DEMO ============================ */}
        <section id="demo" className={`${section} py-8`} aria-label="How it works">
          <div className="grid lg:grid-cols-12 gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <Fade key={s.num} delay={i * 0.08} className="lg:col-span-4">
                <div className={`${tile} h-full`}>
                  <span className={`text-sm ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>{s.num}</span>
                  <h3 className={`mt-3 text-2xl font-medium ${lt.fg}`}>{s.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                </div>
              </Fade>
            ))}
            <Fade className="lg:col-span-12">
              <div className={`${tile} lg:flex lg:items-center lg:justify-between gap-10`}>
                <div>
                  <p className={eyebrow}>Live demo</p>
                  <h2 className={`mt-3 ${h2}`}>See what your customers see.</h2>
                  <p className={`mt-3 max-w-md text-sm ${lt.muted}`}>
                    This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site.
                  </p>
                </div>
                <DemoButtons className="mt-6 lg:mt-0 shrink-0" />
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ AUDIENCES ============================ */}
        <section className={`${section} py-8`} aria-label="Who it is for">
          <Fade>
            <div className={tile}>
              <p className={eyebrow}>Who it&apos;s for</p>
              <h2 className={`mt-3 ${h2}`}>Personal, business, platform.</h2>
              <AudienceTabs className="mt-8" columns={4} />
            </div>
          </Fade>
        </section>

        {/* ============================ MERCHANTS + BUYERS ============================ */}
        <section className={`${section} py-8`} aria-label="For merchants and buyers">
          <div className="grid lg:grid-cols-12 gap-4">
            <Fade className="lg:col-span-7">
              <div className={`${tile} h-full`}>
                <p className={eyebrow}>For merchants</p>
                <h2 className={`mt-3 ${h2}`}>Everything traditional processors take from you, we don&apos;t.</h2>
                <div className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-6">
                  {MERCHANT_POINTS.map((m) => (
                    <div key={m.label}>
                      <h3 className={`font-medium ${lt.fg}`}>{m.label}</h3>
                      <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
                  <Link href="/merchant-savings-calculator" className={lt.btnOutline}>Calculate savings</Link>
                </div>
              </div>
            </Fade>
            <Fade className="lg:col-span-5" delay={0.1}>
              <div className={`${tile} h-full`}>
                <p className={eyebrow}>For buyers</p>
                <h2 className={`mt-3 ${h2}`}>Pay and actually be protected.</h2>
                <div className="mt-8 space-y-6">
                  {BUYER_POINTS.map((b) => (
                    <div key={b.label}>
                      <h3 className={`font-medium ${lt.fg}`}>{b.label}</h3>
                      <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ AGENTS + EMBED ============================ */}
        <section className={`${section} py-8`} aria-label="For AI agents and developers">
          <div className="grid lg:grid-cols-12 gap-4">
            <Fade className="lg:col-span-5">
              <div className={`${tile} h-full`}>
                <p className={eyebrow}>For AI agents</p>
                <h2 className={`mt-3 ${h2}`}>Let an agent pay. Keep the veto.</h2>
                <p className={`mt-3 text-sm ${lt.muted}`}>{AGENT_INTRO}</p>
                <div className="mt-8 space-y-5">
                  {AGENT_POINTS.map((a) => (
                    <div key={a.label}>
                      <h3 className={`font-medium ${lt.fg}`}>{a.label}</h3>
                      <p className={`mt-1 text-sm leading-relaxed ${lt.muted}`}>{a.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
                  <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnOutline}>API reference</a>
                </div>
              </div>
            </Fade>
            <Fade className="lg:col-span-7" delay={0.1}>
              <div className={`${tile} h-full`}>
                <p className={eyebrow}>Developers</p>
                <h2 className={`mt-3 ${h2}`}>Embed it in your platform.</h2>
                <EmbedExamples className="mt-8" />
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section id="pricing" className={`${section} py-8`} aria-label="Pricing">
          <div className="grid lg:grid-cols-12 gap-4">
            <Fade className="lg:col-span-5">
              <div className={`${lt.accentBg} ${lt.radius} p-6 sm:p-8 h-full`}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#131313]/70">Pricing</p>
                <p className="mt-4 text-[8rem] sm:text-[10rem] leading-none font-medium tracking-tighter text-[#131313]">1%</p>
                <p className="mt-2 text-[#131313]/80">per transaction. Nothing else.</p>
              </div>
            </Fade>
            <Fade className="lg:col-span-7" delay={0.1}>
              <div className={`${tile} h-full`}>
                {PRICING_ROWS.map(([k, v]) => (
                  <div key={k} className={`flex justify-between py-3 border-b last:border-b-0 ${lt.border} text-sm`}>
                    <span className={lt.muted}>{k}</span>
                    <span className={`font-medium ${lt.fg}`}>{v}</span>
                  </div>
                ))}
                <Link href="/merchant-savings-calculator" className={`inline-block mt-4 text-sm font-medium ${lt.accentText}`}>
                  See how much you&apos;d save vs. Stripe, Square or PayPal →
                </Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ BENEFITS + FINAL CTA ============================ */}
        <section className={`${section} pt-8 pb-20`} aria-label="Why switch">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map((b, i) => (
              <Fade key={b.title} delay={i * 0.06}>
                <div className={`${tile} h-full`}>
                  <h3 className={`text-lg font-medium leading-snug ${lt.fg}`}>{b.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                </div>
              </Fade>
            ))}
          </div>
          <Fade delay={0.2}>
            <div className={`${tile} mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-6`}>
              <div>
                <h2 className={h2}>Add stablecoin checkout to your store.</h2>
                <p className={`mt-2 text-sm max-w-md ${lt.muted}`}>Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
              </div>
              <Link href="/plugins" className={lt.btnPrimary}>Explore plugins</Link>
            </div>
          </Fade>
        </section>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
