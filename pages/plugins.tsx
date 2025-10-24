import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import Button from '@/components/ui/Button';

export default function Plugins() {
  const pageTitle = "USDC Checkout Plugins for WordPress & Shopify | Crypto Payment Gateway";
  const pageDescription = "Accept USDC cryptocurrency payments on your WordPress or Shopify store with built-in buyer protection. 1% fee, 3-minute setup, no KYC required. Smart contract escrow with automated dispute resolution.";
  const pageUrl = "https://conduit-ucpi.com/plugins";
  const imageUrl = "https://conduit-ucpi.com/og-plugins.png";

  // Structured data for Software Application
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "USDC Checkout for WordPress & Shopify",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "1% transaction fee (0.30 USDC minimum), no monthly fees"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5",
      "ratingCount": "1"
    },
    "featureList": [
      "USDC cryptocurrency payment processing",
      "Smart contract escrow with buyer protection",
      "3-minute setup time",
      "1% transaction fee",
      "No KYC/KYB requirements",
      "Direct wallet-to-wallet payments",
      "Automated dispute resolution",
      "WordPress and Shopify integration"
    ],
    "description": pageDescription,
    "url": pageUrl,
    "creator": {
      "@type": "Organization",
      "name": "Conduit UCPI",
      "url": "https://conduit-ucpi.com"
    }
  };

  return (
    <React.Fragment>
      {/* @ts-expect-error - Next.js Head component types issue */}
      <Head>
        {/* Primary Meta Tags */}
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content="USDC payments, cryptocurrency checkout, WordPress payment plugin, Shopify crypto payments, Web3 payments, blockchain escrow, buyer protection, smart contract payments, WooCommerce crypto, Base network payments" />

        {/* Canonical URL */}
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:site_name" content="Conduit UCPI" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        <meta property="twitter:image" content={imageUrl} />

        {/* Additional SEO Meta Tags */}
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="author" content="Conduit UCPI" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>

      <div className="bg-white min-h-screen">
        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-20">

          {/* Hero */}
          <header className="mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-4">
              Enterprise-Grade USDC Payment Processing for E-Commerce
            </h1>
            <p className="text-lg sm:text-xl text-secondary-600 max-w-2xl">
              Accept cryptocurrency payments with blockchain-backed buyer protection. Built on audited smart contracts, deployed on Base network infrastructure.
            </p>
          </header>

          {/* The Market Opportunity */}
          <section className="mb-12 sm:mb-16 border-l-4 border-secondary-300 pl-4 sm:pl-6 py-2" aria-label="Market opportunity">
          <p className="text-base sm:text-lg text-secondary-700 mb-3">
            <strong>The cryptocurrency market processes $9.7 trillion in monthly transactions.</strong> Yet only 0.003% of that volume is spent on goods and services. In traditional finance, commerce represents 0.4% of transaction volume—over 100x higher.
          </p>
          <p className="text-base sm:text-lg text-secondary-700 mb-3">
            This gap represents a massive untapped market for merchants. What's preventing cryptocurrency holders from spending? <strong>The absence of buyer protection.</strong> Without purchase guarantees equivalent to credit card chargebacks, rational consumers won't use crypto for e-commerce.
          </p>
          <p className="text-base sm:text-lg text-secondary-700">
            Our smart contract escrow system solves both sides of the equation: it provides buyers with time-locked purchase protection—removing their barrier to spending—while simultaneously <strong>eliminating chargeback fraud for merchants</strong> through blockchain-enforced settlements.
          </p>
          </section>

          {/* What you get */}
          <section className="mb-12 sm:mb-16" aria-label="Platform features">
            <h2 className="text-xl sm:text-2xl font-bold text-secondary-900 mb-6">Platform Features</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Rapid Integration</h3>
              <p className="text-sm sm:text-base text-secondary-600">Production-ready implementation in under 5 minutes. Single-line integration for WordPress and Shopify.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Transparent Pricing: 1% Transaction Fee</h3>
              <p className="text-sm sm:text-base text-secondary-600">0.30 USDC minimum per transaction. No monthly fees, no gas fees, no hidden charges. Early adopters receive rate lock guarantee.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Smart Contract Escrow Protection</h3>
              <p className="text-sm sm:text-base text-secondary-600">Automated dispute resolution via blockchain-enforced escrow. Provides buyers the same security guarantees as traditional payment processors.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Regulatory Compliance</h3>
              <p className="text-sm sm:text-base text-secondary-600">Operates within existing regulatory frameworks. No KYC/KYB requirements for merchants or customers under current guidelines.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Non-Custodial Architecture</h3>
              <p className="text-sm sm:text-base text-secondary-600">Direct wallet-to-wallet settlement. We process transactions without custody of funds—all escrow is handled by audited smart contracts.</p>
            </div>
          </div>
          </section>

          {/* WordPress */}
          <section className="mb-12 border border-secondary-200 rounded-lg p-4 sm:p-6 lg:p-8" aria-labelledby="wordpress-heading">
          <div className="mb-6">
            <h2 id="wordpress-heading" className="text-xl sm:text-2xl font-bold text-secondary-900 mb-2">WordPress / WooCommerce Plugin</h2>
            <p className="text-sm sm:text-base text-secondary-600">Production-ready USDC payment gateway for WooCommerce. Features blockchain-enforced escrow and automated settlement.</p>
          </div>

          <div className="mb-6">
            <div className="aspect-video bg-secondary-100 rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/aYXG0hC7dFg"
                title="WordPress WooCommerce USDC Payment Plugin Demo - Crypto Checkout with Buyer Protection"
                aria-label="Video demonstration of USDC payment plugin for WordPress and WooCommerce"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          </div>

          <nav className="flex flex-col sm:flex-row gap-3 sm:gap-4" aria-label="WordPress plugin actions">
            <a
              href="https://wordpress.org/plugins/usdc-payments-with-buyer-protection/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button size="lg" className="w-full">
                Get WordPress Plugin
              </Button>
            </a>
            <Link href="/faq" className="flex-1">
              <Button variant="outline" size="lg" className="w-full">
                FAQ
              </Button>
            </Link>
          </nav>
          </section>

          {/* Shopify */}
          <section className="mb-12 border border-secondary-200 rounded-lg p-4 sm:p-6 lg:p-8" aria-labelledby="shopify-heading">
            <div className="mb-6">
              <h2 id="shopify-heading" className="text-xl sm:text-2xl font-bold text-secondary-900 mb-2">Shopify Integration</h2>
              <p className="text-sm sm:text-base text-secondary-600">Enterprise cryptocurrency payment processing for Shopify merchants. Includes smart contract escrow and dispute resolution infrastructure.</p>
          </div>

          <div className="mb-6">
            <div className="aspect-video bg-secondary-100 rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/gwdWiErYq6o"
                title="Shopify USDC Payment Integration Demo - Cryptocurrency Checkout with Smart Contract Escrow"
                aria-label="Video demonstration of USDC payment integration for Shopify stores"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          </div>

          <nav className="flex flex-col sm:flex-row gap-3 sm:gap-4" aria-label="Shopify integration actions">
            <Link href="/shopify/install-button" className="flex-1">
              <Button size="lg" className="w-full">
                Install Shopify Integration
              </Button>
            </Link>
            <Link href="/faq" className="flex-1">
              <Button variant="outline" size="lg" className="w-full">
                FAQ
              </Button>
            </Link>
          </nav>
          </section>

          {/* How it works */}
          <section className="mb-12 sm:mb-16" aria-labelledby="how-it-works-heading">
            <h2 id="how-it-works-heading" className="text-xl sm:text-2xl font-bold text-secondary-900 mb-6">How Smart Contract Buyer Protection Works</h2>
          <div className="space-y-4 sm:space-y-6">
            <div className="flex gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <p className="font-semibold text-secondary-900 text-base sm:text-lg">Blockchain-Enforced Escrow</p>
                <p className="text-sm sm:text-base text-secondary-600">Funds are secured in audited smart contracts deployed on Base network. Settlement is automated and cryptographically guaranteed—no intermediary custody.</p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <p className="font-semibold text-secondary-900 text-base sm:text-lg">Dispute Initiation Protocol</p>
                <p className="text-sm sm:text-base text-secondary-600">Buyers can trigger dispute resolution through the smart contract interface. Time-locked escrow prevents premature fund release during dispute windows.</p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <p className="font-semibold text-secondary-900 text-base sm:text-lg">Automated Resolution & Settlement</p>
                <p className="text-sm sm:text-base text-secondary-600">Undisputed transactions settle automatically after the protection period. Disputed transactions enter structured arbitration with blockchain-recorded resolution.</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link href="/arbitration-policy" className="text-sm sm:text-base text-primary-600 hover:text-primary-700 font-medium">
              View complete arbitration framework and dispute resolution procedures →
            </Link>
          </div>
          </section>

          {/* Bottom links */}
          <footer className="border-t border-secondary-200 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-between text-sm sm:text-base">
            <Link href="/faq" className="text-secondary-600 hover:text-secondary-900">
              Integration Documentation & FAQ
            </Link>
            <a href="mailto:info@conduit-ucpi.com" className="text-secondary-600 hover:text-secondary-900">
              Technical Support & Enterprise Inquiries
            </a>
          </div>
          </footer>

        </article>
      </div>
    </React.Fragment>
  );
}
