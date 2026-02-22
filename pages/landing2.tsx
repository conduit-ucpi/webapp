import Link from 'next/link';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import SEO from '@/components/SEO';
import { GetStaticProps } from 'next';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState, ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function FadeInOnScroll({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1200; // ms
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {value}{suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Landing2() {
  let user = null;
  let isConnected = false;

  try {
    const authContext = useAuth();
    user = authContext.user;
    isConnected = authContext.isConnected;
  } catch (error) {
    // Auth context not available during SSR or hydration
  }

  const isAuthenticated = !!user;
  const siteName = getSiteNameFromDomain();

  const [showChevron, setShowChevron] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowChevron(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Same structured data as landing1 for SEO parity
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
      "sameAs": [
        "https://github.com/conduit-ucpi",
        "https://app.instantescrow.nz"
      ],
      "priceRange": "1%",
      "paymentAccepted": ["USDC", "Cryptocurrency", "Stablecoin"],
      "areaServed": { "@type": "Place", "name": "Worldwide" },
      "availableChannel": {
        "@type": "ServiceChannel",
        "serviceType": "Online Banking",
        "availableLanguage": "English"
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Escrow Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Time-Delayed Escrow Contracts",
              "description": "Secure smart contract payment holding with automatic release after delivery confirmation. Built-in buyer protection with instant dispute resolution. Gas-free transactions, no chargeback fees, final settlement once payout timer expires."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "E-commerce Integration",
              "description": "WordPress and Shopify plugins, JavaScript SDK for custom websites. Zero-setup POS requiring only a web browser. Built-in buyer protection, 1% fee, 10-minute installation."
            }
          }
        ]
      },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": "1",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "0.01",
          "priceCurrency": "USD",
          "referenceQuantity": {
            "@type": "QuantitativeValue",
            "value": "1",
            "unitText": "TRANSACTION"
          }
        }
      },
      "serviceType": "Cryptocurrency Escrow Service",
      "provider": { "@type": "Organization", "name": "Conduit UCPI", "url": "https://conduit-ucpi.com" },
      "termsOfService": "https://conduit-ucpi.com/terms-of-service",
      "slogan": "Stablecoin payments made safe and easy"
    }
  ];

  // Staggered hero animation variants
  const heroContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.15 } },
  };
  const heroItem = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as const } },
  };

  return (
    <>
      <SEO
        title="Conduit Escrow - Open Source Crypto Payments with Built-in Buyer Protection | 1% Fee"
        description="Get paid safely with blockchain escrow. 100% open source - audit the code yourself. Hold USDC payments in trust until delivery is confirmed. No lawyers, no banks - just security. 60 second setup, 1% fee, free testing."
        keywords="open source escrow, crypto escrow, blockchain escrow, USDC escrow, secure crypto payments, buyer protection, smart contract escrow, Base network escrow, trustless payments, cryptocurrency escrow, time-delayed payments, blockchain payment protection, auditable escrow, transparent blockchain"
        canonical="/"
        structuredData={structuredData}
      />

      <div className="bg-white dark:bg-secondary-900 transition-colors">
        {/* ---------------------------------------------------------------- */}
        {/* Section 1: Hero                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 relative" aria-label="Hero">
          <motion.div
            className="max-w-4xl mx-auto text-center"
            variants={heroContainer}
            initial="hidden"
            animate="show"
          >
            {/* Trust line */}
            <motion.p
              variants={heroItem}
              className="font-mono uppercase tracking-widest text-xs text-secondary-400 mb-8"
            >
              1% fee &middot; open source &middot; instant setup
            </motion.p>

            {/* Headline */}
            <motion.h1
              variants={heroItem}
              className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-secondary-900 dark:text-white"
            >
              Payments held in{' '}
              <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                trust
              </span>{' '}
              until delivery.
            </motion.h1>

            {/* Tagline */}
            <motion.p
              variants={heroItem}
              className="text-xl lg:text-2xl text-secondary-500 max-w-2xl mx-auto mt-6"
            >
              Smart contract escrow that protects buyers and sellers. No banks. No lawyers. No waiting.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={heroItem} className="mt-10">
              {isConnected ? (
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link href="/dashboard">
                    <Button size="lg" className="px-8 py-4 text-lg">
                      Go to Dashboard
                    </Button>
                  </Link>
                  <Link href="/create">
                    <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
                      Create Payment Request
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-2xl mx-auto text-left">
                  <div>
                    <p className="text-sm font-medium text-secondary-400 uppercase tracking-wide mb-3">For individuals</p>
                    <ConnectWalletEmbedded
                      compact={true}
                      useSmartRouting={false}
                      showTwoOptionLayout={true}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary-400 uppercase tracking-wide mb-3">For merchants</p>
                    <Link href="/plugins">
                      <Button variant="outline" size="lg" className="w-full">
                        Demos &amp; Integration
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-8 hidden sm:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: showChevron ? 0.5 : 0 }}
            transition={{ duration: 0.6 }}
          >
            <ChevronDownIcon className="w-6 h-6 text-secondary-400 animate-bounce" />
          </motion.div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Section 2: How It Works                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="py-32 lg:py-40 px-4 sm:px-6 lg:px-8" aria-label="How It Works">
          <div className="max-w-6xl mx-auto">
            <FadeInOnScroll>
              <h2 className="text-4xl lg:text-6xl font-bold text-secondary-900 dark:text-white tracking-tight text-center mb-20">
                Three steps. That&apos;s it.
              </h2>
            </FadeInOnScroll>

            <div className="grid md:grid-cols-3 gap-12 lg:gap-16">
              {[
                { num: '1', title: 'Create', desc: 'Seller sets up a payment request with a delivery timeframe.' },
                { num: '2', title: 'Fund', desc: 'Buyer puts funds into a secure smart contract escrow.' },
                { num: '3', title: 'Release', desc: 'Seller receives payment automatically after the agreed date.' },
              ].map((step, i) => (
                <FadeInOnScroll key={step.num} delay={i * 0.15}>
                  <div className="relative pt-16">
                    <span className="absolute top-0 left-0 text-[8rem] leading-none font-bold text-secondary-100 dark:text-secondary-800 select-none pointer-events-none">
                      {step.num}
                    </span>
                    <div className="relative">
                      <h3 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-secondary-500 dark:text-secondary-400">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </FadeInOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Section 3: Stats — Dark Section                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-secondary-900 dark:bg-black py-32 lg:py-40 px-4 sm:px-6 lg:px-8" aria-label="Stats">
          <div className="max-w-4xl mx-auto space-y-20 lg:space-y-24">
            {[
              {
                target: 1,
                suffix: '%',
                label: 'flat fee',
                desc: 'No monthly fees. No dispute fees. No minimums.',
              },
              {
                target: 0,
                suffix: '',
                label: 'setup cost',
                desc: 'Open source. Self-install in 10 minutes.',
                prefix: '$',
              },
              {
                target: 60,
                suffix: 's',
                label: 'to get started',
                desc: 'Connect a wallet and create your first escrow.',
              },
            ].map((stat, i) => (
              <FadeInOnScroll key={i} delay={i * 0.1}>
                <div className="text-center">
                  <p className="text-5xl lg:text-7xl font-bold text-primary-400">
                    {stat.prefix ?? ''}
                    <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                  </p>
                  <p className="font-mono uppercase tracking-widest text-xs text-secondary-400 mt-3">
                    {stat.label}
                  </p>
                  <p className="text-secondary-400 mt-2 text-lg">
                    {stat.desc}
                  </p>
                </div>
              </FadeInOnScroll>
            ))}

            <FadeInOnScroll delay={0.3}>
              <div className="text-center">
                <Link
                  href="/merchant-savings-calculator"
                  className="text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Calculate your savings vs. traditional processors &rarr;
                </Link>
              </div>
            </FadeInOnScroll>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Section 4: Final CTA                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="pt-24 lg:pt-32 pb-16 lg:pb-24 px-4 sm:px-6 lg:px-8" aria-label="Get Started">
          <div className="max-w-3xl mx-auto text-center">
            <FadeInOnScroll>
              <h2 className="text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-white tracking-tight">
                Ready to try it?
              </h2>
            </FadeInOnScroll>

            <FadeInOnScroll delay={0.1}>
              <p className="text-xl text-secondary-500 mt-4">
                Free to test. 1% when you go live.
              </p>
            </FadeInOnScroll>

            <FadeInOnScroll delay={0.2}>
              <div className="mt-10">
                {isConnected ? (
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Link href="/dashboard">
                      <Button size="lg" className="px-8 py-4 text-lg">
                        Go to Dashboard
                      </Button>
                    </Link>
                    <Link href="/create">
                      <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
                        Create Payment Request
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-2xl mx-auto text-left">
                    <div>
                      <p className="text-sm font-medium text-secondary-400 uppercase tracking-wide mb-3">For individuals</p>
                      <ConnectWalletEmbedded
                        compact={true}
                        useSmartRouting={false}
                        showTwoOptionLayout={true}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-400 uppercase tracking-wide mb-3">For merchants</p>
                      <Link href="/plugins">
                        <Button variant="outline" size="lg" className="w-full">
                          Demos &amp; Integration
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </FadeInOnScroll>

            <FadeInOnScroll delay={0.3}>
              <div className="mt-12 space-y-3">
                <a
                  href="https://github.com/conduit-ucpi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  100% open source &mdash; audit every line
                </a>
                <p className="text-sm text-secondary-400">
                  <a href="mailto:info@conduit-ucpi.com" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                    info@conduit-ucpi.com
                  </a>
                </p>
              </div>
            </FadeInOnScroll>
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
