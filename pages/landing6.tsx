import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import SEO from '@/components/SEO';
import { GetStaticProps } from 'next';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { motion, useInView } from 'framer-motion';
import { useRef, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;
const btn = 'inline-flex items-center justify-center font-mono tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]';
const btnPrimary = `${btn} text-sm bg-primary-500 text-[#0a0a0a] font-semibold hover:bg-primary-400 px-8 py-3.5`;
const btnOutline = `${btn} text-sm border border-primary-500/40 text-primary-400 hover:border-primary-400 hover:text-primary-300 px-8 py-3.5`;

// ---------------------------------------------------------------------------
// Fade-in helper
// ---------------------------------------------------------------------------
function Fade({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Blinking cursor
// ---------------------------------------------------------------------------
function Cursor() {
  return (
    <motion.span
      className="inline-block w-[3px] h-[1em] bg-primary-500 ml-1 align-baseline"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Landing6() {
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
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Time-Delayed Escrow Contracts", "description": "Secure smart contract payment holding with automatic release on a pre-agreed payout date. Buyer can dispute before payout." } },
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
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as const } },
  };

  const pathways = [
    {
      index: '1',
      cmd: 'request_payment',
      label: 'Request a payment',
      desc: 'Send a payment link to anyone. Funds secured until delivery.',
      href: '/create',
    },
    {
      index: '2',
      cmd: 'add_checkout',
      label: 'Add to your store',
      desc: 'WordPress, Shopify, or JS SDK. Install protected checkout on your site in minutes.',
      href: '/plugins',
    },
    {
      index: '3',
      cmd: 'learn_more',
      label: 'See how it works',
      desc: 'How protected payments work under the hood. 1% fee. Open source.',
      href: '#how-it-works',
    },
  ];

  return (
    <>
      <SEO
        title="Conduit Escrow - Stablecoin Payments with Buyer Protection | 1% Fee"
        description="Stablecoin checkout with buyer protection. No chargebacks, no floats, no freezes, no vetting. 1% flat fee, 10-minute setup. Gas-free transactions. Open source escrow on Base."
        keywords="open source escrow, crypto escrow, blockchain escrow, USDC escrow, secure crypto payments, buyer protection, smart contract escrow, Base network escrow"
        canonical="/"
        structuredData={structuredData}
      />
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="bg-[#0a0a0a] text-white min-h-screen" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ================================================================ */}
        {/* HERO — Segmented entry point                                     */}
        {/* ================================================================ */}
        <section className="min-h-[92vh] flex items-center" aria-label="Hero">
          <div className="max-w-4xl mx-auto px-6 sm:px-8 py-20 lg:py-28 w-full">
            <motion.div variants={heroStagger} initial="hidden" animate="show">
              <motion.p
                variants={heroChild}
                className="text-xs tracking-[0.15em] text-primary-500/70 mb-6"
                style={mono}
              >
                {'// payment protocol on base'}
              </motion.p>

              <motion.h1
                variants={heroChild}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.15] tracking-tight max-w-2xl mb-4"
                style={mono}
              >
                Protected payments<Cursor />
              </motion.h1>

              <motion.p
                variants={heroChild}
                className="text-[15px] text-neutral-400 max-w-lg leading-relaxed mb-14"
              >
                Trustless payments with built-in buyer protection.
                No chargebacks, no freezes, no middlemen. 1% fee. Open source.
              </motion.p>

              {/* ---- Pathway selector ---- */}
              <motion.div
                variants={heroChild}
                className="mb-10"
              >
                <p className="text-xs text-neutral-600 mb-5" style={mono}>
                  <span className="text-primary-500/70">$</span> select_mode
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  {pathways.map((p, i) => (
                    <motion.div
                      key={p.cmd}
                      variants={heroChild}
                    >
                      <Link href={p.href} className="block group">
                        <div className="border border-neutral-800 hover:border-primary-500/50 transition-colors p-5 sm:p-6 h-full">
                          <div className="flex items-baseline gap-3 mb-3">
                            <span className="text-primary-500 text-lg font-bold" style={mono}>
                              {p.index}
                            </span>
                            <span className="text-primary-400 text-sm group-hover:text-primary-300 transition-colors" style={mono}>
                              {p.cmd}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-400 leading-relaxed">
                            {p.desc}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Dashboard link — always visible */}
              <motion.div variants={heroChild} className="flex items-center gap-4">
                <Link href="/dashboard">
                  <button className={btnOutline}>$ dashboard</button>
                </Link>
                <span className="text-xs text-neutral-600" style={mono}>
                  {'// sign in or view existing contracts'}
                </span>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* STATS BAR                                                        */}
        {/* ================================================================ */}
        <section
          className="border-t border-neutral-800/60"
          aria-label="Protocol stats"
        >
          <div className="max-w-4xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12">
                {[
                  { value: '1%', label: 'fee' },
                  { value: '10min', label: 'self-setup' },
                  { value: '$0', label: 'monthly' },
                  { value: '0', label: 'KYC required' },
                ].map((stat, i) => (
                  <div key={i} className="text-center sm:text-left">
                    <span
                      className="text-3xl sm:text-4xl font-bold text-primary-400 block"
                      style={mono}
                    >
                      {stat.value}
                    </span>
                    <span
                      className="text-xs text-neutral-500 mt-1 block"
                      style={mono}
                    >
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* HOW IT WORKS                                                     */}
        {/* ================================================================ */}
        <section
          id="how-it-works"
          className="border-t border-neutral-800/60 scroll-mt-16"
          aria-label="How it works"
        >
          <div className="max-w-4xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p
                className="text-xs text-primary-500/70 mb-16"
                style={mono}
              >
                {'// how_it_works'}
              </p>
            </Fade>

            <div className="space-y-12 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-8">
              {[
                {
                  step: '01',
                  cmd: 'create',
                  desc: 'Seller sets amount and payout date. System deploys a payment contract.',
                },
                {
                  step: '02',
                  cmd: 'fund',
                  desc: 'Buyer sends USDC into the contract. Funds are locked until the payout date.',
                },
                {
                  step: '03',
                  cmd: 'release',
                  desc: 'Payout date hits, seller claims funds. Buyer can dispute before that date.',
                },
              ].map((item, i) => (
                <Fade key={item.step} delay={i * 0.1}>
                  <div className="border border-neutral-800/60 p-6 sm:p-8 relative">
                    <div className="flex items-center gap-1.5 mb-6">
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                      <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                    </div>
                    <p
                      className="text-primary-500 text-sm mb-3"
                      style={mono}
                    >
                      <span className="text-neutral-500">$</span> escrow.{item.cmd}()
                    </p>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {item.desc}
                    </p>
                    <span
                      className="absolute top-6 right-6 text-neutral-700 text-xs"
                      style={mono}
                    >
                      {item.step}
                    </span>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURES — MERCHANTS                                             */}
        {/* ================================================================ */}
        <section
          className="border-t border-neutral-800/60"
          aria-label="For merchants"
        >
          <div className="max-w-4xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p className="text-xs text-primary-500/70 mb-10" style={mono}>
                {'// for_merchants'}
              </p>
            </Fade>

            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-8 mb-16">
              {[
                { key: 'no_chargebacks', text: 'Disputes between buyer and seller. No chargeback fees, no penalties.' },
                { key: 'no_floats', text: 'Funds go straight from the contract to your wallet. No processor holding your money.' },
                { key: 'no_freezes', text: 'Smart contracts execute even if our servers go down. Nobody can freeze funds.' },
                { key: 'no_vetting', text: 'No KYC, no KYB, no applications. Install and start accepting payments.' },
                { key: 'instant_setup', text: 'WordPress plugin, Shopify plugin, or one line of JavaScript.' },
                { key: 'flat_1%_fee', text: 'vs 1.5-3.5% + monthly fees + chargeback fees with traditional processors.' },
              ].map((item, i) => (
                <Fade key={item.key} delay={i * 0.05}>
                  <div className="flex gap-4">
                    <span className="text-neutral-600 text-xs shrink-0 pt-0.5" style={mono}>//</span>
                    <div>
                      <h3 className="text-sm font-medium text-white mb-1" style={mono}>{item.key}</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                </Fade>
              ))}
            </div>

            <Fade delay={0.3}>
              <div className="flex flex-wrap gap-3">
                <Link href="/plugins">
                  <button className={btnOutline}>$ view_integrations</button>
                </Link>
                <Link href="/merchant-savings-calculator">
                  <button className={btnOutline}>$ calculate_savings</button>
                </Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURES — BUYERS                                                */}
        {/* ================================================================ */}
        <section
          className="border-t border-neutral-800/60"
          aria-label="For buyers"
        >
          <div className="max-w-4xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p className="text-xs text-primary-500/70 mb-10" style={mono}>
                {'// for_buyers'}
              </p>
            </Fade>

            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-8">
              {[
                { key: 'buyer_protection', text: 'Funds held in smart contract. Dispute before payout date to freeze funds.' },
                { key: 'gas_free', text: 'No ETH or native coins needed. System covers gas in the background.' },
                { key: 'auto_wallet', text: 'Sign in with Google or email. No networks to choose, no addresses to copy.' },
                { key: 'non_custodial', text: 'The contract holds funds. Only buyer or seller can access them. Not even us.' },
              ].map((item, i) => (
                <Fade key={item.key} delay={i * 0.05}>
                  <div className="flex gap-4">
                    <span className="text-neutral-600 text-xs shrink-0 pt-0.5" style={mono}>//</span>
                    <div>
                      <h3 className="text-sm font-medium text-white mb-1" style={mono}>{item.key}</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* CTA + FOOTER                                                     */}
        {/* ================================================================ */}
        <section
          className="border-t border-neutral-800/60"
          aria-label="Get started"
        >
          <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-24 lg:pt-28 pb-16 lg:pb-20">
            <Fade>
              <p className="text-xs text-primary-500/70 mb-8" style={mono}>
                {'// get_started'}
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold text-white mb-3"
                style={mono}
              >
                Try it for free<Cursor />
              </h2>
              <p className="text-sm text-neutral-500 mb-10 max-w-md">
                Create a $0.001 test payment. No real money needed. Takes 60 seconds.
              </p>
              {isConnected ? (
                <div className="flex flex-wrap gap-3">
                  <Link href="/dashboard">
                    <button className={btnPrimary}>$ dashboard</button>
                  </Link>
                  <Link href="/create">
                    <button className={btnOutline}>$ create_escrow</button>
                  </Link>
                </div>
              ) : (
                <div className="max-w-sm [&>div]:text-left">
                  <ConnectWalletEmbedded
                    compact={true}
                    useSmartRouting={false}
                    showTwoOptionLayout={true}
                    buttonClassName={btnPrimary}
                  />
                </div>
              )}
            </Fade>

            {/* Footer */}
            <Fade delay={0.2}>
              <div className="mt-16 pt-8 border-t border-neutral-800/60 flex flex-wrap gap-x-8 gap-y-3 text-xs text-neutral-600" style={mono}>
                <a
                  href="https://github.com/conduit-ucpi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neutral-400 transition-colors"
                >
                  github
                </a>
                <Link href="/how-it-works" className="hover:text-neutral-400 transition-colors">
                  docs
                </Link>
                <Link href="/faq" className="hover:text-neutral-400 transition-colors">
                  faq
                </Link>
                <Link href="/plugins" className="hover:text-neutral-400 transition-colors">
                  integrations
                </Link>
                <a
                  href="mailto:info@conduit-ucpi.com"
                  className="hover:text-neutral-400 transition-colors"
                >
                  info@conduit-ucpi.com
                </a>
              </div>
            </Fade>
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
