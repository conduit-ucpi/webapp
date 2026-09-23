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
import EscrowTimeline from '@/components/landing-test/EscrowTimeline';
import { LandingTheme, lt, themeCss } from '@/components/landing-test/theme';
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
 * Landing test 04 — editorial.
 * Stripe's "interactive product UI" idea taken literally: the hero's right-hand side is
 * the escrow itself, stepping through Create → Fund → Release on its own, and you can
 * click any step. Around it, Mercury's copy-first approach on a cream page with a serif
 * display face — the quiet, expensive look — and a terracotta accent used sparingly.
 */

const ID = 'lt-04';

const light: LandingTheme = {
  bg: '#f8f5ef',
  fg: '#1c1a17',
  muted: '#6b655c',
  card: '#ffffff',
  border: '#e6e0d4',
  accent: '#c2410c',
  accentFg: '#ffffff',
  accentSoft: '#f6ebe2',
  radius: '6px',
  btnRadius: '6px',
  font: "Inter, system-ui, -apple-system, sans-serif",
  fontDisplay: "'Newsreader', Georgia, 'Times New Roman', serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const dark: LandingTheme = {
  ...light,
  bg: '#181613',
  fg: '#f3efe7',
  muted: '#a49d91',
  card: '#221f1b',
  border: '#37322b',
  accent: '#f0834f',
  accentSoft: '#2e2520',
};

const section = 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8';
const display = { fontFamily: 'var(--lt-font-display)' } as const;
const h2 = `text-4xl sm:text-5xl font-light leading-[1.1] tracking-tight ${lt.fg}`;
const eyebrow = `text-xs uppercase tracking-[0.2em] ${lt.muted}`;

