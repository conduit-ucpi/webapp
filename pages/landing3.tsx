import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import SEO from '@/components/SEO';
import { GetStaticProps } from 'next';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Color & typography system — completely different from the rest of the app.
// Uses inline styles + scoped CSS to avoid polluting Tailwind config.
//
// Palette:  Deep navy base, warm gold/amber accent, cream light sections
// Fonts:    DM Sans (headings), Source Sans 3 (body), JetBrains Mono (code)
// ---------------------------------------------------------------------------

const C = {
  // Backgrounds
  bgDeep:    '#0c0f1a',     // hero / dark sections — near-black navy
  bgCard:    '#151929',     // card on dark
  bgLight:   '#f8f6f1',     // warm cream sections
  bgWhite:   '#fffefa',     // warm white
  bgGlass:   'rgba(255,255,255,0.06)',

  // Accent — warm gold / amber
  accent:    '#e0a340',     // rich gold
  accentLt:  '#f0c97a',     // lighter gold
  accentGlow:'rgba(224,163,64,0.25)',
  accentDark:'#b8832e',     // pressed/hover state

  // Secondary — muted sage for variety
  sage:      '#7a9481',

  // Text
  textWhite: '#f5f3ed',
  textMuted: '#918f9f',
  textDark:  '#1c1a28',
  textBody:  '#55536a',

  // Borders
  border:    'rgba(255,255,255,0.08)',
  borderLt:  '#e4e0d8',
} as const;

// ---------------------------------------------------------------------------
// Scoped styles injected via <Head> — fonts + page-scoped overrides
// ---------------------------------------------------------------------------

