import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { motion } from 'framer-motion';
import SEO from '@/components/SEO';
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
  FAQ_SHORT,
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
 * Landing test 10 — "one screen", in 05's colours.
 * The bet that people decide above the fold: a headline, the three things you can do,
 * the estimator, and the four benefits. Everything else is still on the page — same
 * inventory as the other nine — but folded into an accordion the visitor opens if they
 * want the detail. Pricing and the FAQ start open because those are the two questions.
 */

const ID = 'lt-10';
const section = 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8';
const eyebrow = `text-xs font-medium uppercase tracking-[0.18em] ${lt.accentText}`;
const card = `${lt.card} border ${lt.border} ${lt.radius}`;

function Fold({ id, title, summary, open, children }: { id?: string; title: string; summary: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details id={id} open={open} className={`group ${card} open:border-[color:var(--lt-accent)]`}>
      <summary className="list-none cursor-pointer select-none px-6 py-5 flex items-center justify-between gap-6">
        <span>
          <span className={`block text-xl font-medium ${lt.fg}`}>{title}</span>
          <span className={`block mt-1 text-sm ${lt.muted}`}>{summary}</span>
        </span>
        <span aria-hidden="true" className={`shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-full border ${lt.border} ${lt.fg} transition-transform group-open:rotate-45`}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" /></svg>
        </span>
      </summary>
      <div className={`px-6 pb-6 pt-1 border-t ${lt.border}`}>{children}</div>
    </details>
  );
}

function Points({ items }: { items: ReadonlyArray<{ label: string; text: string }> }) {
  return (
    <div className="mt-5 grid sm:grid-cols-2 gap-x-8 gap-y-5">
      {items.map((p) => (
        <div key={p.label}>
          <h3 className={`font-semibold ${lt.fg}`}>{p.label}</h3>
          <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{p.text}</p>
        </div>
      ))}
    </div>
  );
}

