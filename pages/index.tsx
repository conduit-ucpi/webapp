import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Home() {
  const { user, provider, isLoading } = useAuth();
  const router = useRouter();
  
  // Show minimal loading on mobile to prevent crashes
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }
  
  const isAuthenticated = user && provider;

  return (
    <div className="bg-gray-900 min-h-screen" key="home-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
          <div className="space-y-8">
            <h1 className="text-5xl font-bold text-white lg:text-6xl xl:text-7xl leading-tight">
              Stop Paying Strangers 
              <span className="text-green-400 block">Before You Get Your Stuff</span>
            </h1>
            <p className="text-xl text-gray-300 font-medium">
              And stop delivering without guaranteed payment
            </p>
            <p className="text-lg text-gray-400 max-w-lg">
              <span className="font-semibold text-white">Escrow</span> - house buyers use it for secure transactions; it's now instant and so easy <span className="italic text-green-400">you</span> can use it to make <span className="italic text-green-400">any</span> sale just as safe
            </p>
            
            <div className="pt-6">
              {isAuthenticated ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/create">
                    <Button size="lg" className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-gray-900 font-semibold">
                      New Payment
                    </Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto border-green-400 text-green-400 hover:bg-green-400 hover:text-gray-900">
                      View Dashboard
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <ConnectWallet />
                  <div className="text-sm text-gray-400 max-w-md">
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
                src={`${router.basePath}/payment_gateway.png`} 
                alt="Payment Infrastructure Diagram" 
                className="w-full h-auto opacity-90"
              />
            </div>
          </div>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 hover:border-green-400/50 transition-colors">
            <div className="w-16 h-16 bg-green-500 text-gray-900 rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Seller creates payment request</h3>
            <p className="text-gray-400 leading-relaxed">with delivery timeframe</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 hover:border-green-400/50 transition-colors">
            <div className="w-16 h-16 bg-green-500 text-gray-900 rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Buyer puts funds in secure trust</h3>
            <p className="text-gray-400 leading-relaxed">Money goes into secure trust, not directly to seller</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 hover:border-green-400/50 transition-colors">
            <div className="w-16 h-16 bg-green-500 text-gray-900 rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Automatic payout to seller</h3>
            <p className="text-gray-400 leading-relaxed">Seller receives payment at pre-agreed date & time. Disputed transactions held in trust until resolution.</p>
          </div>
        </div>

        {!isAuthenticated && (
          <>
            {/* What You Get Section */}
            <div className="mt-32">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-white mb-4">What you get</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-lg leading-relaxed">All the protection of traditional escrow</p>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-lg leading-relaxed">Set up in 60 seconds, not 60 days</p>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-lg leading-relaxed">No legal fees, contracts, or bank meetings</p>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-lg leading-relaxed">Payment releases automatically on the agreed date</p>
                </div>
                
                <div className="flex items-start space-x-4 md:col-span-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-300 text-lg leading-relaxed">If there's a problem, buyer hits "dispute" - funds stay in trust until our admin team reaches a fair resolution</p>
                </div>
              </div>
            </div>

            {/* Cost Section */}
            <div className="mt-32">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-white mb-4">Cost</h2>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-2xl mx-auto hover:border-green-400/50 transition-colors">
                <div className="text-center space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-gray-300">Flat fee on payments</span>
                    <span className="text-2xl font-bold text-green-400">$1</span>
                  </div>
                  <div className="border-t border-gray-700 pt-6">
                    <p className="text-green-400 font-semibold">Free testing with $0.001 payments</p>
                    <p className="text-sm text-gray-400 mt-1">Try it risk-free first</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Final CTA */}
            <div className="mt-32">
              <div className="text-center bg-gray-800 border border-gray-700 rounded-lg p-12 hover:border-green-400/50 transition-colors">
                <h2 className="text-3xl font-bold text-white mb-4">You've been using the "hope for the best" system.</h2>
                <p className="text-2xl text-green-400 font-semibold mb-8">
                  Time to upgrade.
                </p>
                <ConnectWallet />
                <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-gray-400">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    60 second setup
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Free testing
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
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