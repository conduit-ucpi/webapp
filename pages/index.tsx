import Link from 'next/link';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import InteractiveDemo from '@/components/landing/InteractiveDemo';
import { motion } from 'framer-motion';

export default function Home() {
  let user = null;
  let isLoading = false;


  try {
    const authContext = useAuth();
    user = authContext.user;
    isLoading = authContext.isLoading;
  } catch (error) {
    // Auth context not available during SSR or hydration
  }

  // Show minimal loading on mobile to prevent crashes
  if (isLoading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
            <div className="space-y-8">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-4 pt-6">
                <Skeleton className="h-12 w-40" />
                <Skeleton className="h-12 w-32" />
              </div>
            </div>
            <div className="hidden lg:block">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAuthenticated = !!user;

  return (
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
              alt="Secure payment gateway illustration"
              className="w-full h-auto max-w-lg mx-auto"
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

        {/* E-commerce Plugin Callout */}
        <div className="mt-12">
          <Link href="/plugins">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-8 hover:border-green-300 hover:shadow-lg transition-all cursor-pointer">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h3 className="text-xl sm:text-2xl font-bold text-secondary-900 mb-2">
                    E-commerce merchants: Add cryptocurrency checkout in 5 minutes
                  </h3>
                  <p className="text-base sm:text-lg text-secondary-700">
                    WordPress & Shopify plugins with built-in buyer protection • 1% transaction fee • No monthly costs
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-green-600 transition-colors">
                    View Plugins
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Interactive Demo Section */}
        <div className="mt-32" id="how-it-works">
          <InteractiveDemo />
        </div>

        <motion.div 
          className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, staggerChildren: 0.2 }}
        >
          <motion.div 
            className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <motion.div 
              className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              1
            </motion.div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Seller creates payment request</h3>
            <p className="text-secondary-600 leading-relaxed">with delivery timeframe</p>
          </motion.div>

          <motion.div 
            className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <motion.div 
              className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              2
            </motion.div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Buyer puts funds in secure trust</h3>
            <p className="text-secondary-600 leading-relaxed">Money goes into secure trust, not directly to seller</p>
          </motion.div>

          <motion.div 
            className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <motion.div 
              className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              3
            </motion.div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Automatic payout to seller</h3>
            <p className="text-secondary-600 leading-relaxed">Seller receives payment at pre-agreed date & time. Disputed transactions held in trust until resolution.</p>
          </motion.div>
        </motion.div>

        {!isAuthenticated && (
          <>
            {/* What You Get Section */}
            <div className="mt-32 bg-secondary-50 rounded-2xl p-12">
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
            </div>

            {/* Cost Section */}
            <div className="mt-32">
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
            </div>

            {/* Contact Section */}
            <div className="mt-32">
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
            </div>

            {/* Final CTA */}
            <div className="mt-32">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}