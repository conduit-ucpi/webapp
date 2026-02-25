import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useScrollTracking, useTimeTracking, useVideoTracking } from '@/hooks/usePageTracking';
import Fade from '@/components/ui/Fade';
import { btnOutline } from '@/utils/landingStyles';

export default function Demos() {
  const pageTitle = "Demo Videos | Conduit UCPI Escrow Integrations";
  const pageDescription = "Watch demo videos showing how to integrate smart contract escrow into WordPress WooCommerce and Shopify stores.";

  useScrollTracking();
  useTimeTracking();

  const wordpressVideoRef = useVideoTracking('aYXG0hC7dFg', 'WordPress WooCommerce USDC Payment Plugin Demo');
  const shopifyVideoRef = useVideoTracking('gwdWiErYq6o', 'Shopify USDC Payment Integration Demo');

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content="index, follow" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors">

        {/* Hero */}
        <section className="flex items-center" aria-label="Hero">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16 lg:pb-20 w-full">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-10">
                Demos
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl">
                See it in action.
              </h1>
              <p
                className="mt-6 text-base text-secondary-500 dark:text-secondary-400 max-w-xl leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Watch how escrow checkout works in WordPress and Shopify.
              </p>
            </Fade>
          </div>
        </section>

        {/* WordPress Demo */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="WordPress demo"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                WordPress / WooCommerce
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-8"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Escrow checkout for WooCommerce
              </h2>

              <div className="mb-8" ref={wordpressVideoRef}>
                <div className="aspect-video bg-secondary-100 dark:bg-secondary-800 rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/aYXG0hC7dFg?enablejsapi=1"
                    title="WordPress WooCommerce USDC Payment Plugin Demo"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>
              </div>

              <a
                href="https://wordpress.org/plugins/usdc-payments-with-buyer-protection/"
                target="_blank"
                rel="noopener noreferrer"
                className={btnOutline}
              >
                Get WordPress Plugin &rarr;
              </a>
            </Fade>
          </div>
        </section>

        {/* Shopify Demo */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Shopify demo"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
            <Fade delay={0.1}>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Shopify
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-8"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Escrow checkout for Shopify
              </h2>

              <div className="mb-8" ref={shopifyVideoRef}>
                <div className="aspect-video bg-secondary-100 dark:bg-secondary-800 rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/gwdWiErYq6o?enablejsapi=1"
                    title="Shopify USDC Payment Integration Demo"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>
              </div>

              <Link href="/shopify/install-button" className={btnOutline}>
                Install Shopify Integration &rarr;
              </Link>
            </Fade>
          </div>
        </section>

        {/* Back to plugins */}
        <section className="border-t border-secondary-100 dark:border-secondary-800">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8">
            <Fade>
              <Link
                href="/plugins"
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                &larr; Back to integrations
              </Link>
            </Fade>
          </div>
        </section>

      </div>
    </>
  );
}
