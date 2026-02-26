import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import SEO from '@/components/SEO';
import Fade from '@/components/ui/Fade';
import { btnPrimary, btnOutline } from '@/utils/landingStyles';
import { financialServiceSchema, articleSchema } from '@/utils/structuredData';
import { GetStaticProps } from 'next';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { useAuth } from '@/components/auth';
import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Sell() {
  const router = useRouter();
  const { user, connect } = useAuth();

  const handleConnectAndNavigate = async (destination: string) => {
    if (user) {
      router.push(destination);
      return;
    }
    if (connect) {
      const result = await connect('walletconnect');
      if (result?.success) {
        router.push(destination);
      }
    }
  };

  const siteName = getSiteNameFromDomain();

  const heroStagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12 } },
  };
  const heroChild = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as const } },
  };

  return (
    <>
      <SEO
        title={`Sell with ${siteName} — Get Paid in Stablecoins with Escrow Protection`}
        description="Create secure payment requests and get paid in USDC. Time-locked escrow protects both sides. No chargebacks, instant settlement, 1% flat fee."
        keywords="sell crypto, accept USDC, stablecoin payments, escrow payment request, get paid crypto, freelancer payments, secure invoicing"
        canonical="/sell"
        structuredData={[financialServiceSchema, articleSchema]}
      />
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors">

        {/* ================================================================ */}
        {/* HERO                                                             */}
        {/* ================================================================ */}
        <section className="min-h-[90vh] flex items-center" aria-label="Hero">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32 w-full">
            <motion.div variants={heroStagger} initial="hidden" animate="show">
              <motion.h1
                variants={heroChild}
                className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl"
              >
                Get paid in stablecoins.{' '}
                <span className="text-primary-500">No chargebacks.</span>
              </motion.h1>

              <motion.p
                variants={heroChild}
                className="mt-6 text-base text-secondary-500 dark:text-secondary-400 max-w-xl leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Send a payment request, your buyer pays into a time-locked escrow, and you get paid automatically on the payout date. 1&nbsp;% fee. No middleman holding your money.
              </motion.p>

              <motion.div variants={heroChild} className="mt-12 flex flex-wrap gap-3">
                <button className={btnPrimary} onClick={() => handleConnectAndNavigate('/create')}>Create Payment Request</button>
                <button className={btnOutline} onClick={() => handleConnectAndNavigate('/dashboard')}>View Dashboard</button>
              </motion.div>

              <motion.div variants={heroChild} className="mt-8 pt-8 border-t border-secondary-200 dark:border-secondary-700 max-w-md">
                <Link
                  href="/merchant"
                  className="text-sm text-secondary-500 dark:text-secondary-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  Looking to add crypto checkout to your store? See merchant integrations &rarr;
                </Link>
              </motion.div>

              <motion.div
                variants={heroChild}
                className="mt-14 flex flex-wrap gap-x-8 gap-y-2 text-xs text-secondary-400 dark:text-secondary-500"
              >
                <span>1% flat fee</span>
                <span>Instant settlement</span>
                <span>No chargebacks</span>
                <span>No vetting</span>
                <a href="https://github.com/conduit-ucpi/contracts" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors underline">Open source</a>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* HOW SELLING WORKS                                                */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="How selling works"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-16">
                How it works
              </p>
            </Fade>

            <div className="grid md:grid-cols-3 gap-x-12 gap-y-16">
              {[
                {
                  num: '01',
                  title: 'Create a request',
                  desc: 'Set the amount, describe what you\'re selling, and choose a payout date. You\'ll get a payment link you can share with anyone.',
                },
                {
                  num: '02',
                  title: 'Buyer pays into escrow',
                  desc: 'Your buyer clicks the link, connects a wallet, and pays. Funds are locked in a smart contract — safe from both sides until the payout date.',
                },
                {
                  num: '03',
                  title: 'You get paid',
                  desc: 'On the payout date, funds release to your wallet automatically. If the buyer has a problem, they can raise a dispute before that date.',
                },
              ].map((step, i) => (
                <Fade key={step.num} delay={i * 0.1}>
                  <div>
                    <span className="text-[3.5rem] sm:text-[5rem] leading-none font-extralight text-secondary-100 dark:text-secondary-800 select-none block mb-4">
                      {step.num}
                    </span>
                    <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* WHY SELLERS CHOOSE THIS                                          */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label="Why sellers choose this"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Why sellers use {siteName}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-16"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Get paid without giving up control.
              </h2>
            </Fade>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
              {[
                {
                  label: 'No chargebacks',
                  text: 'Once the payout date passes, the funds are yours. No surprise reversals weeks later.',
                },
                {
                  label: 'No payment processor',
                  text: 'Funds go from escrow to your wallet. No one holds your money, takes a float, or freezes your account.',
                },
                {
                  label: 'Instant settlement',
                  text: 'Funds arrive in your wallet the moment the payout date passes. No 3-5 business day wait.',
                },
                {
                  label: 'Works for any sale',
                  text: 'Freelance work, physical goods, digital products, services — if you can describe it, you can sell it.',
                },
                {
                  label: 'Buyer gets protection too',
                  text: 'The escrow gives your buyer confidence to pay. They know funds are safe until you deliver.',
                },
                {
                  label: 'No sign-up required',
                  text: 'No KYC, no applications, no waiting. Connect a wallet and create your first payment request in minutes.',
                },
              ].map((item, i) => (
                <Fade key={i} delay={i * 0.06}>
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-1">
                      {item.label}
                    </h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* USE CASES                                                        */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Use cases"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Who it&apos;s for
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-16"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                From freelancers to storefronts.
              </h2>
            </Fade>

            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
              {[
                {
                  label: 'Freelancers & contractors',
                  text: 'Send a payment request before you start work. Your client funds the escrow upfront, and you get paid when the job is delivered.',
                },
                {
                  label: 'Online sellers',
                  text: 'List a product, share the payment link, and ship when the buyer pays. No marketplace fees, no platform lock-in.',
                },
                {
                  label: 'Service providers',
                  text: 'Consultants, designers, developers — set a payout date that matches your delivery timeline and get paid automatically.',
                },
                {
                  label: 'Cross-border payments',
                  text: 'USDC settles globally with no currency conversion, no wire fees, and no 3-day hold. Same cost whether your buyer is next door or overseas.',
                },
              ].map((item, i) => (
                <Fade key={i} delay={i * 0.06}>
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-1">
                      {item.label}
                    </h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PRICING                                                          */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Pricing"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              <Fade>
                <div>
                  <span className="text-[8rem] sm:text-[10rem] lg:text-[12rem] leading-none font-extralight text-secondary-900 dark:text-white tracking-tighter select-none block">
                    1<span className="text-primary-500">%</span>
                  </span>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-2">
                    per transaction. Nothing else.
                  </p>
                </div>
              </Fade>

              <Fade delay={0.1}>
                <div className="space-y-4 text-sm text-secondary-500 dark:text-secondary-400 pb-4">
                  <div className="flex justify-between border-b border-secondary-100 dark:border-secondary-800 pb-3">
                    <span>Setup costs</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between border-b border-secondary-100 dark:border-secondary-800 pb-3">
                    <span>Monthly fees</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between border-b border-secondary-100 dark:border-secondary-800 pb-3">
                    <span>Chargeback fees</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between border-b border-secondary-100 dark:border-secondary-800 pb-3">
                    <span>Payment hold / float</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between border-b border-secondary-100 dark:border-secondary-800 pb-3">
                    <span>KYC / KYB / vetting</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between pb-3">
                    <span>Testing</span>
                    <span className="text-secondary-900 dark:text-white font-medium">Free</span>
                  </div>
                </div>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FINAL CTA                                                        */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Get started"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-28 pb-16 lg:pb-20">
            <Fade>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-3"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Ready to get paid?
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8 max-w-md">
                Connect your wallet and create your first payment request. No sign-up forms, no approval process.
              </p>
              <div className="flex flex-wrap gap-3">
                <button className={btnPrimary} onClick={() => handleConnectAndNavigate('/create')}>Create Payment Request</button>
                <button className={btnOutline} onClick={() => handleConnectAndNavigate('/dashboard')}>View Dashboard</button>
              </div>
            </Fade>

            {/* Footer links */}
            <Fade delay={0.2}>
              <div className="mt-14 pt-8 border-t border-secondary-100 dark:border-secondary-800 flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
                <Link href="/how-it-works" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  How it works
                </Link>
                <Link href="/faq" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  FAQ
                </Link>
                <a
                  href="https://github.com/conduit-ucpi/contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  Source code
                </a>
                <a
                  href="mailto:info@conduit-ucpi.com"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  info@conduit-ucpi.com
                </a>
              </div>
            </Fade>
          </div>
        </section>

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
