import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Button from '@/components/ui/Button';
import { motion } from 'framer-motion';

export default function Plugins() {
  return (
    <Layout children={
      <div className="bg-white dark:bg-secondary-900 min-h-screen transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          {/* Hero Section */}
          <div className="text-center mb-20">
            <h1 className="text-5xl lg:text-6xl font-bold text-secondary-900 dark:text-white mb-6">
              Accept Crypto Payments <span className="text-primary-500">Safely</span>
            </h1>
            <p className="text-xl text-secondary-600 dark:text-secondary-300 max-w-3xl mx-auto leading-relaxed">
              Add USDC checkout with buyer protection to your WordPress or Shopify store
            </p>
          </div>

          {/* The Problem Section */}
          <div className="mb-32 bg-secondary-50 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-secondary-900 mb-8 text-center">The Opportunity</h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600 mb-2">$9.7Tn</div>
                <p className="text-secondary-700">Crypto transactions per month</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600 mb-2">$300M</div>
                <p className="text-secondary-700">Used for buying goods & services</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600 mb-2">700M</div>
                <p className="text-secondary-700">Crypto holders worldwide</p>
              </div>
            </div>
            <div className="mt-8 text-center">
              <p className="text-lg text-secondary-700 max-w-3xl mx-auto">
                In traditional finance, 40% of money is spent on goods and services. In crypto, it's only 0.003%.
                <strong className="text-primary-600"> Why?</strong> Because buyers don't feel safe spending crypto without the protections they're used to.
              </p>
            </div>
          </div>

          {/* The Solution */}
          <div className="mb-20 text-center">
            <h2 className="text-4xl font-bold text-secondary-900 mb-4">The Solution</h2>
            <p className="text-xl text-secondary-600 max-w-3xl mx-auto leading-relaxed">
              Our plugins give crypto buyers the same protection they expect from card payments -
              escrow protection with automated dispute resolution. Make your store one of the safe places to spend crypto.
            </p>
          </div>

          {/* Why Merchants Love It */}
          <div className="mb-32 bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl p-12 border border-primary-200">
            <h2 className="text-4xl font-bold text-secondary-900 mb-4 text-center">Why Merchants Love It</h2>
            <p className="text-center text-secondary-600 mb-12 text-lg max-w-2xl mx-auto">
              Based on feedback from real merchants who've integrated our payment solution
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Speed & Ease */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-secondary-900 mb-3">Lightning Fast Setup</h3>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-start">
                    <span className="text-primary-500 mr-2">•</span>
                    3 min plugin install
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-500 mr-2">•</span>
                    3 min transaction for buyers
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-500 mr-2">•</span>
                    Payment in 2 clicks
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-500 mr-2">•</span>
                    No business checks - self-serve setup
                  </li>
                </ul>
              </div>

              {/* Cost Benefits */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-secondary-900 mb-3">Transparent Pricing</h3>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    1% fee (0.30 USDC min)
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    <strong>Locked in forever for first 20 merchants</strong>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    No install cost
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    No gas fees for you or customers
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    No FIAT exchange fees
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    No refund fees or limits
                  </li>
                </ul>
              </div>

              {/* Trust & Security */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-secondary-900 mb-3">Security Built In</h3>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Immutable blockchain code
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Funds restricted to seller/buyer only
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    No intermediary access
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    You own your account
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Contracts between buyer & seller only
                  </li>
                </ul>
              </div>

              {/* Privacy & Compliance */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-secondary-900 mb-3">Privacy First</h3>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    No KYC for customers
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    No KYB for merchants
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    Buyer anonymity
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    Seller anonymity
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    No business verification needed
                  </li>
                </ul>
              </div>
            </div>

            {/* Buyer Protection Callout */}
            <div className="bg-white rounded-xl p-8 shadow-md border-2 border-primary-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-secondary-900 mb-3">Buyer Protection = Seller Assurance</h3>
                  <p className="text-secondary-700 text-lg mb-4">
                    When buyers know their funds are held in escrow with automated dispute resolution,
                    they're more confident to purchase. This means more sales for you.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-primary-500 mr-2 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-secondary-700">Funds held in trust until delivery confirmed</span>
                    </div>
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-primary-500 mr-2 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-secondary-700">Automated dispute negotiation system</span>
                    </div>
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-primary-500 mr-2 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-secondary-700">No refund/chargeback limits - issue as many as needed</span>
                    </div>
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-primary-500 mr-2 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-secondary-700">Zero extra fees for refunds</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* WordPress Plugin Section */}
          <motion.div
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white border border-secondary-200 rounded-2xl overflow-hidden hover:border-primary-300 hover:shadow-xl transition-all">
              <div className="p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-primary-500 rounded-lg flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.064.516-.921-.066-.89 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C5.1 3.257 8.797 1.5 13 1.5c3.215 0 6.125 1.224 8.33 3.24-.054-.003-.105-.01-.159-.01-1.02 0-1.747.886-1.747 1.842 0 .862.495 1.59 1.02 2.448.398.69.862 1.575.862 2.853 0 .886-.34 1.912-.793 3.342l-1.04 3.478-3.803-11.257zm-8.54 16.464c-1.079-.49-2.063-1.195-2.9-2.07l2.9-8.424 2.97 8.138c.02.04.045.078.068.117-1.014.29-2.092.44-3.038.24zm7.29-1.283c1.75-1.01 3.137-2.65 3.876-4.61l-3.876 11.265v-.654z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-secondary-900">WordPress / WooCommerce Plugin</h2>
                    <p className="text-lg text-secondary-600 mt-1">USDC Payments with Buyer Protection</p>
                  </div>
                </div>

                <div className="bg-primary-50 rounded-lg p-6 mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-primary-900">Special Launch Offer</p>
                      <p className="text-sm text-primary-700">1% fee locked in forever for first 20 merchants • 0.30 USDC minimum</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 text-primary-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Setup & Speed
                    </h3>
                    <ul className="space-y-2 text-sm text-secondary-700">
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        3 minute plugin install
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        3 minute checkout for buyers
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        Payment in 2 clicks
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        No business verification
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Costs & Fees
                    </h3>
                    <ul className="space-y-2 text-sm text-secondary-700">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No install cost
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No gas fees
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No FIAT exchange fees
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No refund fees or limits
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Trust & Privacy
                    </h3>
                    <ul className="space-y-2 text-sm text-secondary-700">
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        Smart contract escrow
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        No KYC/KYB required
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        You own your account
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        Buyer & seller anonymity
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Video Demo */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-secondary-900 mb-4">See it in action:</h3>
                  <div className="aspect-video bg-secondary-100 rounded-lg overflow-hidden">
                    <iframe
                      width="100%"
                      height="100%"
                      src="https://www.youtube.com/embed/aYXG0hC7dFg"
                      title="WordPress Plugin Demo"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    ></iframe>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="https://wordpress.org/plugins/usdc-payments-with-buyer-protection/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button size="lg" className="w-full">
                      Install WordPress Plugin
                    </Button>
                  </a>
                  <Link href="/faq" className="flex-1">
                    <Button variant="outline" size="lg" className="w-full">
                      View FAQ
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Shopify Integration Section */}
          <motion.div
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-white border border-secondary-200 rounded-2xl overflow-hidden hover:border-primary-300 hover:shadow-xl transition-all">
              <div className="p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-primary-500 rounded-lg flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.373 8.294l-1.465-.293s-.857-3.964-1.172-4.574c-.316-.61-.857-.763-1.172-.763-.047 0-.094 0-.14.012-.048-.047-.094-.094-.141-.141-.422-.422-.95-.61-1.571-.563-1.078 0-2.156.81-3.047 2.203-.622.98-1.078 2.203-1.266 3.094-.61.188-1.031.329-1.078.329-.328.094-.328.094-.375.422-.047.235-1.266 9.703-1.266 9.703L13.139 20l6.75-1.266s-3.469-10.251-3.516-10.44zm-2.484-.329c-.517.141-1.078.328-1.64.516v-.375c0-.61-.047-1.078-.094-1.5.563.094 1.031.704 1.266 1.359h.468zm-2.578.798c-.657.188-1.359.422-2.062.61.188-1.078.657-2.156 1.172-2.72.188-.188.375-.375.61-.516.234.61.328 1.5.328 2.625l-.048.001zm-1.125-3.094c.094 0 .188.047.282.094-.797.563-1.641 1.5-2.016 2.953l-1.641.469c.376-1.406 1.406-3.516 3.375-3.516z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-secondary-900">Shopify Integration</h2>
                    <p className="text-lg text-secondary-600 mt-1">USDC Payments with Buyer Protection</p>
                  </div>
                </div>

                <div className="bg-primary-50 rounded-lg p-6 mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-primary-900">Special Launch Offer</p>
                      <p className="text-sm text-primary-700">1% fee locked in forever for first 20 merchants • 0.30 USDC minimum</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 text-primary-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Setup & Speed
                    </h3>
                    <ul className="space-y-2 text-sm text-secondary-700">
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        3 minute plugin install
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        3 minute checkout for buyers
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        Payment in 2 clicks
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary-500 mr-2">✓</span>
                        No business verification
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Costs & Fees
                    </h3>
                    <ul className="space-y-2 text-sm text-secondary-700">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No install cost
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No gas fees
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No FIAT exchange fees
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        No refund fees or limits
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Trust & Privacy
                    </h3>
                    <ul className="space-y-2 text-sm text-secondary-700">
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        Smart contract escrow
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        No KYC/KYB required
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        You own your account
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        Buyer & seller anonymity
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Video Demo Placeholder */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-secondary-900 mb-4">See it in action:</h3>
                  <div className="aspect-video bg-secondary-100 rounded-lg overflow-hidden flex items-center justify-center">
                    <div className="text-center p-8">
                      <svg className="w-20 h-20 text-secondary-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-secondary-600 text-lg font-semibold">Video Demo Coming Soon</p>
                      <p className="text-secondary-500 text-sm mt-2">Check back soon to see the Shopify integration in action</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/shopify/install-button" className="flex-1">
                    <Button size="lg" className="w-full">
                      Install Shopify Integration
                    </Button>
                  </Link>
                  <Link href="/faq" className="flex-1">
                    <Button variant="outline" size="lg" className="w-full">
                      View FAQ
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* How Buyer Protection Works */}
          <div className="mb-20 bg-primary-50 border border-primary-200 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-secondary-900 mb-8 text-center">How Buyer Protection Works</h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-4 text-2xl font-bold mx-auto">
                  1
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">Funds in Escrow</h3>
                <p className="text-secondary-700">Payment held in smart contract, not sent directly to seller</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-4 text-2xl font-bold mx-auto">
                  2
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">Protection Period</h3>
                <p className="text-secondary-700">Buyer can dispute if item doesn't arrive or isn't as described</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-4 text-2xl font-bold mx-auto">
                  3
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">Auto Resolution</h3>
                <p className="text-secondary-700">If no dispute, seller gets paid. If disputed, automated arbitration system resolves it</p>
              </div>
            </div>

            <div className="text-center">
              <Link href="/arbitration-policy">
                <Button variant="outline" className="border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white">
                  Learn About Our Arbitration System
                </Button>
              </Link>
            </div>
          </div>

          {/* Additional Resources */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
              <h3 className="text-2xl font-bold text-secondary-900 mb-4">Frequently Asked Questions</h3>
              <p className="text-secondary-700 mb-6">
                Get answers to common questions about installation, fees, dispute resolution, and more.
              </p>
              <Link href="/faq">
                <Button variant="outline" className="w-full">
                  View FAQ
                </Button>
              </Link>
            </div>

            <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
              <h3 className="text-2xl font-bold text-secondary-900 mb-4">Need Help?</h3>
              <p className="text-secondary-700 mb-6">
                Our support team is here to help with installation, troubleshooting, or any questions you have.
              </p>
              <a
                href="mailto:info@conduit-ucpi.com"
                className="block"
              >
                <Button variant="outline" className="w-full">
                  Contact Support
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    } />
  );
}
