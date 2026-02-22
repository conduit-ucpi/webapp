import Link from 'next/link';
import Button from '@/components/ui/Button';
import InteractiveDemo from '@/components/landing/InteractiveDemo';
import SEO from '@/components/SEO';
import { GetStaticProps } from 'next';

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works - See a Secure Escrow Payment in Action"
        description="Watch how Conduit Escrow protects buyers and sellers with time-delayed smart contract payments. Step-by-step walkthrough of a real transaction."
        keywords="escrow tutorial, how escrow works, smart contract payment, buyer protection demo, secure payment walkthrough"
        canonical="/how-it-works"
      />
      <div className="bg-white dark:bg-secondary-900 min-h-screen transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <InteractiveDemo />

          <div className="mt-12 text-center">
            <p className="text-lg text-secondary-600 dark:text-secondary-400 mb-6">
              Ready to try it yourself?
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/#get-started">
                <Button size="lg" className="px-8">
                  Get Started
                </Button>
              </Link>
              <Link href="/faq">
                <Button variant="outline" size="lg" className="px-8">
                  Read the FAQ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};
