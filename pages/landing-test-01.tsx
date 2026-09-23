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
 * Landing test 01 — after Stripe.
 * White page, one blurple accent, the angled gradient swash behind a two-line value prop,
 * and the interactive product (the estimator) sitting in the hero itself. Sections run
 * exactly as Stripe's do: partner strip, "solutions for every business model", the product
 * you can play with, how to embed it, then the benefit quotes at the bottom.
 */

const ID = 'lt-01';

const light: LandingTheme = {
  bg: '#ffffff',
  fg: '#0a2540',
  muted: '#425466',
  card: '#ffffff',
  border: '#e6ebf1',
  accent: '#635bff',
  accentFg: '#ffffff',
  accentSoft: '#f6f5ff',
  radius: '12px',
  btnRadius: '8px',
  font: "Inter, system-ui, -apple-system, sans-serif",
  fontDisplay: "Inter, system-ui, -apple-system, sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const dark: LandingTheme = {
  ...light,
  bg: '#0a2540',
  fg: '#ffffff',
  muted: '#a9b8c9',
  card: '#0f2d4d',
  border: '#1f3d61',
  accent: '#8b85ff',
  accentSoft: '#15325a',
};

const eyebrow = `text-xs font-semibold uppercase tracking-[0.15em] ${lt.accentText}`;
const h2 = `mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.15] ${lt.fg}`;
const section = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