function ScopedStyles() {
  return (
    <Head>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Source+Sans+3:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .l3 { font-family: 'Source Sans 3', 'Inter', system-ui, sans-serif; }
        .l3 h1, .l3 h2, .l3 h3 { font-family: 'DM Sans', 'Inter', system-ui, sans-serif; }
        .l3-mono { font-family: 'JetBrains Mono', 'Menlo', monospace; }
        .l3-heading { font-family: 'DM Sans', 'Inter', system-ui, sans-serif; }
        .l3-glow { box-shadow: 0 0 60px 20px rgba(224,163,64,0.1), 0 0 120px 40px rgba(224,163,64,0.05); }
        .l3-glass { background: rgba(255,255,255,0.06); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
        @keyframes l3-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .l3-float { animation: l3-float 6s ease-in-out infinite; }
        @keyframes l3-pulse-ring { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(2.5); opacity: 0; } }
        .l3-pulse-ring { animation: l3-pulse-ring 2s ease-out infinite; }
      `}</style>
    </Head>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Animated flow diagram for the hero
function FlowDiagram() {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setActive(p => (p + 1) % 3), 2800);
    return () => clearInterval(t);
  }, [inView]);

  const nodes = [
    { label: 'Create', sub: 'Set amount & delivery date', icon: '1' },
    { label: 'Fund',   sub: 'Buyer sends to escrow',     icon: '2' },
    { label: 'Release',sub: 'Auto-payout on schedule',   icon: '3' },
  ];

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {nodes.map((n, i) => {
        const isActive = i === active;
        const isDone = i < active;
        return (
          <motion.div
            key={i}
            animate={{
              scale: isActive ? 1.02 : 1,
              borderColor: isActive ? C.accent : 'rgba(255,255,255,0.08)',
            }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4 rounded-xl px-5 py-4"
            style={{
              background: isActive ? C.bgCard : 'transparent',
              border: `1px solid ${isActive ? C.accent : C.border}`,
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 l3-heading"
              style={{
                background: isActive ? C.accent : isDone ? 'rgba(224,163,64,0.15)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#fff' : isDone ? C.accentLt : C.textMuted,
              }}
            >
              {isDone ? (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : n.icon}
            </div>
            <div>
              <p className="text-sm font-semibold l3-heading" style={{ color: isActive ? C.textWhite : C.textMuted }}>
                {n.label}
              </p>
              <p className="text-xs" style={{ color: isActive ? C.accentLt : 'rgba(142,141,160,0.6)' }}>
                {n.sub}
              </p>
            </div>
            {isActive && (
              <motion.div
                layoutId="flow-dot"
                className="ml-auto w-2 h-2 rounded-full"
                style={{ background: C.accent }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Landing3() {
  let user = null;
  let isConnected = false;

  try {
    const authContext = useAuth();
    user = authContext.user;
    isConnected = authContext.isConnected;
  } catch (error) {
    // Auth context not available during SSR
  }

  const siteName = getSiteNameFromDomain();

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "name": "Conduit Escrow",
      "alternateName": "InstantEscrow",
      "description": "100% open source cryptocurrency escrow service for USDC stablecoin payments with built-in buyer protection. Smart contract-based time-delayed escrow with automatic dispute resolution. No KYC/KYB, no floats, no minimum volumes. 1% flat fee, instant settlement.",
      "url": "https://conduit-ucpi.com",
      "logo": "https://conduit-ucpi.com/icon.png",
      "image": "https://conduit-ucpi.com/preview.png",
      "sameAs": ["https://github.com/conduit-ucpi", "https://app.instantescrow.nz"],
      "priceRange": "1%",
      "paymentAccepted": ["USDC", "Cryptocurrency", "Stablecoin"],
      "areaServed": { "@type": "Place", "name": "Worldwide" },
      "availableChannel": { "@type": "ServiceChannel", "serviceType": "Online Banking", "availableLanguage": "English" },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Escrow Services",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Time-Delayed Escrow Contracts", "description": "Secure smart contract payment holding with automatic release after delivery confirmation." } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "E-commerce Integration", "description": "WordPress and Shopify plugins, JavaScript SDK for custom websites." } }
        ]
      },
      "offers": { "@type": "Offer", "priceCurrency": "USD", "price": "1", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "0.01", "priceCurrency": "USD", "referenceQuantity": { "@type": "QuantitativeValue", "value": "1", "unitText": "TRANSACTION" } } },
      "serviceType": "Cryptocurrency Escrow Service",
      "provider": { "@type": "Organization", "name": "Conduit UCPI", "url": "https://conduit-ucpi.com" },
      "termsOfService": "https://conduit-ucpi.com/terms-of-service",
      "slogan": "Stablecoin payments made safe and easy"
    }
  ];

  const heroStagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const heroChild = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as const } },
  };

  return (
    <>
      <SEO
        title="Conduit Escrow - Open Source Crypto Payments with Built-in Buyer Protection | 1% Fee"
        description="Get paid safely with blockchain escrow. Hold USDC payments in trust until delivery is confirmed. 60 second setup, 1% fee, free testing."
        keywords="open source escrow, crypto escrow, blockchain escrow, USDC escrow, secure crypto payments, buyer protection, smart contract escrow"
        canonical="/"
        structuredData={structuredData}
      />
      <ScopedStyles />

      <div className="l3" style={{ color: C.textDark }}>

        {/* ================================================================ */}
        {/* HERO — dark indigo with gradient mesh + flow diagram             */}
        {/* ================================================================ */}
        <section
          className="relative overflow-hidden"
          style={{ background: `linear-gradient(165deg, ${C.bgDeep} 0%, #141520 50%, #0e0f1a 100%)` }}
          aria-label="Hero"
        >
          {/* Ambient glow blobs */}
          <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${C.accentGlow} 0%, transparent 70%)` }} />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full opacity-20" style={{ background: `radial-gradient(circle, rgba(224,163,64,0.15) 0%, transparent 70%)` }} />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 lg:pt-28 pb-20 lg:pb-32">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left copy */}
              <motion.div variants={heroStagger} initial="hidden" animate="show">
                <motion.div variants={heroChild} className="flex items-center gap-3 mb-8">
                  {/* Live badge */}
                  <span className="l3-glass inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium" style={{ color: C.accentLt }}>
                    <span className="relative flex h-2 w-2">
                      <span className="l3-pulse-ring absolute inline-flex h-full w-full rounded-full" style={{ background: C.accent }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: C.accent }} />
                    </span>
                    Live on Base Network
                  </span>
                </motion.div>

                <motion.h1
                  variants={heroChild}
                  className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight"
                  style={{ color: C.textWhite }}
                >
                  Payments people<br />
                  <span style={{ color: C.accent }}>actually trust.</span>
                </motion.h1>

                <motion.p
                  variants={heroChild}
                  className="mt-5 text-lg leading-relaxed max-w-md"
                  style={{ color: C.textMuted }}
                >
                  Hold funds in a smart contract until delivery. Disputes get resolved automatically. No crypto experience needed — sign in with Google.
                </motion.p>

                <motion.div variants={heroChild} className="mt-8">
                  {isConnected ? (
                    <div className="flex flex-wrap gap-3">
                      <Link href="/dashboard">
                        <button className="px-6 py-3 rounded-xl text-sm font-semibold transition-all l3-heading" style={{ background: C.accent, color: '#fff' }}>
                          Dashboard
                        </button>
                      </Link>
                      <Link href="/create">
                        <button className="l3-glass px-6 py-3 rounded-xl text-sm font-semibold transition-all l3-heading" style={{ color: C.accentLt }}>
                          Create Payment Request
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ConnectWalletEmbedded
                        compact={true}
                        useSmartRouting={false}
                        showTwoOptionLayout={true}
                        buttonText="Get Started — It's Free"
                      />
                      <p className="text-sm" style={{ color: C.textMuted }}>
                        Google, email, or any existing wallet. No credit card.
                      </p>
                    </div>
                  )}
                </motion.div>

                {/* Trust pills */}
                <motion.div variants={heroChild} className="mt-8 flex flex-wrap gap-2">
                  {['Open source', 'Audited code', '1% flat fee', 'No KYC'].map(t => (
                    <span key={t} className="l3-glass px-3 py-1.5 rounded-full text-xs font-medium" style={{ color: C.textMuted }}>
                      {t}
                    </span>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right — flow diagram */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <div className="l3-glass rounded-2xl p-6 sm:p-8 l3-glow">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-5 l3-heading" style={{ color: C.textMuted }}>
                    How it works
                  </p>
                  <FlowDiagram />
                  <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.accent} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                      <span className="text-xs" style={{ color: C.accentLt }}>Funds can only go to buyer or seller — even we can&apos;t touch them</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SOCIAL PROOF BAR                                                 */}
        {/* ================================================================ */}
        <section style={{ background: C.bgWhite, borderBottom: `1px solid ${C.borderLt}` }} className="py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {[
              { label: 'Reviewed by', bold: 'WordPress' },
              { label: 'Screened by', bold: 'Blockaid (MetaMask)' },
              { label: 'Built on', bold: 'Base Network' },
              { label: 'Powered by', bold: 'USDC' },
            ].map((item, i) => (
              <span key={i} className="text-sm" style={{ color: C.textBody }}>
                {item.label}{' '}
                <strong className="font-semibold l3-heading" style={{ color: C.textDark }}>{item.bold}</strong>
              </span>
            ))}
          </div>
        </section>

        {/* ================================================================ */}
        {/* "HOW EASY IS IT?" — Warm cream section with timeline             */}
        {/* ================================================================ */}
        <section style={{ background: C.bgLight }} className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" aria-label="How easy">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="text-center mb-16">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold l3-heading mb-4" style={{ background: 'rgba(224,163,64,0.1)', color: C.accent }}>
                  Simpler than you think
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" style={{ color: C.textDark }}>
                  Three clicks to safety
                </h2>
                <p className="mt-3 text-lg" style={{ color: C.textBody }}>
                  No wallets to install. No crypto to buy. No learning curve.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  num: '1',
                  title: 'Sign in with Google',
                  body: 'Or email, Apple, X — we create a secure wallet in the background. You never see a seed phrase.',
                  color: C.accent,
                },
                {
                  num: '2',
                  title: 'Create or pay a request',
                  body: 'Enter an amount and delivery date. Share a link. Buyer clicks "Pay" — done. We handle the blockchain stuff.',
                  color: C.sage,
                },
                {
                  num: '3',
                  title: 'Funds release on schedule',
                  body: 'After the delivery date, the seller gets paid automatically. Problem? Raise a dispute before payout.',
                  color: '#c4785b',
                },
              ].map((step, i) => (
                <Reveal key={i} delay={i * 0.12}>
                  <div
                    className="relative rounded-2xl p-6 h-full"
                    style={{ background: C.bgWhite, border: `1px solid ${C.borderLt}` }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold mb-4 l3-heading"
                      style={{ background: `${step.color}15`, color: step.color }}
                    >
                      {step.num}
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: C.textDark }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.textBody }}>{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURE GRID — White section, icon + text rows                   */}
        {/* ================================================================ */}
        <section style={{ background: C.bgWhite }} className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" aria-label="Features">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="text-center mb-14">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold l3-heading mb-4" style={{ background: 'rgba(122,148,129,0.12)', color: C.sage }}>
                  Built different
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" style={{ color: C.textDark }}>
                  Everything you&apos;d expect.<br className="hidden sm:block" /> Nothing you wouldn&apos;t.
                </h2>
              </div>
            </Reveal>

            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
              {[
                { title: 'Buyer protection', desc: 'Funds are locked until delivery is confirmed. Dispute before payout — no chargeback fees, no 180-day risk window.', icon: '🛡' },
                { title: 'Seller protection', desc: 'Both sides negotiate disputes equally. No automatic refunds, no surprise freezes, no account shutdowns.', icon: '⚖️' },
                { title: 'Gas-free for users', desc: 'We pay all blockchain transaction fees in the background. Your customers never see gas or need ETH.', icon: '⛽' },
                { title: 'WordPress & Shopify', desc: 'Install a plugin, paste your wallet address, and you\'re accepting escrow payments. 10-minute setup.', icon: '🔌' },
                { title: 'Open source code', desc: 'Every line is public on GitHub. Audited and approved by WordPress and Blockaid. MIT licensed.', icon: '👁' },
                { title: 'Non-custodial', desc: 'We never hold funds. The smart contract guarantees money can only go to buyer or seller.', icon: '🔐' },
              ].map((f, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="flex gap-4">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
                    <div>
                      <h3 className="text-base font-semibold mb-1" style={{ color: C.textDark }}>{f.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: C.textBody }}>{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* MERCHANT CTA — dark section with browser mockup                  */}
        {/* ================================================================ */}
        <section
          style={{ background: `linear-gradient(170deg, ${C.bgDeep} 0%, #141520 100%)` }}
          className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8"
          aria-label="For merchants"
        >
          <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <div>
                <span className="l3-glass inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold l3-heading mb-5" style={{ color: C.accent }}>
                  For merchants
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: C.textWhite }}>
                  Your checkout, with<br />built-in trust
                </h2>
                <p className="text-base leading-relaxed mb-6" style={{ color: C.textMuted }}>
                  Drop a plugin into WordPress or Shopify. Or add one line of JavaScript. Your customers see an escrow-protected checkout — you see payments arrive on schedule.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    'No account needed — install and go',
                    'No monthly fees, no minimums, no KYB',
                    'Reach crypto customers who can\'t buy from you today',
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${C.accent}20` }}>
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke={C.accent} strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-sm" style={{ color: C.textMuted }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/plugins">
                    <button className="px-6 py-3 rounded-xl text-sm font-semibold transition-all l3-heading" style={{ background: C.accent, color: '#fff' }}>
                      See Integrations
                    </button>
                  </Link>
                  <Link href="/merchant-savings-calculator">
                    <button className="l3-glass px-6 py-3 rounded-xl text-sm font-semibold transition-all l3-heading" style={{ color: C.accentLt }}>
                      Calculate Savings &rarr;
                    </button>
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="rounded-2xl overflow-hidden" style={{ background: C.bgCard, border: `1px solid ${C.border}` }}>
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                  </div>
                  <span className="ml-3 text-xs l3-mono" style={{ color: C.textMuted }}>yourstore.com/checkout</span>
                </div>
                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: C.textWhite }}>Order #1042</span>
                    <span className="text-sm font-semibold l3-mono" style={{ color: C.accent }}>$89.00</span>
                  </div>
                  <div style={{ height: 1, background: C.border }} />
                  <div className="text-center py-2">
                    <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold l3-heading" style={{ background: C.accent, color: '#fff' }}>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                      Pay with Escrow Protection
                    </div>
                    <p className="text-xs mt-2" style={{ color: C.textMuted }}>Powered by {siteName}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: 'rgba(224,163,64,0.08)' }}>
                    <p className="text-xs flex items-center gap-2" style={{ color: C.accentLt }}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                      Payment held in escrow until delivery confirmed
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PRICING — cream section, big number, clean list                  */}
        {/* ================================================================ */}
        <section style={{ background: C.bgLight }} className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" aria-label="Pricing">
          <div className="max-w-lg mx-auto text-center">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2" style={{ color: C.textDark }}>
                Transparent pricing
              </h2>
              <p style={{ color: C.textBody }}>No tiers. No gotchas. One number.</p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-10 rounded-2xl p-8 sm:p-10" style={{ background: C.bgWhite, border: `1px solid ${C.borderLt}` }}>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-6xl sm:text-7xl font-bold tracking-tight l3-heading" style={{ color: C.accent }}>1</span>
                  <span className="text-4xl sm:text-5xl font-bold l3-heading" style={{ color: C.accent }}>%</span>
                </div>
                <p className="mt-1 text-sm" style={{ color: C.textBody }}>per transaction</p>
                <div className="my-6 h-px" style={{ background: C.borderLt }} />
                <div className="space-y-2.5 text-sm" style={{ color: C.textBody }}>
                  {['No monthly fees', 'No setup costs', 'No dispute fees', 'No minimum volume', 'Free testing on testnet'].map(t => (
                    <div key={t} className="flex items-center justify-center gap-2">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.accent} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <Link href="/merchant-savings-calculator" className="inline-block mt-5 text-sm font-medium transition-colors" style={{ color: C.accent }}>
                Compare vs. Stripe, Square &amp; PayPal &rarr;
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FINAL CTA — dark bottom                                          */}
        {/* ================================================================ */}
        <section
          style={{ background: C.bgDeep }}
          className="py-20 lg:py-24 px-4 sm:px-6 lg:px-8"
          aria-label="Get started"
        >
          <div className="max-w-2xl mx-auto text-center">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: C.textWhite }}>
                Ready in 60 seconds
              </h2>
              <p className="text-lg mb-8" style={{ color: C.textMuted }}>
                Sign in, create a test escrow, see it work. No real money required.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              {isConnected ? (
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link href="/dashboard">
                    <button className="px-8 py-3.5 rounded-xl text-sm font-semibold l3-heading" style={{ background: C.accent, color: '#fff' }}>
                      Dashboard
                    </button>
                  </Link>
                  <Link href="/create">
                    <button className="l3-glass px-8 py-3.5 rounded-xl text-sm font-semibold l3-heading" style={{ color: C.accentLt }}>
                      Create Payment Request
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="max-w-xs mx-auto">
                  <ConnectWalletEmbedded
                    compact={true}
                    useSmartRouting={false}
                    showTwoOptionLayout={true}
                    buttonText="Get Started — It's Free"
                  />
                </div>
              )}
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8 text-sm" style={{ color: C.textMuted }}>
                <a
                  href="https://github.com/conduit-ucpi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                  Open source
                </a>
                <a href="mailto:info@conduit-ucpi.com" className="hover:opacity-80 transition-opacity">
                  info@conduit-ucpi.com
                </a>
                <Link href="/faq" className="hover:opacity-80 transition-opacity">
                  FAQ
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};
