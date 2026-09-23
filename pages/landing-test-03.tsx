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
 * Landing test 03 — after Wise.
 * One loud colour, a condensed all-caps headline that fills the width, pill buttons, and
 * the calculator card front and centre in the hero. Personal / Business / Platform sit in
 * the nav as well as in the body, and "works everywhere" gets its own strip.
 */

const ID = 'lt-03';

const light: LandingTheme = {
  bg: '#9fe870',
  fg: '#163300',
  muted: '#2f5a12',
  card: '#ffffff',
  border: '#c4eaa9',
  accent: '#163300',
  accentFg: '#9fe870',
  accentSoft: '#e6f7d9',
  radius: '24px',
  btnRadius: '999px',
  font: "Inter, system-ui, -apple-system, sans-serif",
  fontDisplay: "'Anton', Impact, 'Arial Narrow Bold', sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const dark: LandingTheme = {
  ...light,
  bg: '#163300',
  fg: '#e9ffd8',
  muted: '#b7e39a',
  card: '#1f4700',
  border: '#2f6b0a',
  accent: '#9fe870',
  accentFg: '#163300',
  accentSoft: '#25520a',
};

const section = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
const display = { fontFamily: 'var(--lt-font-display)' } as const;
const h2 = `text-4xl sm:text-5xl uppercase leading-[0.95] tracking-tight ${lt.fg}`;

/** Wise alternates its loud green with white bands; each body section picks one. */
const whiteBand = 'bg-white text-[#163300] dark:bg-[#0f2400] dark:text-[#e9ffd8]';

