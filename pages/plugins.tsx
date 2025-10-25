import React, { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import Button from '@/components/ui/Button';
import { initRedditPixel, trackConversion } from '@/lib/tracking';
import { useScrollTracking, useTimeTracking, useVideoTracking } from '@/hooks/usePageTracking';

export default function Plugins() {
  const pageTitle = "Smart Contract Escrow SDK for WordPress & Shopify | Non-Custodial Developer Tools";
  const pageDescription = "Non-custodial blockchain escrow infrastructure for e-commerce. Open-source developer tools for WordPress and Shopify integration. Smart contract-based buyer protection without custody of funds. Educational resources for implementing blockchain escrow.";
  const pageUrl = "https://conduit-ucpi.com/plugins";
  const imageUrl = "https://conduit-ucpi.com/og-plugins.png";

  // Structured data for Software Application
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

  // Initialize tracking hooks
  useScrollTracking(); // Track scroll depth (25%, 50%, 75%, 100%)
  useTimeTracking();   // Track time on page (30s, 60s, 120s, 300s)

  // Video tracking refs
  const wordpressVideoRef = useVideoTracking('aYXG0hC7dFg', 'WordPress WooCommerce USDC Payment Plugin Demo');
  const shopifyVideoRef = useVideoTracking('gwdWiErYq6o', 'Shopify USDC Payment Integration Demo');

  // Initialize Reddit Pixel on component mount
  useEffect(() => {
    const redditPixelId = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID;
    if (redditPixelId && redditPixelId !== 'your_reddit_pixel_id_here') {
      initRedditPixel(redditPixelId);
    }
  }, []);

  // Conversion tracking handlers
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
    <React.Fragment>
      {/* @ts-expect-error - Next.js Head component types issue */}
      <Head>
        {/* Primary Meta Tags */}
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content="blockchain escrow SDK, smart contract developer tools, non-custodial infrastructure, WordPress blockchain integration, Shopify Web3 tools, escrow smart contracts, decentralized buyer protection, WooCommerce blockchain plugin, Base network SDK, open-source escrow infrastructure" />

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
              Smart Contract Escrow Integration for E-Commerce Platforms
            </h1>
            <p className="text-lg sm:text-xl text-secondary-600 max-w-2xl">
              Developer tools for integrating blockchain-based buyer protection into WordPress and Shopify stores. Built on audited smart contracts, deployed on Base network infrastructure.
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
            <h2 className="text-xl sm:text-2xl font-bold text-secondary-900 mb-6">Developer SDK Features</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Rapid Integration SDK</h3>
              <p className="text-sm sm:text-base text-secondary-600">Production-ready developer tools with under 5 minutes integration time. Single-line SDK integration for WordPress and Shopify platforms.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Transparent Infrastructure Pricing</h3>
              <p className="text-sm sm:text-base text-secondary-600">Open-source codebase with 1% infrastructure fee (0.30 USDC minimum) for network operations. No monthly fees, no custody fees, no hidden charges. Early adopters receive rate lock guarantee.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Audited Smart Contract Infrastructure</h3>
              <p className="text-sm sm:text-base text-secondary-600">Automated dispute resolution via blockchain-enforced escrow logic. All escrow operations executed by audited smart contracts—no intermediary custody or control.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Technical Infrastructure (Not Financial Services)</h3>
              <p className="text-sm sm:text-base text-secondary-600">We provide technical infrastructure only—no financial services, no custody, no exchange functionality. Developers integrate our SDK to enable buyer-seller escrow logic. End users maintain full control of their wallets and funds.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">100% Non-Custodial Architecture</h3>
              <p className="text-sm sm:text-base text-secondary-600">Direct wallet-to-wallet settlement through smart contracts. We never hold, control, or have access to user funds. All escrow logic is executed on-chain by audited smart contracts that users interact with directly.</p>
            </div>
          </div>
          </section>

          {/* WordPress */}
          <section className="mb-12 border border-secondary-200 rounded-lg p-4 sm:p-6 lg:p-8" aria-labelledby="wordpress-heading">
          <div className="mb-6">
            <h2 id="wordpress-heading" className="text-xl sm:text-2xl font-bold text-secondary-900 mb-2">WordPress / WooCommerce Integration SDK</h2>
            <p className="text-sm sm:text-base text-secondary-600">Open-source developer plugin for integrating smart contract escrow functionality into WooCommerce stores. Non-custodial infrastructure with blockchain-enforced settlement logic.</p>
          </div>

          <div className="mb-6" ref={wordpressVideoRef}>
            <div className="aspect-video bg-secondary-100 rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/aYXG0hC7dFg?enablejsapi=1"
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
              onClick={handleWordPressClick}
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
              <h2 id="shopify-heading" className="text-xl sm:text-2xl font-bold text-secondary-900 mb-2">Shopify Integration SDK</h2>
              <p className="text-sm sm:text-base text-secondary-600">Developer tools for integrating blockchain escrow infrastructure into Shopify stores. Open-source smart contract integration with non-custodial dispute resolution logic.</p>
          </div>

          <div className="mb-6" ref={shopifyVideoRef}>
            <div className="aspect-video bg-secondary-100 rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/gwdWiErYq6o?enablejsapi=1"
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
            <Link href="/shopify/install-button" className="flex-1" onClick={handleShopifyClick}>
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

          {/* Important Disclaimer - For Regulatory Clarity */}
          <aside className="mt-12 sm:mt-16 bg-blue-50 border-l-4 border-blue-500 p-4 sm:p-6" role="note" aria-label="Product classification and regulatory information">
            <h2 className="text-lg sm:text-xl font-bold text-secondary-900 mb-3">Non-Custodial Developer Infrastructure</h2>
            <div className="space-y-2 text-sm sm:text-base text-secondary-700">
              <p><strong>What this is:</strong> Open-source smart contract infrastructure for implementing escrow functionality in e-commerce applications. Similar to how Stripe provides payment infrastructure, we provide blockchain-based escrow infrastructure.</p>
              <p><strong>What this is NOT:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Not a cryptocurrency exchange or trading platform</li>
                <li>Not selling, issuing, or trading any digital assets, tokens, or cryptocurrencies</li>
                <li>Not a custodial service - we never hold, control, or have access to user funds</li>
                <li>Not a financial services provider - we provide technical infrastructure only</li>
              </ul>
              <p className="mt-3"><strong>Technical Architecture:</strong> All funds remain under user control through non-custodial wallet connections. Escrow logic is executed by audited smart contracts deployed on the Base blockchain network. We provide the integration layer and user interface - settlement occurs directly between buyer and seller wallets via smart contracts.</p>
              <p className="mt-3 text-xs sm:text-sm italic">This is developer tooling and educational resources for blockchain-based escrow implementation, not a regulated financial product or cryptocurrency service.</p>
            </div>
          </aside>

        </article>
      </div>
    </React.Fragment>
  );
}
