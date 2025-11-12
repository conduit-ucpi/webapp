import Link from 'next/link';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import InteractiveDemo from '@/components/landing/InteractiveDemo';
import SEO from '@/components/SEO';
import { GetStaticProps } from 'next';

export default function Home() {
  let user = null;

  try {
    const authContext = useAuth();
    user = authContext.user;
    // Don't check isLoading - always render content for SSR/SEO/AI crawlers
  } catch (error) {
    // Auth context not available during SSR or hydration
  }

  const isAuthenticated = !!user;

  // Structured data for search engines
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "Conduit Escrow",
    "description": "Secure crypto escrow service for USDC payments with built-in buyer protection",
    "url": "https://conduit-ucpi.com",
    "logo": "https://conduit-ucpi.com/icon.png",
    "sameAs": [],
    "priceRange": "1%",
    "paymentAccepted": ["USDC", "Cryptocurrency"],
    "areaServed": "Worldwide",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Escrow Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Time-Delayed Escrow Contracts",
            "description": "Secure payment holding with automatic release after delivery confirmation"
          }
        }
      ]
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "127"
    }
  };

  return (
    <>
      <SEO
        title="Conduit Escrow - Secure Crypto Payments with Built-in Buyer Protection | 1% Fee"
        description="Get paid safely with blockchain escrow. Hold USDC payments in trust until delivery is confirmed. No lawyers, no banks - just security. 60 second setup, 1% fee, free testing."
        keywords="crypto escrow, blockchain escrow, USDC escrow, secure crypto payments, buyer protection, smart contract escrow, Base network escrow, trustless payments, cryptocurrency escrow, time-delayed payments, blockchain payment protection"
        canonical="/"
        structuredData={structuredData}
      />
      <div className="bg-white dark:bg-secondary-900 min-h-screen transition-colors" key="home-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
          <div className="space-y-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-secondary-900 dark:text-white leading-tight">
              Get Paid Safely, <span className="text-primary-500">Automatically</span>
            </h1>
            <p className="text-xl text-secondary-600 dark:text-secondary-300 leading-relaxed">
              Escrow protection made simple - no lawyers, no banks, just security.
              Hold payments in trust until delivery is confirmed.
            </p>
            {isAuthenticated ? (
              <div className="flex gap-4 pt-6">
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
              <div className="space-y-4 pt-6">
                <ConnectWalletEmbedded
                  useSmartRouting={false}
                  showTwoOptionLayout={true}
                />
                <div className="flex items-center space-x-6 text-sm text-secondary-600 dark:text-secondary-400">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    60 second setup
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    1% fee
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="hidden lg:block">
            <img
              src="/payment_gateway.png"
              alt="Secure blockchain escrow payment gateway for cryptocurrency transactions with buyer protection"
              className="w-full h-auto max-w-lg mx-auto"
              width="500"
              height="500"
            />
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-12 flex flex-col items-center animate-bounce">
          <p className="text-sm text-secondary-500 mb-2">Explore more</p>
          <svg
            className="w-6 h-6 text-primary-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>

        {/* Integration Callouts */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {/* E-commerce Plugin */}
          <Link href="/plugins">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6 hover:border-green-300 hover:shadow-lg transition-all cursor-pointer h-full">
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-secondary-900 mb-2">
                    E-commerce: WordPress & Shopify Plugins
                  </h3>
                  <p className="text-sm sm:text-base text-secondary-700">
                    Add crypto checkout in 5 minutes • Built-in buyer protection • 1% fee
                  </p>
                </div>
                <div className="mt-4">
                  <div className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors text-sm sm:text-base">
                    View Plugins
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Developers Integration */}
          <Link href="/integrate">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer h-full">
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-secondary-900 mb-2">
                    Developers: JavaScript Integration
                  </h3>
                  <p className="text-sm sm:text-base text-secondary-700">
                    Add to any website with 3 lines of code • Full API docs • Live examples
                  </p>
                </div>
                <div className="mt-4">
                  <div className="bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors text-sm sm:text-base">
                    View Integration Guide
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Interactive Demo Section */}
        <section className="mt-32" id="how-it-works" aria-label="How Conduit Escrow Works">
          <InteractiveDemo />
        </section>

        <section className="mt-32" aria-label="Escrow Process Steps">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-white text-center mb-12">
          Simple 3-Step Escrow Process
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
            <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Seller creates payment request</h3>
            <p className="text-secondary-600 leading-relaxed">with delivery timeframe</p>
          </div>

          <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
            <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Buyer puts funds in secure trust</h3>
            <p className="text-secondary-600 leading-relaxed">Money goes into secure trust, not directly to seller</p>
          </div>

          <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
            <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Automatic payout to seller</h3>
            <p className="text-secondary-600 leading-relaxed">Seller receives payment at pre-agreed date & time. Disputed transactions held in trust until resolution.</p>
          </div>
        </div>
        </section>

        {!isAuthenticated && (
          <>
            {/* What You Get Section */}
            <section className="mt-32 bg-secondary-50 rounded-2xl p-12" aria-label="Benefits and Features">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-secondary-900 mb-4">What you get</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">All the protection of traditional escrow</p>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">Set up in 60 seconds, not 60 days</p>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">No legal fees, contracts, or bank meetings</p>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">Payment releases automatically on the agreed date</p>
                </div>

                <div className="flex items-start space-x-4 md:col-span-2">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">If there's a problem, buyer hits "dispute", funds stay held in trust until buyer and seller can agree on refund amount in auto-dispute system</p>
                </div>
              </div>
            </section>

            {/* Cost Section */}
            <section className="mt-32" aria-label="Pricing">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-secondary-900 mb-4">Cost</h2>
              </div>

              <div className="bg-white border border-secondary-200 rounded-lg p-8 max-w-2xl mx-auto hover:border-primary-300 hover:shadow-lg transition-all">
                <div className="text-center space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-secondary-700">Transaction fee</span>
                    <span className="text-2xl font-bold text-primary-600">1%</span>
                  </div>
                  <div className="border-t border-secondary-200 pt-6">
                    <p className="text-primary-600 font-semibold">Free testing with $0.001 payments</p>
                    <p className="text-sm text-secondary-600 mt-1">Try it risk-free first</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Contact Section */}
            <section className="mt-32" aria-label="Contact Information">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-secondary-900 mb-4">Questions?</h2>
              </div>

              <div className="bg-white border border-secondary-200 rounded-lg p-8 max-w-2xl mx-auto hover:border-primary-300 hover:shadow-lg transition-all">
                <div className="text-center space-y-4">
                  <p className="text-lg text-secondary-700">Need help or have questions?</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <a 
                      href="mailto:info@conduit-ucpi.com"
                      className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      Contact Us
                    </a>
                    <Link href="/faq">
                      <Button variant="outline" className="border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white">
                        View FAQ
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Final CTA */}
            <section className="mt-32" aria-label="Get Started">
              <div className="text-center bg-primary-50 border border-primary-200 rounded-lg p-12 hover:border-primary-300 hover:shadow-lg transition-all">
                <h2 className="text-3xl font-bold text-secondary-900 mb-4">You've been using the "hope for the best" system.</h2>
                <p className="text-2xl text-primary-600 font-semibold mb-8">
                  Time to upgrade.
                </p>
                <ConnectWalletEmbedded
                  useSmartRouting={false}
                  showTwoOptionLayout={true}
                />
                <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-secondary-600">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    60 second setup
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Free testing
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    1% fee
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
    </>
  );
}

// Static generation for SEO - pre-render this page at build time
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600, // Revalidate every hour
  };
};