export default function LandingTest03() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-03" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet" />
        <style>{themeCss(ID, light, dark)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg} transition-colors`} style={{ fontFamily: 'var(--lt-font)' }}>
        <LandingNav brand={siteName} ctaLabel="Get paid" />

        {/* ============================ HERO ============================ */}
        <section className={`${section} pt-12 pb-20 lg:pt-16 lg:pb-28`} aria-label="Hero">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className={`text-[3.4rem] sm:text-[5rem] lg:text-[6.2rem] uppercase leading-[0.92] tracking-tight ${lt.fg}`} style={display}>
                The escrow
                <br />
                for home
                <br />
                and abroad
              </h1>
              <p className={`mt-6 text-lg sm:text-xl font-medium max-w-xl ${lt.fg}`}>
                Get paid in stablecoins with buyer protection, wherever you and your customer are — with a fee as low as 1%.
              </p>
              <ul className={`mt-8 space-y-3 text-base ${lt.fg}`}>
                <li className="flex items-center gap-3">
                  <Bullet /> <span><strong>Low fees</strong> — 1% flat, no monthly, no chargeback fees</span>
                </li>
                <li className="flex items-center gap-3">
                  <Bullet /> <span><strong>Lightning fast</strong> — money moves in seconds on the payout date</span>
                </li>
                <li className="flex items-center gap-3">
                  <Bullet /> <span><strong>Perfectly predictable</strong> — funds are locked until the date both sides agreed</span>
                </li>
              </ul>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/create" className={`${lt.btnPrimary} !px-8`}>
                  Request a payment in a few clicks
                </Link>
                <a href="#demo" className={`${lt.btnGhost} underline underline-offset-4 font-medium !text-[color:var(--lt-fg)]`}>
                  See the checkout
                </a>
              </div>
              <Link href="/dashboard" className={`${lt.btnGhost} mt-5 !text-[color:var(--lt-muted)]`}>
                Already using {siteName}? Go to your dashboard <span aria-hidden="true">→</span>
              </Link>
              <div className={`mt-10 flex flex-wrap gap-x-8 gap-y-2 text-xs font-medium ${lt.muted}`}>
                {PROOF_POINTS.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">Open source</a>
              </div>
            </motion.div>

            <motion.div className="lg:col-span-5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              <EscrowEstimator ctaLabel="Get paid" />
            </motion.div>
          </div>
        </section>

        {/* ============================ WORKS EVERYWHERE / AUDIENCES ============================ */}
        <section className={whiteBand} aria-label="Who it is for">
          <div className={`${section} py-24`}>
            <Fade>
              <h2 className={h2} style={display}>Personal. Business. Platform.</h2>
              <p className={`mt-4 text-lg max-w-xl ${lt.muted}`}>Pick who you are and see how people like you use it.</p>
            </Fade>
            <Fade delay={0.1}>
              <AudienceTabs className="mt-10" columns={4} />
            </Fade>
          </div>
        </section>

        {/* ============================ HOW IT WORKS ============================ */}
        <section className={`${section} py-24`} aria-label="How it works">
          <Fade>
            <h2 className={h2} style={display}>How it works</h2>
          </Fade>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((s, i) => (
              <Fade key={s.num} delay={i * 0.1}>
                <div className={`p-7 ${lt.card} ${lt.radius} h-full`}>
                  <span className={`text-5xl ${lt.accentText}`} style={display}>{s.num}</span>
                  <h3 className={`mt-4 text-2xl font-semibold ${lt.fg}`}>{s.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                </div>
              </Fade>
            ))}
          </div>
        </section>

        {/* ============================ LIVE DEMO ============================ */}
        <section id="demo" className={whiteBand} aria-label="Try the checkout">
          <div className={`${section} py-24`}>
            <Fade>
              <h2 className={h2} style={display}>See what your customers see</h2>
              <p className={`mt-4 max-w-md ${lt.muted}`}>
                This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site.
              </p>
              <DemoButtons className="mt-8" />
            </Fade>
          </div>
        </section>

        {/* ============================ MERCHANTS ============================ */}
        <section className={`${section} py-24`} aria-label="For merchants">
          <Fade>
            <p className={`text-sm font-semibold uppercase tracking-wider ${lt.muted}`}>For merchants</p>
            <h2 className={`mt-3 ${h2}`} style={display}>Unlike processors, all our fees are low and up front.</h2>
          </Fade>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MERCHANT_POINTS.map((m, i) => (
              <Fade key={m.label} delay={i * 0.05}>
                <div className={`p-6 ${lt.card} ${lt.radius} h-full`}>
                  <h3 className={`text-lg font-semibold ${lt.fg}`}>{m.label}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                </div>
              </Fade>
            ))}
          </div>
          <Fade delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
              <Link href="/merchant-savings-calculator" className={`${lt.btnOutline} !border-[color:var(--lt-fg)]`}>Calculate savings</Link>
            </div>
          </Fade>
        </section>

        {/* ============================ BUYERS ============================ */}
        <section className={whiteBand} aria-label="For buyers">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={`text-sm font-semibold uppercase tracking-wider ${lt.muted}`}>For buyers</p>
              <h2 className={`mt-3 ${h2}`} style={display}>Pay and actually be protected.</h2>
            </Fade>
            <div className="mt-12 grid sm:grid-cols-2 gap-x-12 gap-y-10">
              {BUYER_POINTS.map((b, i) => (
                <Fade key={b.label} delay={i * 0.05}>
                  <div className="flex gap-4">
                    <Bullet />
                    <div>
                      <h3 className={`text-lg font-semibold ${lt.fg}`}>{b.label}</h3>
                      <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                    </div>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ AGENTS ============================ */}
        <section className={`${section} py-24`} aria-label="For AI agents">
          <Fade>
            <p className={`text-sm font-semibold uppercase tracking-wider ${lt.muted}`}>For AI agents</p>
            <h2 className={`mt-3 ${h2}`} style={display}>Let an agent pay. Keep the veto.</h2>
            <p className={`mt-4 max-w-xl ${lt.muted}`}>{AGENT_INTRO}</p>
          </Fade>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {AGENT_POINTS.map((a, i) => (
              <Fade key={a.label} delay={i * 0.05}>
                <div className={`p-6 ${lt.card} ${lt.radius} h-full`}>
                  <h3 className={`text-lg font-semibold ${lt.fg}`}>{a.label}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{a.text}</p>
                </div>
              </Fade>
            ))}
          </div>
          <Fade delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
              <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={`${lt.btnOutline} !border-[color:var(--lt-fg)]`}>API reference</a>
            </div>
          </Fade>
        </section>

        {/* ============================ EMBED ============================ */}
        <section className={whiteBand} aria-label="Embed in your platform">
          <div className={`${section} py-24`}>
            <Fade>
              <h2 className={h2} style={display}>Works everywhere you sell</h2>
              <p className={`mt-4 max-w-xl ${lt.muted}`}>WordPress, Shopify, any website, any AI agent. Pick yours.</p>
            </Fade>
            <Fade delay={0.1}>
              <EmbedExamples className="mt-10" />
            </Fade>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section id="pricing" className={`${section} py-24`} aria-label="Pricing">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Fade>
              <p className={`text-[9rem] sm:text-[12rem] leading-none ${lt.fg}`} style={display}>
                1%
              </p>
              <p className={`mt-2 text-lg font-medium ${lt.fg}`}>per transaction. Nothing else.</p>
            </Fade>
            <Fade delay={0.1}>
              <div className={`${lt.card} ${lt.radius} p-7`}>
                {PRICING_ROWS.map(([k, v]) => (
                  <div key={k} className={`flex justify-between py-3 border-b last:border-b-0 ${lt.border} text-sm`}>
                    <span className={lt.muted}>{k}</span>
                    <span className={`font-semibold ${lt.fg}`}>{v}</span>
                  </div>
                ))}
                <Link href="/merchant-savings-calculator" className={`inline-block mt-4 text-sm font-semibold underline underline-offset-4 ${lt.fg}`}>
                  See how much you&apos;d save vs. Stripe, Square or PayPal
                </Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ BENEFITS + FINAL CTA ============================ */}
        <section className={whiteBand} aria-label="Why switch">
          <div className={`${section} py-24`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {BENEFITS.map((b, i) => (
                <Fade key={b.title} delay={i * 0.06}>
                  <div>
                    <h3 className={`text-2xl uppercase leading-tight ${lt.fg}`} style={display}>{b.title}</h3>
                    <p className={`mt-3 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.2}>
              <div className={`mt-20 p-8 sm:p-12 ${lt.radius} ${lt.bg} flex flex-col md:flex-row md:items-center md:justify-between gap-6`}>
                <div>
                  <h2 className={`text-3xl sm:text-4xl uppercase leading-none ${lt.fg}`} style={display}>Add stablecoin checkout to your store</h2>
                  <p className={`mt-3 text-sm max-w-md ${lt.muted}`}>Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
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

function Bullet() {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 w-7 h-7 rounded-full items-center justify-center border ${lt.border} ${lt.card}`}>
      <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
    </span>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
