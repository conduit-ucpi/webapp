import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { motion } from 'framer-motion';
import SEO from '@/components/SEO';
import Fade from '@/components/ui/Fade';
import { financialServiceSchema, articleSchema } from '@/utils/structuredData';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { isr } from '@/utils/isr';
import { MIN_AMOUNT, feeFor, netFor } from '@/utils/escrowFees';
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
  DISPUTE_FLOW,
  FEE_COMPARISON,
  HOW_IT_WORKS,
  MERCHANT_POINTS,
  PRICING_ROWS,
  PROOF_POINTS,
  SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SEO_TITLE,
  SOURCE_URL,
  demoCheckoutUrl,
} from '@/components/landing-test/content';

/*
 * Landing test 07 — "centred narrative", in 05's colours.
 * Mercury's shape: everything centred in one narrow column, an amount field in the hero
 * with the two buttons under it, then a story told top to bottom — the fees you stop
 * paying, what happens on a dispute, how it works — with the estimator in the middle.
 */

const ID = 'lt-07';
const col = 'max-w-3xl mx-auto px-4 sm:px-6';
const wide = 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8';
const eyebrow = `text-xs font-medium uppercase tracking-[0.18em] ${lt.accentText}`;
const h2 = `mt-3 text-3xl sm:text-[2.6rem] font-medium tracking-tight leading-[1.1] ${lt.fg}`;
const card = `${lt.card} border ${lt.border} ${lt.radius}`;
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LandingTest07() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  const [amountText, setAmountText] = useState('1,200');
  const amount = useMemo(() => {
    const n = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [amountText]);
  const ok = amount >= MIN_AMOUNT;

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-07" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href={BENTO_FONTS_HREF} rel="stylesheet" />
        <style>{themeCss(ID, BENTO, BENTO)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg}`} style={{ fontFamily: 'var(--lt-font)' }}>
        <div className={`${lt.accentBg} text-[#131313] text-center text-sm font-medium py-2.5 px-4`}>
          <Link href="/plugins#mcp" className="hover:underline">
            New: let Claude or ChatGPT pay for you, with a human veto <span aria-hidden="true">→</span>
          </Link>
        </div>
        <LandingNav brand={siteName} className={`sticky top-0 z-40 bg-[#131313]/85 backdrop-blur border-b ${lt.border}`} />

        {/* ============================ HERO ============================ */}
        <section className="relative overflow-hidden" aria-label="Hero">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(50% 45% at 50% 0%, rgba(200,255,61,0.16) 0%, rgba(19,19,19,0) 70%)' }} />
          <div className={`relative ${col} pt-20 pb-24 lg:pt-28 lg:pb-32 text-center`}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.02] ${lt.fg}`}>
                Radically different <span className={lt.accentText}>payments.</span>
              </h1>
              <p className={`mt-6 text-lg sm:text-xl max-w-2xl mx-auto ${lt.muted}`}>
                Get paid in stablecoins into an escrow that protects your buyer and can never be charged back. No processor, no reserve, no approval. One percent.
              </p>

              <form className={`mt-10 ${card} p-3 sm:p-4 text-left`} onSubmit={(e) => e.preventDefault()} aria-label="Quick estimate">
                <label className={`flex items-center gap-3 px-3 py-2 rounded-[12px] ${lt.bg}`}>
                  <span className={`text-sm ${lt.muted}`}>Amount</span>
                  <input
                    aria-label="Amount to request"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    className={`w-full bg-transparent py-2 outline-none text-2xl font-medium ${lt.fg}`}
                    placeholder="1,200"
                  />
                  <span className={`text-sm ${lt.muted}`}>USDC</span>
                </label>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <Link href="/create" className={lt.btnPrimary}>Request payment</Link>
                  <button type="button" className={lt.btnSecondary} onClick={() => window.open(demoCheckoutUrl(window.location.origin), '_blank')}>
                    Launch demo checkout
                  </button>
                </div>
                <p className={`mt-3 px-1 text-sm ${lt.muted}`} aria-live="polite">
                  {ok ? (
                    <>
                      You receive <span className={`font-semibold ${lt.accentText}`}>{money(netFor(amount))} USDC</span> on the payout date. Fee {money(feeFor(amount))}. A card processor would take about {money(amount * 0.029 + 0.3)}.
                    </>
                  ) : (
                    <>Enter an amount to see what you&apos;d receive.</>
                  )}
                </p>
              </form>

              <div className="mt-8">
                <Link href="/dashboard" className={`${lt.btnSecondary} ${lt.btnSm}`}>
                  Already using {siteName}? Go to your dashboard
                </Link>
              </div>

              <div className={`mt-12 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs ${lt.muted}`}>
                {PROOF_POINTS.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Open source</a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================ FEES ============================ */}
        <section className={`${col} py-20`} aria-label="Stop losing money to fees">
          <Fade>
            <p className={eyebrow}>Payments, minus the processor</p>
            <h2 className={h2}>Stop losing money to fees.</h2>
            <p className={`mt-5 text-base leading-relaxed ${lt.muted}`}>
              A card processor sits between you and your customer and charges rent for it. It does that in exchange for one thing — the buyer&apos;s confidence they can get their money back. Escrow gives the buyer that confidence directly, so there is nothing left to charge for.
            </p>
          </Fade>
          <Fade delay={0.1}>
            <div className={`mt-8 ${card} overflow-hidden`}>
              <div className={`grid grid-cols-3 text-xs uppercase tracking-[0.18em] px-5 py-3 border-b ${lt.border} ${lt.muted}`}>
                <span />
                <span>Card processor</span>
                <span className={lt.accentText}>{siteName}</span>
              </div>
              {FEE_COMPARISON.map((r) => (
                <div key={r.item} className={`grid grid-cols-3 px-5 py-3.5 text-sm border-b last:border-b-0 ${lt.border}`}>
                  <span className={lt.muted}>{r.item}</span>
                  <span className={lt.fg}>{r.processor}</span>
                  <span className={`font-semibold ${lt.accentText}`}>{r.us}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
              <Link href="/merchant-savings-calculator" className={lt.btnSecondary}>Calculate savings</Link>
            </div>
          </Fade>
        </section>

        {/* ============================ MERCHANT POINTS ============================ */}
        <section className={`${col} pb-20`} aria-label="For merchants">
          <Fade>
            <p className={eyebrow}>For merchants</p>
            <h2 className={h2}>Everything traditional processors take from you, we don&apos;t.</h2>
          </Fade>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {MERCHANT_POINTS.map((m, i) => (
              <Fade key={m.label} delay={i * 0.05}>
                <div className={`${card} p-5 h-full`}>
                  <h3 className={`font-semibold ${lt.fg}`}>{m.label}</h3>
                  <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                </div>
              </Fade>
            ))}
          </div>
        </section>

        {/* ============================ HOW IT WORKS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="How it works">
          <div className={`${col} py-20`}>
            <Fade>
              <p className={eyebrow}>How it works</p>
              <h2 className={h2}>Quick. Easy. Three steps.</h2>
            </Fade>
            <ol className="mt-8 space-y-4">
              {HOW_IT_WORKS.map((s, i) => (
                <Fade key={s.num} delay={i * 0.08}>
                  <li className={`${card} p-5 flex gap-5`}>
                    <span className={`text-sm ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>{s.num}</span>
                    <div>
                      <h3 className={`text-xl font-medium ${lt.fg}`}>{s.title}</h3>
                      <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                    </div>
                  </li>
                </Fade>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================ DISPUTES ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="What happens on a dispute">
          <div className={`${col} py-20`}>
            <Fade>
              <p className={eyebrow}>If something goes wrong</p>
              <h2 className={h2}>A dispute freezes the money. It never takes it.</h2>
            </Fade>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {DISPUTE_FLOW.map((d, i) => (
                <Fade key={d.title} delay={i * 0.06}>
                  <div className={`${card} p-5 h-full`}>
                    <span className={`text-xs ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>0{i + 1}</span>
                    <h3 className={`mt-2 font-semibold ${lt.fg}`}>{d.title}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{d.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.3}>
              <div className="mt-6">
                <Link href="/arbitration-policy" className={lt.btnSecondary}>Read the arbitration policy</Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ ESTIMATOR + DEMO ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Try it">
          <div className={`${wide} py-20 grid lg:grid-cols-2 gap-10 items-start`}>
            <Fade>
              <p className={eyebrow}>Live demo</p>
              <h2 className={h2}>See what your customers see.</h2>
              <p className={`mt-4 max-w-md ${lt.muted}`}>
                This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site. Or model a real payment first.
              </p>
              <DemoButtons className="mt-8" />
            </Fade>
            <Fade delay={0.1}>
              <EscrowEstimator />
            </Fade>
          </div>
        </section>

        {/* ============================ AUDIENCES ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Who it is for">
          <div className={`${wide} py-20`}>
            <Fade>
              <p className={eyebrow}>Who it&apos;s for</p>
              <h2 className={h2}>{siteName} for business. And for the rest of your life.</h2>
            </Fade>
            <Fade delay={0.1}>
              <AudienceTabs className="mt-10" columns={4} />
            </Fade>
          </div>
        </section>

        {/* ============================ BUYERS ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="For buyers">
          <div className={`${col} py-20`}>
            <Fade>
              <p className={eyebrow}>For buyers</p>
              <h2 className={h2}>Pay with stablecoins and actually be protected.</h2>
            </Fade>
            <div className="mt-8 space-y-4">
              {BUYER_POINTS.map((b, i) => (
                <Fade key={b.label} delay={i * 0.05}>
                  <div className={`${card} p-5`}>
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
          <div className={`${col} py-20`}>
            <Fade>
              <p className={eyebrow}>For AI agents</p>
              <h2 className={h2}>Let an agent pay on your behalf. Keep the right to object.</h2>
              <p className={`mt-4 ${lt.muted}`}>{AGENT_INTRO}</p>
            </Fade>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
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
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/plugins#mcp" className={lt.btnPrimary}>Connect your agent</Link>
                <a href={API_DOC_URL} target="_blank" rel="noopener noreferrer" className={lt.btnSecondary}>API reference</a>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ EMBED ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Embed in your platform">
          <div className={`${col} py-20`}>
            <Fade>
              <p className={eyebrow}>Developers</p>
              <h2 className={h2}>Built into where you already sell.</h2>
            </Fade>
            <Fade delay={0.1}>
              <EmbedExamples className="mt-8" />
            </Fade>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section id="pricing" className={`border-t ${lt.border}`} aria-label="Pricing">
          <div className={`${col} py-20 text-center`}>
            <Fade>
              <p className={eyebrow}>Pricing</p>
              <p className={`mt-2 text-[7rem] sm:text-[9rem] leading-none font-medium tracking-tighter ${lt.accentText}`}>1%</p>
              <p className={`mt-2 ${lt.muted}`}>per transaction. Nothing else.</p>
            </Fade>
            <Fade delay={0.1}>
              <div className={`mt-8 ${card} p-6 text-left`}>
                {PRICING_ROWS.map(([k, v]) => (
                  <div key={k} className={`flex justify-between py-3 border-b ${lt.border} text-sm`}>
                    <span className={lt.muted}>{k}</span>
                    <span className={`font-semibold ${lt.fg}`}>{v}</span>
                  </div>
                ))}
                <Link href="/merchant-savings-calculator" className={`${lt.btnSecondary} w-full mt-6`}>
                  See how much you&apos;d save vs. Stripe, Square or PayPal
                </Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ BENEFITS + FINAL CTA ============================ */}
        <section className={`border-t ${lt.border}`} aria-label="Why switch">
          <div className={`${wide} py-20`}>
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
              <div className="mt-16 text-center">
                <h2 className={`text-3xl sm:text-4xl font-medium tracking-tight ${lt.fg}`}>Add stablecoin checkout to your store.</h2>
                <p className={`mt-3 ${lt.muted}`}>Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link href="/plugins" className={lt.btnPrimary}>Explore plugins</Link>
                  <Link href="/create" className={lt.btnSecondary}>Request a payment</Link>
                </div>
              </div>
            </Fade>
          </div>
          <div className={`border-t ${lt.border} text-center text-xs py-3 px-4 ${lt.muted}`}>
            {siteName} is software, not a bank or a payment processor. Funds are held by an open-source smart contract on Base and can only go to the buyer or the seller.
          </div>
        </section>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