export default function LandingTest01() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-01" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        <style>{themeCss(ID, light, dark)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg} transition-colors`} style={{ fontFamily: 'var(--lt-font)' }}>
        {/* Stripe's swash: an angled gradient bleeding off the top-right, clipped so the copy stays on white. */}
        <div className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[30%] right-[-20%] w-[110%] h-[85%] opacity-90 dark:opacity-60"
            style={{
              background: 'linear-gradient(100deg, #ff7a59 0%, #ff4d8d 25%, #a259ff 50%, #4f8dff 75%, #ffd166 100%)',
              transform: 'skewY(-9deg)',
              transformOrigin: 'top right',
              filter: 'blur(40px)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
            }}
          />
          <LandingNav brand={siteName} className="relative z-30 bg-white/70 dark:bg-[#0a2540]/70 backdrop-blur border-b border-white/40 dark:border-white/10" />

          {/* ============================ HERO ============================ */}
          <section className={`relative z-10 ${section} pt-16 pb-20 lg:pt-24 lg:pb-28`} aria-label="Hero">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <p className={`text-sm ${lt.muted}`}>
                  <span className="font-medium">Escrow fee:</span> 1%. Nothing else.
                </p>
                <h1 className={`mt-4 text-4xl sm:text-5xl lg:text-[3.6rem] font-semibold tracking-tight leading-[1.08] ${lt.fg}`}>
                  Stablecoin payments{' '}
                  <span className={lt.accentText}>with buyer protection built in.</span>
                </h1>
                <p className={`mt-6 text-lg leading-relaxed max-w-xl ${lt.muted}`}>
                  Request a payment in a few clicks. Funds sit in escrow until the payout date — your buyer is protected, and you can&apos;t be charged back. No vetting, no gas fees, from your first transaction to your millionth.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/create" className={lt.btnPrimary}>
                    Request payment <span aria-hidden="true">›</span>
                  </Link>
                  <a href="#demo" className={lt.btnOutline}>
                    See the checkout
                  </a>
                </div>
                <Link href="/dashboard" className={`${lt.btnGhost} mt-5 group`}>
                  Already using {siteName}? Go to your dashboard
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
                <div className={`mt-12 flex flex-wrap gap-x-8 gap-y-2 text-xs ${lt.muted}`}>
                  {PROOF_POINTS.map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                  <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
                    Open source
                  </a>
                </div>
              </motion.div>

              <motion.div className="lg:col-span-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
                <EscrowEstimator />
              </motion.div>
            </div>
          </section>
        </div>

        {/* ============================ WORKS WITH ============================ */}
        <section className={`border-y ${lt.border}`} aria-label="Works with">
          <div className={`${section} py-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm font-semibold tracking-wide ${lt.muted}`}>
            {['WordPress', 'Shopify', 'Claude', 'ChatGPT', 'Cursor', 'Base', 'USDC', 'USDT'].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </section>

        {/* ============================ AUDIENCES ============================ */}
        <section className={`${section} py-24`} aria-label="Who it is for">
          <Fade>
            <p className={eyebrow}>Solutions</p>
            <h2 className={h2}>
              Flexible escrow for every business model.{' '}
              <span className={lt.muted}>Grow the ways you get paid.</span>
            </h2>
          </Fade>
          <Fade delay={0.1}>
            <AudienceTabs className="mt-10" columns={4} />
          </Fade>
        </section>

        {/* ============================ HOW IT WORKS ============================ */}
        <section className={`${lt.accentSoft}`} aria-label="How it works">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>How it works</p>
              <h2 className={h2}>Three steps. No one in the middle.</h2>
            </Fade>
            <div className="mt-14 grid md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map((s, i) => (
                <Fade key={s.num} delay={i * 0.1}>
                  <div className={`p-6 ${lt.card} ${lt.radius} border ${lt.border} h-full`}>
                    <span className={`inline-flex w-9 h-9 items-center justify-center rounded-full text-sm font-semibold ${lt.accentBg} text-[color:var(--lt-accent-fg)]`}>
                      {i + 1}
                    </span>
                    <h3 className={`mt-4 text-lg font-semibold ${lt.fg}`}>{s.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ EMBED ============================ */}
        <section className={`${section} py-24`} aria-label="Embed in your platform">
          <Fade>
            <p className={eyebrow}>Developers</p>
            <h2 className={h2}>Embed it in your platform in an afternoon.</h2>
            <p className={`mt-4 max-w-xl ${lt.muted}`}>
              A plugin for WordPress and Shopify, one script tag for everything else, and one URL for any AI agent. No backend to write, no keys to keep.
            </p>
          </Fade>
          <Fade delay={0.1}>
            <EmbedExamples className="mt-10" layout="side" />
          </Fade>
        </section>

        {/* ============================ LIVE DEMO ============================ */}
        <section id="demo" className={`border-t ${lt.border}`} aria-label="Try the checkout">
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
              <div className={`p-6 ${lt.radius} border ${lt.border} ${lt.card} shadow-lg`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${lt.fg}`}>Basic Product — One-time Payment</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${lt.accentSoft} ${lt.fg}`}>USDC</span>
                </div>
                <p className={`mt-6 text-4xl font-semibold tracking-tight ${lt.fg}`}>$0.001</p>
                <p className={`mt-1 text-xs ${lt.muted}`}>Held in escrow until the payout date. Dispute before then to freeze it.</p>
                <div className={`mt-6 h-11 ${lt.btnRadius} ${lt.accentBg} text-[color:var(--lt-accent-fg)] flex items-center justify-center text-sm font-medium`}>Pay with USDC</div>
                <p className={`mt-3 text-[11px] text-center ${lt.muted}`}>Sign in with Google or email · gas covered</p>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ MERCHANTS ============================ */}
        <section className={lt.accentSoft} aria-label="For merchants">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>For merchants</p>
              <h2 className={h2}>Everything traditional processors take from you, we don&apos;t.</h2>
            </Fade>
            <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {MERCHANT_POINTS.map((m, i) => (
                <Fade key={m.label} delay={i * 0.05}>
                  <div className={`p-6 h-full ${lt.card} ${lt.radius} border ${lt.border}`}>
                    <h3 className={`font-semibold ${lt.fg}`}>{m.label}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.3}>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
                <Link href="/merchant-savings-calculator" className={lt.btnOutline}>Calculate savings</Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ BUYERS ============================ */}
        <section className={`${section} py-24`} aria-label="For buyers">
          <Fade>
            <p className={eyebrow}>For buyers</p>
            <h2 className={h2}>Pay with stablecoins and actually be protected.</h2>
          </Fade>
          <div className="mt-14 grid sm:grid-cols-2 gap-x-12 gap-y-10">
            {BUYER_POINTS.map((b, i) => (
              <Fade key={b.label} delay={i * 0.05}>
                <div className="flex gap-4">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${lt.accentBg}`} aria-hidden="true" />
                  <div>
                    <h3 className={`font-semibold ${lt.fg}`}>{b.label}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                  </div>
                </div>
              </Fade>
            ))}
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
            <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
              {AGENT_POINTS.map((a, i) => (
                <Fade key={a.label} delay={i * 0.05}>
                  <div>
                    <h3 className={`font-semibold ${lt.fg}`}>{a.label}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{a.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.3}>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
                <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnOutline}>API reference</a>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section id="pricing" className={lt.accentSoft} aria-label="Pricing">
          <div className={`${section} py-24 grid lg:grid-cols-2 gap-12 items-center`}>
            <Fade>
              <p className={eyebrow}>Pricing</p>
              <p className={`mt-2 text-[7rem] sm:text-[9rem] leading-none font-semibold tracking-tighter ${lt.fg}`}>
                1<span className={lt.accentText}>%</span>
              </p>
              <p className={`mt-2 ${lt.muted}`}>per transaction. Nothing else.</p>
            </Fade>
            <Fade delay={0.1}>
              <div className={`p-6 ${lt.card} ${lt.radius} border ${lt.border}`}>
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
        <section className={`${section} py-24`} aria-label="Why switch">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {BENEFITS.map((b, i) => (
              <Fade key={b.title} delay={i * 0.06}>
                <div className={`border-l-2 pl-5 border-[color:var(--lt-accent)]`}>
                  <h3 className={`text-lg font-semibold leading-snug ${lt.fg}`}>{b.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                </div>
              </Fade>
            ))}
          </div>
          <Fade delay={0.2}>
            <div className={`mt-20 p-8 sm:p-12 ${lt.radius} ${lt.accentBg} text-[color:var(--lt-accent-fg)] flex flex-col md:flex-row md:items-center md:justify-between gap-6`}>
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Add stablecoin checkout to your store.</h2>
                <p className="mt-2 text-sm opacity-90 max-w-md">Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
              </div>
              <Link href="/plugins" className={`${lt.btnOutline} !border-white/40 !text-[color:var(--lt-accent-fg)] hover:!bg-white/10`}>
                Explore plugins
              </Link>
            </div>
          </Fade>
        </section>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