export default function LandingTest10() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-10" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href={BENTO_FONTS_HREF} rel="stylesheet" />
        <style>{themeCss(ID, BENTO, BENTO)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <LandingNav brand={siteName} className={`sticky top-0 z-40 bg-[#131313]/85 backdrop-blur border-b ${lt.border}`} />

        {/* ============================ THE SCREEN ============================ */}
        <section className={`${section} pt-14 pb-12 lg:pt-20`} aria-label="Hero">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className={eyebrow}>Stablecoin escrow · 1% · no chargebacks</p>
              <h1 className={`mt-5 text-4xl sm:text-5xl lg:text-[3.8rem] font-medium tracking-tight leading-[1.02] ${lt.fg}`}>
                Get paid in stablecoins. <span className={lt.accentText}>Your buyer is protected. You can&apos;t be charged back.</span>
              </h1>
              <p className={`mt-6 text-lg leading-relaxed max-w-xl ${lt.muted}`}>
                Funds sit in an open-source contract until the payout date. No processor, no reserve, no approval. Three things you can do right now:
              </p>

              <div className="mt-8 grid sm:grid-cols-3 gap-3">
                <Link href="/create" className={`${lt.btnPrimary} w-full`}>Request payment</Link>
                <Link href="/dashboard" className={`${lt.btnSecondary} w-full`}>Go to your dashboard</Link>
                <Link href="/plugins#mcp" className={`${lt.btnSecondary} w-full`}>Connect an agent</Link>
              </div>

              <div className={`mt-6 ${card} p-5`}>
                <p className={`font-medium ${lt.fg}`}>See what your customers see.</p>
                <p className={`mt-1 text-sm ${lt.muted}`}>The actual checkout, for a real $0.001 USDC payment.</p>
                <DemoButtons className="mt-4" />
              </div>

              <div className={`mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs ${lt.muted}`}>
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

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map((b, i) => (
              <motion.div key={b.title} className={`${card} p-5`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }}>
                <h3 className={`font-semibold leading-snug ${lt.fg}`}>{b.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============================ THE ACCORDION ============================ */}
        <section className={`${section} pb-20`} aria-label="Everything else">
          <p className={`${eyebrow} mb-4`}>The detail, if you want it</p>
          <div className="space-y-3">
            <Fold title="How it works" summary="Create, fund, release. Nothing in between.">
              <div className="mt-5 grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((s) => (
                  <div key={s.num}>
                    <span className={`text-sm ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>{s.num}</span>
                    <h3 className={`mt-2 text-xl font-medium ${lt.fg}`}>{s.title}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link href="/how-it-works" className={lt.btnSecondary}>Watch a payment happen</Link>
              </div>
            </Fold>

            <Fold id="pricing" title="Pricing" summary="1% per transaction. Nothing else." open>
              <div className="mt-5 grid lg:grid-cols-12 gap-8 items-center">
                <p className={`lg:col-span-4 text-[6rem] sm:text-[8rem] leading-none font-medium tracking-tighter ${lt.accentText}`}>1%</p>
                <div className="lg:col-span-8">
                  {PRICING_ROWS.map(([k, v]) => (
                    <div key={k} className={`flex justify-between py-2.5 border-b ${lt.border} text-sm`}>
                      <span className={lt.muted}>{k}</span>
                      <span className={`font-semibold ${lt.fg}`}>{v}</span>
                    </div>
                  ))}
                  <Link href="/merchant-savings-calculator" className={`${lt.btnSecondary} mt-5`}>
                    See how much you&apos;d save vs. Stripe, Square or PayPal
                  </Link>
                </div>
              </div>
            </Fold>

            <Fold title="For merchants" summary="Everything traditional processors take from you, we don't.">
              <Points items={MERCHANT_POINTS} />
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
                <Link href="/merchant-savings-calculator" className={lt.btnSecondary}>Calculate savings</Link>
              </div>
            </Fold>

            <Fold title="For buyers" summary="Pay with stablecoins and actually be protected.">
              <Points items={BUYER_POINTS} />
            </Fold>

            <Fold title="For AI agents" summary="Let an agent pay on your behalf. Keep the right to object.">
              <p className={`mt-5 text-sm ${lt.muted}`}>{AGENT_INTRO}</p>
              <Points items={AGENT_POINTS} />
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
                <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>API reference</a>
              </div>
            </Fold>

            <Fold title="Who it's for" summary="Personal, business, platform — and everywhere there is an email address.">
              <AudienceTabs className="mt-5" columns={4} />
            </Fold>

            <Fold title="Embed it in your platform" summary="WordPress, Shopify, any website, any AI agent.">
              <EmbedExamples className="mt-5" />
            </Fold>

            <Fold title="Questions people ask first" summary="Wallets, refunds, custody, cost, early payment." open>
              <dl className="mt-5 divide-y divide-[color:var(--lt-border)]">
                {FAQ_SHORT.map((f) => (
                  <div key={f.q} className="py-4 grid sm:grid-cols-12 gap-2">
                    <dt className={`sm:col-span-5 font-medium ${lt.fg}`}>{f.q}</dt>
                    <dd className={`sm:col-span-7 text-sm leading-relaxed ${lt.muted}`}>{f.a}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                <Link href="/faq" className={lt.btnSecondary}>All questions</Link>
              </div>
            </Fold>
          </div>

          <div className={`mt-10 ${lt.accentBg} ${lt.radius} p-8 text-[#131313] flex flex-col md:flex-row md:items-center md:justify-between gap-6`}>
            <div>
              <h2 className="text-3xl font-medium tracking-tight">Add stablecoin checkout to your store.</h2>
              <p className="mt-2 text-sm opacity-80 max-w-md">Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
            </div>
            <Link href="/plugins" className={`${lt.btnPrimary} !bg-[#131313] !text-[#c8ff3d]`}>Explore plugins</Link>
          </div>
        </section>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
