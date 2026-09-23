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
import { feeFor, netFor, MIN_AMOUNT } from '@/utils/escrowFees';
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
  FEE_COMPARISON,
  HOW_IT_WORKS,
  MERCHANT_POINTS,
  PRICING_ROWS,
  PROOF_POINTS,
  SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SEO_TITLE,
  SOURCE_URL,
  VIDEO_URL,
  demoCheckoutUrl,
} from '@/components/landing-test/content';

/*
 * Landing test 02 — after Mercury.
 * An announcement bar, a full-bleed dark hero with the nav floating over it, one centred
 * line ("Radically different banking" → payments), an input right in the hero with the
 * primary action and "Launch demo" beside it, then a light body whose copy is about how
 * this differs from the normal way: "stop losing money to fees", business vs personal,
 * and a disclosure bar at the very bottom.
 */

const ID = 'lt-02';

const light: LandingTheme = {
  bg: '#f7f7f5',
  fg: '#1b1d29',
  muted: '#5c5f6e',
  card: '#ffffff',
  border: '#e4e4e0',
  accent: '#5e6ad2',
  accentFg: '#ffffff',
  accentSoft: '#eceef9',
  radius: '16px',
  btnRadius: '999px',
  font: "'DM Sans', Inter, system-ui, sans-serif",
  fontDisplay: "'DM Sans', Inter, system-ui, sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const dark: LandingTheme = {
  ...light,
  bg: '#12131a',
  fg: '#f2f2f0',
  muted: '#a2a4b3',
  card: '#1b1d29',
  border: '#2b2e3d',
  accent: '#8b95f0',
  accentSoft: '#232640',
};

/* The hero is dark in both modes, so its own palette is fixed rather than themed. */
const hero = {
  fg: 'text-[#f4f3ee]',
  muted: 'text-[#c9cbd6]',
};

