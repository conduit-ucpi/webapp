import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthContextProvider';

export default function Home() {
  const { user, isLoading } = useAuth();
  const { web3authProvider, isLoading: isWeb3AuthInstanceLoading } = useWeb3AuthInstance();

  // Show minimal loading on mobile to prevent crashes
  if (isLoading || isWeb3AuthInstanceLoading) {
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

  const isAuthenticated = user && web3authProvider;

  return (
    <div className="bg-white min-h-screen" key="home-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
          <div className="space-y-8">
            <h1 className="text-5xl font-bold text-secondary-900 lg:text-6xl xl:text-7xl leading-tight">
              Stop Paying Strangers
              <span className="text-primary-600 block">Before You Get Your Stuff</span>
            </h1>
            <p className="text-xl text-secondary-700 font-medium">
              And stop delivering without guaranteed payment
            </p>
            <p className="text-lg text-secondary-600 max-w-lg">
              <span className="font-semibold text-secondary-900">Escrow</span> - house buyers use it for secure transactions; it's now instant and so easy <span className="italic text-primary-600">you</span> can use it to make <span className="italic text-primary-600">any</span> sale just as safe
            </p>

            <div className="pt-6">
              {isAuthenticated ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/create">
                    <Button size="lg" className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold">
                      New Payment Request
                    </Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white">
                      View Dashboard
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <ConnectWallet />
                  <div className="text-sm text-secondary-600 max-w-md">
                    <p className="mb-2">
                      Connect with Google, Facebook, or any social login.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hero Graphic - Payment Infrastructure Diagram */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-full max-w-lg">
              <img
                src="/payment_gateway.png"
                alt="Payment Infrastructure Diagram"
                className="w-full h-auto opacity-90"
              />
            </div>
          </div>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
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
                    <span className="text-lg text-secondary-700">Flat fee on payments</span>
                    <span className="text-2xl font-bold text-primary-600">$1</span>
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
                <ConnectWallet />
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
                    $1 flat fee
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