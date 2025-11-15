import React from 'react';
import Link from 'next/link';
import Head from 'next/head';

export default function ShopifyIndex() {
  const pageTitle = "USDC Payments for Shopify | Cryptocurrency Checkout Integration";
  const pageDescription = "Accept USDC cryptocurrency payments on your Shopify store with built-in smart contract escrow protection. Free to install, only 1% fee, 14-day buyer protection, no monthly fees.";
  const pageUrl = "https://conduit-ucpi.com/shopify";
  const imageUrl = "https://conduit-ucpi.com/og-shopify.png";

  // Structured data for Software Application
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "USDC Payments for Shopify",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free to install, 1% transaction fee, no monthly fees"
    },
    "featureList": [
      "USDC cryptocurrency payment processing for Shopify",
      "Smart contract escrow with 14-day buyer protection",
      "2-minute installation",
      "1% transaction fee",
      "No monthly fees or gas fees",
      "Direct wallet payments",
      "Automatic escrow protection",
      "Works on any Shopify store"
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
      <Head>
        {/* Primary Meta Tags */}
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content="USDC Shopify, cryptocurrency payments Shopify, Shopify crypto checkout, USDC payment gateway, blockchain payments Shopify, Web3 Shopify integration, stablecoin payments, escrow protection Shopify" />

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

      <div className="bg-gray-50 min-h-screen py-8 sm:py-10 lg:py-12 px-4 sm:px-6">
        <article className="max-w-4xl mx-auto bg-white rounded-lg p-6 sm:p-8 lg:p-10 shadow-md">
          <header className="text-center mb-8 sm:mb-10">
            <h1 className="text-secondary-900 mb-3 sm:mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold">Enterprise USDC Payment Gateway for Shopify</h1>
            <p className="text-secondary-600 text-base sm:text-lg lg:text-xl leading-relaxed mb-6 sm:mb-8">
              Production-grade cryptocurrency payment processing with blockchain-enforced buyer protection.<br className="hidden sm:block" />
              <strong>No monthly fees • 1% transaction rate • Smart contract escrow infrastructure</strong>
            </p>
          </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 my-8 sm:my-10 lg:my-12" aria-label="Platform capabilities">
          <div className="p-6 sm:p-8 border-2 border-primary-500 rounded-xl bg-blue-50">
            <h2 className="text-primary-500 mb-3 sm:mb-4 text-xl sm:text-2xl font-bold">Merchant Features</h2>
            <p className="text-secondary-600 mb-4 sm:mb-5 text-sm sm:text-base">Integrate USDC payment processing into your Shopify infrastructure</p>
            <ul className="text-left text-secondary-700 pl-5 mb-5 sm:mb-6 space-y-2 text-sm sm:text-base">
              <li>✓ Transparent 1% transaction fee, no recurring costs</li>
              <li>✓ Automated blockchain escrow on all transactions</li>
              <li>✓ Non-custodial settlement to your wallet</li>
              <li>✓ Compatible with all Shopify store configurations</li>
            </ul>
            <Link
              href="/shopify/install-button"
              className="bg-primary-500 text-white py-3 px-6 sm:py-4 sm:px-7 rounded-lg no-underline inline-block font-semibold text-sm sm:text-base hover:bg-primary-600 transition-colors"
            >
              View Integration Guide
            </Link>
          </div>

          <div className="p-6 sm:p-8 border-2 border-green-500 rounded-xl bg-green-50">
            <h2 className="text-green-600 mb-3 sm:mb-4 text-xl sm:text-2xl font-bold">Buyer Protection</h2>
            <p className="text-secondary-600 mb-4 sm:mb-5 text-sm sm:text-base">Enterprise-grade security for cryptocurrency transactions</p>
            <ul className="text-left text-secondary-700 pl-5 mb-5 sm:mb-6 space-y-2 text-sm sm:text-base">
              <li>✓ Gas-free transactions via sponsored execution</li>
              <li>✓ 14-day dispute resolution window</li>
              <li>✓ Web3 wallet or email authentication options</li>
              <li>✓ Smart contract-enforced buyer guarantees</li>
            </ul>
            <a
              href="#how-it-works"
              className="bg-green-500 text-white py-3 px-6 sm:py-4 sm:px-7 rounded-lg no-underline inline-block font-semibold text-sm sm:text-base hover:bg-green-600 transition-colors"
            >
              Technical Overview
            </a>
          </div>
        </section>

        <section id="how-it-works" className="text-left my-10 sm:my-12 lg:my-16" aria-labelledby="how-it-works-heading">
          <h2 id="how-it-works-heading" className="text-secondary-900 mb-6 sm:mb-8 text-center text-2xl sm:text-3xl font-bold">Integration & Transaction Flow</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 my-6 sm:my-8">
            <div>
              <h3 className="text-primary-500 mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">Merchant Implementation:</h3>
              <ol className="text-secondary-700 pl-5 leading-relaxed space-y-2 text-sm sm:text-base">
                <li>Add single-line JavaScript integration to Shopify theme</li>
                <li>USDC payment option appears on all product pages</li>
                <li>Customer selection triggers secure blockchain checkout flow</li>
                <li>Funds enter smart contract escrow with 14-day protection window</li>
                <li>Automated settlement to merchant wallet after protection period</li>
              </ol>
            </div>

            <div>
              <h3 className="text-green-600 mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">Customer Transaction Process:</h3>
              <ol className="text-secondary-700 pl-5 leading-relaxed space-y-2 text-sm sm:text-base">
                <li>Select USDC payment method at checkout</li>
                <li>Authenticate via Web3 wallet or email-based custody</li>
                <li>Execute USDC transfer with sponsored gas fees</li>
                <li>Funds secured in time-locked escrow smart contract</li>
                <li>Dispute resolution available throughout protection period</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="bg-blue-50 p-6 sm:p-8 rounded-xl my-8 sm:my-10" aria-label="Platform advantages">
          <h3 className="text-secondary-900 mb-4 sm:mb-5 text-xl sm:text-2xl font-bold">Platform Advantages</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 text-left">
            <div>
              <p className="font-semibold mb-2 text-sm sm:text-base"><strong>Merchant Benefits:</strong></p>
              <ul className="text-secondary-700 pl-5 space-y-1 text-sm sm:text-base">
                <li>Irreversible transactions eliminate chargeback fraud</li>
                <li>Near-instant settlement compared to traditional rails</li>
                <li>Borderless payment acceptance via blockchain infrastructure</li>
                <li>Lower processing fees than traditional card networks</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2 text-sm sm:text-base"><strong>Customer Security:</strong></p>
              <ul className="text-secondary-700 pl-5 space-y-1 text-sm sm:text-base">
                <li>USD-pegged stablecoin eliminates volatility risk</li>
                <li>No traditional financial institution dependencies</li>
                <li>Cryptographic buyer protection via smart contracts</li>
                <li>Privacy-preserving transaction architecture</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-primary-500 to-purple-600 text-white p-6 sm:p-8 lg:p-10 rounded-xl my-8 sm:my-10 text-center" aria-label="Integration call to action">
          <h3 className="mb-4 sm:mb-5 text-2xl sm:text-3xl font-bold">Deploy Cryptocurrency Payment Infrastructure</h3>
          <p className="mb-6 sm:mb-8 opacity-90 text-sm sm:text-base lg:text-lg">Begin accepting USDC payments with blockchain-enforced escrow protection</p>
          <Link
            href="/shopify/install-button"
            className="bg-white text-primary-500 py-3 px-6 sm:py-4 sm:px-8 rounded-lg no-underline inline-block font-bold text-base sm:text-lg hover:bg-gray-100 transition-colors"
          >
            View Integration Documentation
          </Link>
        </section>

        <footer className="border-t border-gray-200 pt-6 sm:pt-8 mt-10 sm:mt-12">
          <p className="text-secondary-600 text-sm sm:text-base text-center">
            <Link href="/faq" className="text-primary-500 hover:text-primary-600">Technical Documentation</Link> •{' '}
            <Link href="/dashboard" className="text-primary-500 hover:text-primary-600">Enterprise Support</Link>
          </p>
        </footer>
        </article>
      </div>
    </React.Fragment>
  );
}