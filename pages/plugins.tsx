import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function Plugins() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">

        {/* Hero */}
        <div className="mb-16">
          <h1 className="text-4xl font-bold text-secondary-900 mb-4">
            USDC Checkout for WordPress & Shopify
          </h1>
          <p className="text-xl text-secondary-600 max-w-2xl">
            Crypto holders have money but nowhere safe to spend it. Your store could be one of the few places they trust.
          </p>
        </div>

        {/* The Problem */}
        <div className="mb-16 border-l-4 border-secondary-300 pl-6 py-2">
          <p className="text-lg text-secondary-700 mb-3">
            Every month, $9.7 trillion in crypto changes hands. But only $300 million gets spent on actual goods and services.
          </p>
          <p className="text-lg text-secondary-700">
            That's 700 million people with crypto who aren't spending it because they don't feel safe. They need buyer protection like they get with card payments.
          </p>
        </div>

        {/* What you get */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-secondary-900 mb-6">What you get</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">3 minute setup</h3>
              <p className="text-secondary-600">Install the plugin, connect your wallet. That's it.</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">1% fee (0.30 USDC minimum)</h3>
              <p className="text-secondary-600">First 20 merchants get this rate locked in forever. No monthly fees, no gas fees, no refund fees.</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">Buyer protection built in</h3>
              <p className="text-secondary-600">Smart contract escrow with automated dispute system. Buyers get the safety they're used to from card payments.</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">No KYC/KYB required</h3>
              <p className="text-secondary-600">Neither you nor your customers need to verify identity or submit business documents.</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">Direct to your wallet</h3>
              <p className="text-secondary-600">No intermediary. Contracts are between buyer and seller only - we can't touch the funds.</p>
            </div>
          </div>
        </div>

        {/* WordPress */}
        <div className="mb-12 border border-secondary-200 rounded-lg p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-secondary-900 mb-2">WordPress / WooCommerce</h2>
            <p className="text-secondary-600">Add USDC checkout to your WooCommerce store</p>
          </div>

          <div className="mb-6">
            <div className="aspect-video bg-secondary-100 rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/aYXG0hC7dFg"
                title="WordPress Plugin Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>

          <div className="flex gap-4">
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
          </div>
        </div>

        {/* Shopify */}
        <div className="mb-12 border border-secondary-200 rounded-lg p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-secondary-900 mb-2">Shopify</h2>
            <p className="text-secondary-600">Add USDC checkout to your Shopify store</p>
          </div>

          <div className="mb-6">
            <div className="aspect-video bg-secondary-100 rounded-lg flex items-center justify-center">
              <p className="text-secondary-500">Video demo coming soon</p>
            </div>
          </div>

          <div className="flex gap-4">
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
          </div>
        </div>

        {/* How it works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-secondary-900 mb-6">How buyer protection works</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-semibold text-secondary-900">Funds go into escrow</p>
                <p className="text-secondary-600">Payment is held in a smart contract, not sent directly to the seller.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-semibold text-secondary-900">Buyer can dispute</p>
                <p className="text-secondary-600">If the item doesn't arrive or isn't as described, buyer raises a dispute.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-semibold text-secondary-900">Automated resolution</p>
                <p className="text-secondary-600">No dispute? Seller gets paid. Disputed? Automated arbitration system lets buyer and seller negotiate a resolution.</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link href="/arbitration-policy" className="text-primary-600 hover:text-primary-700 font-medium">
              Read the full arbitration policy →
            </Link>
          </div>
        </div>

        {/* Bottom links */}
        <div className="border-t border-secondary-200 pt-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Link href="/faq" className="text-secondary-600 hover:text-secondary-900">
              Frequently Asked Questions
            </Link>
            <a href="mailto:info@conduit-ucpi.com" className="text-secondary-600 hover:text-secondary-900">
              Need help? Email us
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
