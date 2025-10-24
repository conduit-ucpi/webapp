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
    <>
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
              USDC Checkout for WordPress & Shopify
            </h1>
            <p className="text-lg sm:text-xl text-secondary-600 max-w-2xl">
              Crypto holders have money but nowhere safe to spend it. Your store could be one of the few places they trust.
            </p>
          </header>

          {/* The Problem */}
          <section className="mb-12 sm:mb-16 border-l-4 border-secondary-300 pl-4 sm:pl-6 py-2" aria-label="The cryptocurrency spending problem">
          <p className="text-base sm:text-lg text-secondary-700 mb-3">
            Every month, $9.7 trillion in crypto changes hands. But only $300 million gets spent on actual goods and services.
          </p>
          <p className="text-base sm:text-lg text-secondary-700">
            That's 700 million people with crypto who aren't spending it because they don't feel safe. They need buyer protection like they get with card payments.
          </p>
          </section>

          {/* What you get */}
          <section className="mb-12 sm:mb-16" aria-label="Features and benefits">
            <h2 className="text-xl sm:text-2xl font-bold text-secondary-900 mb-6">What you get</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">3 minute setup</h3>
              <p className="text-sm sm:text-base text-secondary-600">Install the plugin, connect your wallet. That's it.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">1% fee (0.30 USDC minimum)</h3>
              <p className="text-sm sm:text-base text-secondary-600">First 20 merchants get this rate locked in forever. No monthly fees, no gas fees, no refund fees.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Buyer protection built in</h3>
              <p className="text-sm sm:text-base text-secondary-600">Smart contract escrow with automated dispute system. Buyers get the safety they're used to from card payments.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">No KYC/KYB required</h3>
              <p className="text-sm sm:text-base text-secondary-600">Neither you nor your customers need to verify identity or submit business documents.</p>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-secondary-900 mb-1">Direct to your wallet</h3>
              <p className="text-sm sm:text-base text-secondary-600">No intermediary. Contracts are between buyer and seller only - we can't touch the funds.</p>
            </div>
          </div>
          </section>

          {/* WordPress */}
          <section className="mb-12 border border-secondary-200 rounded-lg p-4 sm:p-6 lg:p-8" aria-labelledby="wordpress-heading">
          <div className="mb-6">
            <h2 id="wordpress-heading" className="text-xl sm:text-2xl font-bold text-secondary-900 mb-2">WordPress / WooCommerce Plugin</h2>
            <p className="text-sm sm:text-base text-secondary-600">Add USDC cryptocurrency checkout to your WooCommerce store with smart contract escrow</p>
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
              <p className="text-sm sm:text-base text-secondary-600">Accept USDC cryptocurrency payments on your Shopify store with built-in escrow protection</p>
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
                <p className="font-semibold text-secondary-900 text-base sm:text-lg">USDC Funds Go Into Smart Contract Escrow</p>
                <p className="text-sm sm:text-base text-secondary-600">Cryptocurrency payment is held securely in a blockchain smart contract, not sent directly to the seller. This protects buyers from fraud.</p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <p className="font-semibold text-secondary-900 text-base sm:text-lg">Buyer Can Dispute Transactions</p>
                <p className="text-sm sm:text-base text-secondary-600">If products don't arrive or aren't as described, buyers can raise a dispute through the blockchain escrow system for refund protection.</p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <p className="font-semibold text-secondary-900 text-base sm:text-lg">Automated Dispute Resolution System</p>
                <p className="text-sm sm:text-base text-secondary-600">No dispute? Seller receives USDC payment automatically. Disputed? Our automated arbitration system enables fair negotiation between buyer and seller.</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link href="/arbitration-policy" className="text-sm sm:text-base text-primary-600 hover:text-primary-700 font-medium">
              Read the full crypto payment arbitration policy →
            </Link>
          </div>
          </section>

          {/* Bottom links */}
          <footer className="border-t border-secondary-200 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-between text-sm sm:text-base">
            <Link href="/faq" className="text-secondary-600 hover:text-secondary-900">
              Frequently Asked Questions
            </Link>
            <a href="mailto:info@conduit-ucpi.com" className="text-secondary-600 hover:text-secondary-900">
              Contact Us - USDC Payment Integration Support
            </a>
          </div>
          </footer>

        </article>
      </div>
    </>
  );
}