export default function LandingTest04() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-04" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500&display=swap" rel="stylesheet" />
        <style>{themeCss(ID, light, dark)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg} transition-colors`} style={{ fontFamily: 'var(--lt-font)' }}>
        <LandingNav brand={siteName} className={`border-b ${lt.border}`} />

        {/* ============================ HERO ============================ */}
        <section className={`${section} pt-20 pb-24 lg:pt-28 lg:pb-32`} aria-label="Hero">
          <div className="grid lg:grid-cols-12 gap-14 items-center">
            <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className={eyebrow}>Escrow for stablecoins</p>
              <h1 className={`mt-5 text-5xl sm:text-6xl lg:text-[4.6rem] font-light leading-[1.02] tracking-tight ${lt.fg}`} style={display}>
                Accept stablecoin payments.
                <br />
                <em className={`not-italic ${lt.accentText}`}>Protect both sides.</em>
              </h1>
              <p className={`mt-7 text-lg leading-relaxed max-w-xl ${lt.muted}`} style={display}>
                Create a payment request in a few clicks. Funds sit in escrow until the payout date — your buyer is protected, and you can&apos;t be charged back. No vetting, no gas fees.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/create" className={lt.btnPrimary}>Request payment</Link>
                <a href="#estimate" className={lt.btnOutline}>Estimate a payment</a>
              </div>
              <Link href="/dashboard" className={`${lt.btnGhost} mt-5 group`}>
                Already using {siteName}? Go to your dashboard
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <div className={`mt-12 flex flex-wrap gap-x-8 gap-y-2 text-xs ${lt.muted}`}>
                {PROOF_POINTS.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">Open source</a>
              </div>
            </motion.div>
            <motion.div className="lg:col-span-5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <EscrowTimeline />
            </motion.div>
          </div>
        </section>

        {/* ============================ THE DIFFERENCE (copy-first) ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Stop losing money to fees">
          <div className={`${section} py-24 grid lg:grid-cols-12 gap-12`}>
            <Fade className="lg:col-span-5">
              <p className={eyebrow}>The difference</p>
              <h2 className={`mt-4 ${h2}`} style={display}>Stop losing money to fees.</h2>
            </Fade>
            <Fade className="lg:col-span-7" delay={0.1}>
              <p className={`text-lg leading-relaxed ${lt.fg}`} style={display}>
                A card processor stands between you and your customer and charges rent for the privilege: a percentage, a fixed fee per sale, a reserve it holds back, a penalty for every chargeback, and a three-day wait for what&apos;s left. It does that in exchange for one thing — the buyer&apos;s confidence that they can get their money back.
              </p>
              <p className={`mt-5 text-lg leading-relaxed ${lt.fg}`} style={display}>
                An escrow contract gives the buyer that same confidence directly. The money is locked where neither side can reach it until a date you both agreed. There is nothing left for a processor to do, so there is nothing left for one to charge.
              </p>
              <div className={`mt-8 border-t ${lt.border}`}>
                {FEE_COMPARISON.map((r) => (
                  <div key={r.item} className={`grid grid-cols-3 py-3 text-sm border-b ${lt.border}`}>
                    <span className={lt.muted}>{r.item}</span>
                    <span className={lt.muted}>{r.processor}</span>
                    <span className={`font-medium ${lt.fg}`}>{r.us}</span>
                  </div>
                ))}
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ ESTIMATOR ============================ */}
        <section id="estimate" className={`border-t ${lt.border} ${lt.card}`} aria-label="Estimate a payment">
          <div className={`${section} py-24 grid lg:grid-cols-2 gap-12 items-start`}>
            <Fade>
              <p className={eyebrow}>Estimate</p>
              <h2 className={`mt-4 ${h2}`} style={display}>What a payment costs, and what it&apos;s worth today.</h2>
              <p className={`mt-5 max-w-md ${lt.muted}`}>
                Set the amount and the payout date. See the fee, what the seller receives, what a card processor would have taken, and roughly what the payment would fetch if you sold it early on the liquidity marketplace.
              </p>
              <Link href="/liquidity" className={`${lt.btnGhost} mt-6 !text-[color:var(--lt-accent)]`}>
                About the liquidity marketplace <span aria-hidden="true">→</span>
              </Link>
            </Fade>
            <Fade delay={0.1}>
              <EscrowEstimator />
            </Fade>
          </div>
        </section>

        {/* ============================ AUDIENCES ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Who it is for">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>Who it&apos;s for</p>
              <h2 className={`mt-4 ${h2}`} style={display}>Personal, business, platform.</h2>
            </Fade>
            <Fade delay={0.1}>
              <AudienceTabs className="mt-10" />
            </Fade>
          </div>
        </section>

        {/* ============================ HOW IT WORKS ============================ */}
        <section className={`border-t ${lt.border} ${lt.card}`} aria-label="How it works">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>How it works</p>
            </Fade>
            <div className="mt-12 grid md:grid-cols-3 gap-x-12 gap-y-14">
              {HOW_IT_WORKS.map((s, i) => (
                <Fade key={s.num} delay={i * 0.1}>
                  <span className={`block text-[5rem] leading-none font-light ${lt.accentText} opacity-40`} style={display}>{s.num}</span>
                  <h3 className={`mt-3 text-2xl font-light ${lt.fg}`} style={display}>{s.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ LIVE DEMO ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Try the checkout">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>Live demo</p>
              <h2 className={`mt-4 ${h2}`} style={display}>See what your customers see.</h2>
              <p className={`mt-5 max-w-md ${lt.muted}`}>
                This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site.
              </p>
              <DemoButtons className="mt-8" />
            </Fade>
          </div>
        </section>

        {/* ============================ MERCHANTS ============================ */}
        <section className={`border-t ${lt.border} ${lt.card}`} aria-label="For merchants">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>For merchants</p>
              <h2 className={`mt-4 ${h2} max-w-2xl`} style={display}>Everything traditional processors take from you, we don&apos;t.</h2>
            </Fade>
            <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
              {MERCHANT_POINTS.map((m, i) => (
                <Fade key={m.label} delay={i * 0.05}>
                  <h3 className={`text-lg ${lt.fg}`} style={display}>{m.label}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                </Fade>
              ))}
            </div>
            <Fade delay={0.3}>
              <div className="mt-12 flex flex-wrap gap-3">
                <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
                <Link href="/merchant-savings-calculator" className={lt.btnOutline}>Calculate savings</Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ BUYERS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="For buyers">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>For buyers</p>
              <h2 className={`mt-4 ${h2} max-w-2xl`} style={display}>Pay with stablecoins and actually be protected.</h2>
            </Fade>
            <div className="mt-14 grid sm:grid-cols-2 gap-x-12 gap-y-10">
              {BUYER_POINTS.map((b, i) => (
                <Fade key={b.label} delay={i * 0.05}>
                  <h3 className={`text-lg ${lt.fg}`} style={display}>{b.label}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ AGENTS ============================ */}
        <section className={`border-t ${lt.border} ${lt.card}`} aria-label="For AI agents">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>For AI agents</p>
              <h2 className={`mt-4 ${h2} max-w-2xl`} style={display}>Let an agent pay on your behalf. Keep the right to object.</h2>
              <p className={`mt-5 max-w-xl ${lt.muted}`}>{AGENT_INTRO}</p>
            </Fade>
            <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
              {AGENT_POINTS.map((a, i) => (
                <Fade key={a.label} delay={i * 0.05}>
                  <h3 className={`text-lg ${lt.fg}`} style={display}>{a.label}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{a.text}</p>
                </Fade>
              ))}
            </div>
            <Fade delay={0.3}>
              <div className="mt-12 flex flex-wrap gap-3">
                <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
                <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnOutline}>API reference</a>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ EMBED ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Embed in your platform">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={eyebrow}>Developers</p>
              <h2 className={`mt-4 ${h2}`} style={display}>Embed it in your platform.</h2>
            </Fade>
            <Fade delay={0.1}>
              <EmbedExamples className="mt-10" layout="side" />
            </Fade>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section id="pricing" className={`border-t ${lt.border} ${lt.card}`} aria-label="Pricing">
          <div className={`${section} py-24 grid lg:grid-cols-2 gap-12 items-center`}>
            <Fade>
              <p className={eyebrow}>Pricing</p>
              <p className={`mt-2 text-[8rem] sm:text-[11rem] leading-none font-light tracking-tighter ${lt.fg}`} style={display}>
                1<span className={lt.accentText}>%</span>
              </p>
              <p className={`mt-2 ${lt.muted}`}>per transaction. Nothing else.</p>
            </Fade>
            <Fade delay={0.1}>
              <div>
                {PRICING_ROWS.map(([k, v]) => (
                  <div key={k} className={`flex justify-between py-3 border-b ${lt.border} text-sm`}>
                    <span className={lt.muted}>{k}</span>
                    <span className={`font-medium ${lt.fg}`}>{v}</span>
                  </div>
                ))}
                <Link href="/merchant-savings-calculator" className={`inline-block mt-4 text-sm ${lt.accentText}`}>
                  See how much you&apos;d save vs. Stripe, Square or PayPal
                </Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ BENEFITS + FINAL CTA ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Why switch">
          <div className={`${section} py-24`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {BENEFITS.map((b, i) => (
                <Fade key={b.title} delay={i * 0.06}>
                  <p className={`text-2xl leading-snug ${lt.fg}`} style={display}>&ldquo;{b.title}.&rdquo;</p>
                  <p className={`mt-3 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                </Fade>
              ))}
            </div>
            <Fade delay={0.2}>
              <div className={`mt-20 pt-12 border-t ${lt.border}`}>
                <h2 className={`${h2}`} style={display}>Add stablecoin checkout to your store.</h2>
                <p className={`mt-4 max-w-md ${lt.muted}`}>Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
                <Link href="/plugins" className={`${lt.btnPrimary} mt-8`}>Explore plugins</Link>
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