const section = 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8';
const h2 = `text-3xl sm:text-[2.6rem] font-medium tracking-tight leading-[1.15] ${lt.fg}`;
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LandingTest02() {
  const [siteName, setSiteName] = useState('Stabledrop.me');
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  const [amountText, setAmountText] = useState('1,200');
  const amount = useMemo(() => {
    const n = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [amountText]);
  const net = amount >= MIN_AMOUNT ? netFor(amount) : 0;
  const fee = amount >= MIN_AMOUNT ? feeFor(amount) : 0;

  return (
    <>
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} keywords={SEO_KEYWORDS} canonical="/landing-test-02" structuredData={[financialServiceSchema, articleSchema]} />
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one experiment page, one face; not a site-wide font */}
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
        <style>{themeCss(ID, light, dark)}</style>
      </Head>

      <div id={ID} className={`${lt.bg} ${lt.fg} transition-colors`} style={{ fontFamily: 'var(--lt-font)' }}>
        {/* Announcement bar */}
        <div className={`${lt.card} border-b ${lt.border} text-center text-sm py-2.5 px-4`}>
          <Link href="/plugins#mcp" className={`${lt.fg} hover:opacity-80`}>
            ✦ Introducing agent payments: let Claude or ChatGPT pay with a human veto <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* ============================ HERO (dark, full-bleed) ============================ */}
        <div className="relative overflow-hidden bg-[#0e1420] text-[#f4f3ee]">
          {/* A misty valley without a photograph: layered gradients, darker at the bottom. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 0%, rgba(120,140,190,0.45) 0%, rgba(14,20,32,0) 70%),' +
                'radial-gradient(40% 30% at 20% 60%, rgba(90,120,110,0.35) 0%, rgba(14,20,32,0) 70%),' +
                'radial-gradient(50% 35% at 80% 70%, rgba(70,90,140,0.35) 0%, rgba(14,20,32,0) 70%),' +
                'linear-gradient(180deg, #1a2333 0%, #0e1420 60%, #0a0f18 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-64 opacity-60"
            style={{ background: 'linear-gradient(180deg, rgba(14,20,32,0) 0%, #0a0f18 100%)' }}
          />
          <div className="relative z-30 [--lt-fg:#f4f3ee] [--lt-muted:#c9cbd6] [--lt-card:#161c2a] [--lt-border:rgba(255,255,255,0.15)] [--lt-accent-soft:rgba(255,255,255,0.08)]">
            <LandingNav brand={siteName} />
          </div>

          <section className={`relative z-10 ${section} pt-16 pb-28 lg:pt-24 lg:pb-40 text-center`} aria-label="Hero">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className={`text-4xl sm:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.05] ${hero.fg}`}>
                Radically different payments
              </h1>
              <p className={`mt-6 text-lg sm:text-xl max-w-2xl mx-auto ${hero.muted}`}>
                Request a stablecoin payment in a few clicks, or put a checkout on your site in ten minutes. No processor, no chargebacks, no one holding your money.
              </p>

              {/* Mercury's hero input, made real: the amount drives a live readout. */}
              <form
                className="mt-10 mx-auto max-w-xl flex flex-col sm:flex-row items-stretch gap-2"
                onSubmit={(e) => e.preventDefault()}
                aria-label="Quick estimate"
              >
                <label className="flex-1 flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-5 focus-within:border-white/50">
                  <span className={`text-sm ${hero.muted}`}>Amount</span>
                  <input
                    aria-label="Amount to request"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    className={`w-full bg-transparent py-3 outline-none text-base ${hero.fg} placeholder:text-white/40`}
                    placeholder="1,200"
                  />
                  <span className={`text-sm ${hero.muted}`}>USDC</span>
                </label>
                <Link href="/create" className={lt.btnPrimary}>
                  Request payment
                </Link>
                <button
                  type="button"
                  className={`${lt.btnOutline} !border-white/25 !text-[#f4f3ee] hover:!bg-white/10`}
                  onClick={() => window.open(demoCheckoutUrl(window.location.origin), '_blank')}
                >
                  Launch demo
                </button>
              </form>
              <p className={`mt-4 text-sm ${hero.muted}`} aria-live="polite">
                {amount >= MIN_AMOUNT ? (
                  <>
                    You&apos;d receive <span className={`font-medium ${hero.fg}`}>{money(net)} USDC</span> on the payout date. Fee {money(fee)}. A card processor would take about {money(amount * 0.029 + 0.3)}.
                  </>
                ) : (
                  <>Enter an amount to see what you&apos;d receive.</>
                )}
              </p>

              <Link href="/dashboard" className={`inline-flex items-center gap-1.5 mt-8 text-sm ${hero.muted} hover:text-white`}>
                Already using {siteName}? Go to your dashboard <span aria-hidden="true">→</span>
              </Link>

              <div className={`mt-14 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs ${hero.muted}`}>
                {PROOF_POINTS.map((p) => (
                  <span key={p}>{p}</span>
                ))}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  Open source
                </a>
              </div>
            </motion.div>
          </section>
        </div>

        {/* ============================ THE DIFFERENCE ============================ */}
        <section className={`${section} py-24`} aria-label="Stop losing money to fees">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <Fade>
              <p className={`text-sm font-medium ${lt.accentText}`}>Payments, minus the processor</p>
              <h2 className={`mt-3 ${h2}`}>Stop losing money to fees.</h2>
              <p className={`mt-5 text-base leading-relaxed ${lt.muted}`}>
                A card processor sits between you and your customer and charges rent for it: a percentage, a fixed fee, a reserve, a chargeback penalty and a three-day wait. Escrow on a smart contract does the one thing a processor is actually for — protecting the buyer — and skips the rest.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/plugins" className={lt.btnPrimary}>View integrations</Link>
                <Link href="/merchant-savings-calculator" className={lt.btnOutline}>Calculate savings</Link>
              </div>
            </Fade>
            <Fade delay={0.1}>
              <div className={`${lt.card} ${lt.radius} border ${lt.border} overflow-hidden`}>
                <div className={`grid grid-cols-3 text-xs uppercase tracking-wider px-5 py-3 border-b ${lt.border} ${lt.muted}`}>
                  <span />
                  <span>Card processor</span>
                  <span className={lt.accentText}>{siteName}</span>
                </div>
                {FEE_COMPARISON.map((r) => (
                  <div key={r.item} className={`grid grid-cols-3 px-5 py-3.5 text-sm border-b last:border-b-0 ${lt.border}`}>
                    <span className={lt.muted}>{r.item}</span>
                    <span className={lt.fg}>{r.processor}</span>
                    <span className={`font-medium ${lt.fg}`}>{r.us}</span>
                  </div>
                ))}
              </div>
            </Fade>
          </div>
        </section>

        {/* ============================ AUDIENCES ============================ */}
        <section className={`${lt.card} border-y ${lt.border}`} aria-label="Who it is for">
          <div className={`${section} py-24`}>
            <Fade>
              <h2 className={h2}>{siteName} for business. And for the rest of your life.</h2>
              <p className={`mt-4 max-w-xl ${lt.muted}`}>Speak to whoever you are: a store, a founder paying a contractor, a person buying something from a stranger, a platform.</p>
            </Fade>
            <Fade delay={0.1}>
              <AudienceTabs className="mt-10" />
            </Fade>
          </div>
        </section>

        {/* ============================ HOW IT WORKS ============================ */}
        <section className={`${section} py-24`} aria-label="How it works">
          <Fade>
            <h2 className={h2}>Quick. Easy. Three steps.</h2>
          </Fade>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((s, i) => (
              <Fade key={s.num} delay={i * 0.1}>
                <div className={`p-6 ${lt.card} ${lt.radius} border ${lt.border} h-full`}>
                  <p className={`text-xs ${lt.muted}`}>{s.num}</p>
                  <h3 className={`mt-2 text-xl font-medium ${lt.fg}`}>{s.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{s.desc}</p>
                </div>
              </Fade>
            ))}
          </div>
        </section>

        {/* ============================ ESTIMATOR + DEMO ============================ */}
        <section className={`${lt.card} border-y ${lt.border}`} aria-label="Try it">
          <div className={`${section} py-24 grid lg:grid-cols-2 gap-12 items-start`}>
            <Fade>
              <h2 className={h2}>See what your customers see.</h2>
              <p className={`mt-4 max-w-md ${lt.muted}`}>
                This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site. Or model a real payment first.
              </p>
              <DemoButtons className="mt-8" />
              <a href={VIDEO_URL} className="sr-only">Video walkthrough</a>
            </Fade>
            <Fade delay={0.1}>
              <EscrowEstimator />
            </Fade>
          </div>
        </section>

        {/* ============================ MERCHANTS ============================ */}
        <section className={`${section} py-24`} aria-label="For merchants">
          <Fade>
            <p className={`text-sm font-medium ${lt.accentText}`}>For merchants</p>
            <h2 className={`mt-3 ${h2}`}>Everything traditional processors take from you, we don&apos;t.</h2>
          </Fade>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
            {MERCHANT_POINTS.map((m, i) => (
              <Fade key={m.label} delay={i * 0.05}>
                <div className={`pt-4 border-t ${lt.border}`}>
                  <h3 className={`font-medium ${lt.fg}`}>{m.label}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{m.text}</p>
                </div>
              </Fade>
            ))}
          </div>
        </section>

        {/* ============================ BUYERS ============================ */}
        <section className={`${lt.card} border-y ${lt.border}`} aria-label="For buyers">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={`text-sm font-medium ${lt.accentText}`}>For buyers</p>
              <h2 className={`mt-3 ${h2}`}>Pay with stablecoins and actually be protected.</h2>
            </Fade>
            <div className="mt-12 grid sm:grid-cols-2 gap-6">
              {BUYER_POINTS.map((b, i) => (
                <Fade key={b.label} delay={i * 0.05}>
                  <div className={`p-6 ${lt.bg} ${lt.radius} h-full`}>
                    <h3 className={`font-medium ${lt.fg}`}>{b.label}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ AGENTS ============================ */}
        <section className={`${section} py-24`} aria-label="For AI agents">
          <Fade>
            <p className={`text-sm font-medium ${lt.accentText}`}>For AI agents</p>
            <h2 className={`mt-3 ${h2}`}>Let an agent pay on your behalf. Keep the right to object.</h2>
            <p className={`mt-4 max-w-xl ${lt.muted}`}>{AGENT_INTRO}</p>
          </Fade>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
            {AGENT_POINTS.map((a, i) => (
              <Fade key={a.label} delay={i * 0.05}>
                <div className={`pt-4 border-t ${lt.border}`}>
                  <h3 className={`font-medium ${lt.fg}`}>{a.label}</h3>
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
        </section>

        {/* ============================ EMBED ============================ */}
        <section className={`${lt.card} border-y ${lt.border}`} aria-label="Embed in your platform">
          <div className={`${section} py-24`}>
            <Fade>
              <p className={`text-sm font-medium ${lt.accentText}`}>Developers</p>
              <h2 className={`mt-3 ${h2}`}>Built into where you already sell.</h2>
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
              <p className={`text-sm font-medium ${lt.accentText}`}>Pricing</p>
              <p className={`mt-2 text-[7rem] sm:text-[9rem] leading-none font-medium tracking-tighter ${lt.fg}`}>
                1<span className={lt.accentText}>%</span>
              </p>
              <p className={`mt-2 ${lt.muted}`}>per transaction. Nothing else.</p>
            </Fade>
            <Fade delay={0.1}>
              <div className={`${lt.card} ${lt.radius} border ${lt.border} p-6`}>
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
        <section className="relative overflow-hidden bg-[#0e1420] text-[#f4f3ee]" aria-label="Why switch">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 60% at 50% 100%, rgba(120,140,190,0.35) 0%, rgba(14,20,32,0) 70%)' }} />
          <div className={`relative ${section} py-24`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {BENEFITS.map((b, i) => (
                <Fade key={b.title} delay={i * 0.06}>
                  <div>
                    <h3 className="text-lg font-medium leading-snug">{b.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${hero.muted}`}>{b.text}</p>
                  </div>
                </Fade>
              ))}
            </div>
            <Fade delay={0.2}>
              <div className="mt-20 text-center">
                <h2 className="text-3xl sm:text-4xl font-medium tracking-tight">Add stablecoin checkout to your store.</h2>
                <p className={`mt-3 ${hero.muted}`}>Integrate Stabledrop into your existing platform with our ready-made plugins.</p>
                <Link href="/plugins" className={`${lt.btnPrimary} mt-8`}>Explore plugins</Link>
              </div>
            </Fade>
          </div>
          {/* Mercury's disclosure bar */}
          <div className={`relative border-t border-white/10 text-center text-xs py-3 px-4 ${hero.muted}`}>
            {siteName} is software, not a bank or a payment processor. Funds are held by an open-source smart contract on Base and can only go to the buyer or the seller.
          </div>
        </section>

        <LandingFooter brand={siteName} />
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({ props: {}, ...isr(3600) });
