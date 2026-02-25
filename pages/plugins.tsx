import React, { useEffect, useRef, useState, ReactNode } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { initRedditPixel, trackConversion } from '@/lib/tracking';
import { useScrollTracking, useTimeTracking } from '@/hooks/usePageTracking';
import { motion, useInView, AnimatePresence } from 'framer-motion';

// Page-local button styles matching landing4
const btn = 'inline-flex items-center justify-center font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 focus-visible:ring-offset-2';
const btnPrimary = `${btn} text-[15px] bg-secondary-900 dark:bg-white text-white dark:text-secondary-900 hover:bg-secondary-700 dark:hover:bg-secondary-100 px-8 py-3.5`;

// ---------------------------------------------------------------------------
// Fade-in helper — triggers once when the element scrolls into view
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
// Collapsible section — eyebrow + heading always visible, content toggles
// ---------------------------------------------------------------------------

function Collapsible({
  eyebrow,
  heading,
  children,
  defaultOpen = false,
  className = '',
}: {
  eyebrow: string;
  heading?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left group cursor-pointer"
      >
        {heading ? (
          <>
            <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
              {eyebrow}
            </p>
            <div className="flex items-start justify-between gap-4">
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                {heading}
              </h2>
              <span className="mt-2 flex-shrink-0 text-secondary-400 dark:text-secondary-500 transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-medium text-secondary-900 dark:text-white">
              {eyebrow}
            </h3>
            <span className="flex-shrink-0 text-secondary-400 dark:text-secondary-500 transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-8">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Plugins() {
  const pageTitle = "Smart Contract Escrow SDK for WordPress & Shopify | Non-Custodial Developer Tools";
  const pageDescription = "Non-custodial blockchain escrow infrastructure for e-commerce. Open-source developer tools for WordPress and Shopify integration. Smart contract-based buyer protection without custody of funds. Educational resources for implementing blockchain escrow.";
  const pageUrl = "https://conduit-ucpi.com/plugins";
  const imageUrl = "https://conduit-ucpi.com/og-plugins.png";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Conduit UCPI - Smart Contract Escrow SDK",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Open-source infrastructure with 1% transaction fee (0.30 USDC minimum), no monthly fees"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5",
      "ratingCount": "1"
    },
    "featureList": [
      "Non-custodial smart contract infrastructure",
      "Open-source blockchain escrow SDK",
      "WordPress and Shopify developer integration tools",
      "Audited smart contracts on Base network",
      "Direct wallet-to-wallet settlement (no custody)",
      "Automated dispute resolution logic",
      "Educational resources for blockchain escrow",
      "3-minute integration time"
    ],
    "description": pageDescription,
    "url": pageUrl,
    "creator": {
      "@type": "Organization",
      "name": "Conduit UCPI",
      "url": "https://conduit-ucpi.com"
    }
  };

  useScrollTracking();
  useTimeTracking();

  useEffect(() => {
    const redditPixelId = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID;
    if (redditPixelId && redditPixelId !== 'your_reddit_pixel_id_here') {
      initRedditPixel(redditPixelId);
    }
  }, []);

  const handleWordPressClick = () => {
    trackConversion({
      conversionType: 'wordpress_plugin',
      buttonText: 'Get WordPress Plugin',
      targetUrl: 'https://wordpress.org/plugins/usdc-payments-with-buyer-protection/',
    });
  };

  const handleShopifyClick = () => {
    trackConversion({
      conversionType: 'shopify_integration',
      buttonText: 'Install Shopify Integration',
      targetUrl: '/shopify/install-button',
    });
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content="blockchain escrow SDK, smart contract developer tools, non-custodial infrastructure, WordPress blockchain integration, Shopify Web3 tools, escrow smart contracts, decentralized buyer protection, WooCommerce blockchain plugin, Base network SDK, open-source escrow infrastructure" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:site_name" content="Conduit UCPI" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        <meta property="twitter:image" content={imageUrl} />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="author" content="Conduit UCPI" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors">

        {/* ================================================================ */}
        {/* HERO                                                             */}
        {/* ================================================================ */}
        <section className="flex items-center" aria-label="Hero">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16 lg:pb-20 w-full">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-10">
                Integrations
              </p>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl"
              >
                Add escrow checkout to your store.
              </h1>
              <p
                className="mt-6 text-base text-secondary-500 dark:text-secondary-400 max-w-xl leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                WordPress. Shopify. Any website. Under 5 minutes.
              </p>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* INTEGRATIONS                                                     */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Integrations"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
            <Fade>
              <h2 className="text-lg font-medium text-secondary-900 dark:text-white mb-8">
                Integrate the checkout for your site:
              </h2>
            </Fade>

            <div className="space-y-0 divide-y divide-secondary-100 dark:divide-secondary-800">
              {/* WordPress */}
              <Fade>
                <div className="py-6 first:pt-0">
                  <Collapsible eyebrow="WordPress / WooCommerce">
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md">
                      Open-source plugin for integrating smart contract escrow into WooCommerce stores. Non-custodial infrastructure with blockchain-enforced settlement.
                    </p>

                    <div className="flex items-center gap-6 flex-wrap">
                      <a
                        href="https://wordpress.org/plugins/usdc-payments-with-buyer-protection/"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleWordPressClick}
                      >
                        <button className={btnPrimary}>Get WordPress Plugin</button>
                      </a>
                      <Link
                        href="/demos"
                        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                      >
                        Watch demo &rarr;
                      </Link>
                    </div>
                  </Collapsible>
                </div>
              </Fade>

              {/* Shopify */}
              <Fade delay={0.1}>
                <div className="py-6">
                  <Collapsible eyebrow="Shopify">
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md">
                      Smart contract integration for Shopify stores. Open-source escrow with non-custodial dispute resolution.
                    </p>

                    <div className="flex items-center gap-6 flex-wrap">
                      <Link href="/shopify/install-button" onClick={handleShopifyClick}>
                        <button className={btnPrimary}>Install Shopify Integration</button>
                      </Link>
                      <Link
                        href="/demos"
                        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                      >
                        Watch demo &rarr;
                      </Link>
                    </div>
                  </Collapsible>
                </div>
              </Fade>

              {/* JavaScript SDK */}
              <Fade delay={0.2}>
                <div className="py-6 last:pb-0">
                  <Collapsible eyebrow="Any website">
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md">
                      Add secure USDC payments with built-in buyer protection using 3 lines of code.
                    </p>

                    <div className="mb-10">
                      <pre className="bg-secondary-900 dark:bg-secondary-800 text-green-400 p-6 rounded-lg overflow-x-auto text-xs sm:text-sm leading-relaxed">
                        <code>{`<!-- Add script to your HTML -->
<script src="https://conduit-ucpi.com/sdk/checkout.js"></script>

<!-- Add checkout button -->
<button id="checkout-btn">Pay with USDC</button>

<!-- Initialize checkout -->
<script>
  ConduitCheckout.init({
    amount: 99.99,
    description: "Product Name",
    onSuccess: (txHash) => {
      console.log("Payment successful:", txHash);
    }
  });
</script>`}</code>
                      </pre>
                    </div>

                    <Link href="/integrate">
                      <button className={btnPrimary}>View Integration Guide</button>
                    </Link>
                  </Collapsible>
                </div>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* THE OPPORTUNITY                                                  */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Market opportunity"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
            <Fade>
              <Collapsible
                eyebrow="The opportunity"
                heading="$9.7 trillion in monthly crypto volume. Almost none of it spent on goods — yet."
              >
                <div className="space-y-6 max-w-2xl">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Commerce represents 0.003% of crypto transaction volume — over 100x less than traditional finance. The reason? No buyer protection. Without purchase guarantees, rational consumers won&apos;t use crypto to buy things.
                  </p>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Smart contract escrow solves both sides: buyers get time-locked purchase protection, and merchants eliminate chargeback fraud through blockchain-enforced settlements.
                  </p>
                </div>
              </Collapsible>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURES                                                         */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Features"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
            <Fade>
              <Collapsible eyebrow="What you get" heading="Non-custodial escrow infrastructure.">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
                  {[
                    {
                      label: 'Rapid integration',
                      text: 'Production-ready plugins with under 5 minutes integration time. Single-line SDK for WordPress, Shopify, or any website.',
                    },
                    {
                      label: 'Transparent pricing',
                      text: '1% infrastructure fee (0.30 USDC minimum). No monthly fees, no custody fees, no hidden charges.',
                    },
                    {
                      label: 'Audited smart contracts',
                      text: 'Automated dispute resolution via blockchain-enforced escrow logic. All operations executed by audited contracts on Base network.',
                    },
                    {
                      label: 'Non-custodial',
                      text: 'Direct wallet-to-wallet settlement. We never hold, control, or have access to user funds. All escrow logic is on-chain.',
                    },
                    {
                      label: 'Technical infrastructure only',
                      text: 'No financial services, no custody, no exchange. Developers integrate our SDK — end users maintain full control of their wallets.',
                    },
                    {
                      label: 'Open source',
                      text: 'Full codebase available for review. Verify the smart contracts, inspect the infrastructure, contribute improvements.',
                    },
                  ].map((item, i) => (
                    <div key={i}>
                      <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-1">
                        {item.label}
                      </h3>
                      <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </Collapsible>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* HOW IT WORKS                                                     */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="How it works"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
            <Fade>
              <Collapsible eyebrow="How it works" heading="Escrow, dispute, settle.">
                <div className="grid md:grid-cols-3 gap-x-12 gap-y-16">
                  {[
                    {
                      num: '01',
                      title: 'Escrow',
                      desc: 'Funds are secured in audited smart contracts on Base network. Settlement is automated and cryptographically guaranteed — no intermediary custody.',
                    },
                    {
                      num: '02',
                      title: 'Dispute',
                      desc: 'Buyers can trigger dispute resolution through the smart contract. Time-locked escrow prevents premature fund release during dispute windows.',
                    },
                    {
                      num: '03',
                      title: 'Settle',
                      desc: 'Undisputed transactions settle automatically after the protection period. Disputed transactions enter structured arbitration with blockchain-recorded resolution.',
                    },
                  ].map((step, i) => (
                    <div key={step.num}>
                      <span className="text-[3.5rem] sm:text-[5rem] leading-none font-extralight text-secondary-100 dark:text-secondary-800 select-none block mb-4">
                        {step.num}
                      </span>
                      <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-12">
                  <Link
                    href="/arbitration-policy"
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    View arbitration framework and dispute resolution procedures &rarr;
                  </Link>
                </div>
              </Collapsible>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* DISCLAIMER                                                       */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Disclaimer"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
            <Fade>
              <Collapsible eyebrow="Non-custodial developer infrastructure" heading="Technical infrastructure, not financial services.">
                <div className="space-y-4 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed max-w-2xl">
                  <p>
                    <strong className="text-secondary-900 dark:text-white">What this is:</strong> Open-source smart contract infrastructure for implementing escrow functionality in e-commerce applications. Similar to how Stripe provides payment infrastructure, we provide blockchain-based escrow infrastructure.
                  </p>
                  <div>
                    <strong className="text-secondary-900 dark:text-white">What this is not:</strong>
                    <ul className="mt-2 space-y-1 list-disc ml-5">
                      <li>Not a cryptocurrency exchange or trading platform</li>
                      <li>Not selling, issuing, or trading any digital assets</li>
                      <li>Not a custodial service — we never hold or control user funds</li>
                      <li>Not a financial services provider — technical infrastructure only</li>
                    </ul>
                  </div>
                  <p>
                    All funds remain under user control through non-custodial wallet connections. Escrow logic is executed by audited smart contracts on the Base network. We provide the integration layer and user interface — settlement occurs directly between buyer and seller wallets.
                  </p>
                  <p className="text-xs text-secondary-400 dark:text-secondary-500 italic">
                    This is developer tooling for blockchain-based escrow implementation, not a regulated financial product or cryptocurrency service.
                  </p>
                </div>
              </Collapsible>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOOTER                                                           */}
        {/* ================================================================ */}
        <section className="border-t border-secondary-100 dark:border-secondary-800">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8">
            <Fade>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
                <Link href="/faq" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  FAQ
                </Link>
                <a
                  href="mailto:info@conduit-ucpi.com"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  Technical support
                </a>
              </div>
            </Fade>
          </div>
        </section>

      </div>
    </>
  );
}
