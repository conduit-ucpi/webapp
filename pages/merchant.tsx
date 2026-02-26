import Link from 'next/link';
import Head from 'next/head';
import SEO from '@/components/SEO';
import Fade from '@/components/ui/Fade';
import { btnPrimary, btnOutline } from '@/utils/landingStyles';
import { financialServiceSchema, articleSchema } from '@/utils/structuredData';
import { GetStaticProps } from 'next';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Merchant() {

  const siteName = getSiteNameFromDomain();

  const structuredData = [financialServiceSchema, articleSchema];

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
        title="Conduit Escrow - Stablecoin Payments with Buyer Protection | 1% Fee"
        description="Stablecoin checkout with buyer protection. No chargebacks, no floats, no freezes, no vetting. 1% flat fee, 10-minute setup. Gas-free transactions. Open source escrow on Base."
        keywords="open source escrow, crypto escrow, blockchain escrow, USDC escrow, secure crypto payments, buyer protection, smart contract escrow, Base network escrow"
        canonical="/merchant"
        structuredData={structuredData}
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
                Accept stablecoin payments.{' '}
                <span className="text-primary-500">Protect both sides.</span>
              </motion.h1>

              <motion.p
                variants={heroChild}
                className="mt-6 text-base text-secondary-500 dark:text-secondary-400 max-w-xl leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                No chargebacks. No floats. No freezes. No vetting. Just a 1&nbsp;% fee and an automated dispute system that works for both parties.
              </motion.p>

              <motion.div variants={heroChild} className="mt-12">
                <Link href="/plugins">
                  <button className={btnPrimary}>Explore Plugins</button>
                </Link>
              </motion.div>

              <motion.div variants={heroChild} className="mt-8 pt-8 border-t border-secondary-200 dark:border-secondary-700 max-w-md">
                <Link
                  href="/p2p"
                  className="text-sm text-secondary-500 dark:text-secondary-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  Not a merchant? Request a payment here &rarr;
                </Link>
              </motion.div>

              <motion.div
                variants={heroChild}
                className="mt-14 flex flex-wrap gap-x-8 gap-y-2 text-xs text-secondary-400 dark:text-secondary-500"
              >
                <span>1% flat fee</span>
                <span>10-minute setup</span>
                <span>No vetting</span>
                <a href="https://github.com/conduit-ucpi/contracts" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors underline">Open source</a>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* HOW IT WORKS                                                     */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="How it works"
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
                  title: 'Create',
                  desc: 'Seller sets an amount and a payout date — typically a day after expected delivery, so the buyer has time to check the goods.',
                },
                {
                  num: '02',
                  title: 'Fund',
                  desc: 'Buyer pays into a smart contract. Funds are locked — neither party can touch them until the payout date.',
                },
                {
                  num: '03',
                  title: 'Release',
                  desc: 'On the payout date, seller gets paid automatically. If something went wrong, buyer can raise a dispute before that date to freeze the funds.',
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
        {/* TRY THE CHECKOUT                                                 */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Try the checkout"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-28">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Live demo
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-3"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                See what your customers see.
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md">
                This opens the actual Stabledrop checkout — the same experience your customers get when they click &ldquo;Pay&rdquo; on your site.
              </p>
              <button
                className={btnPrimary}
                onClick={() => {
                  const origin = window.location.origin;
                  const returnUrl = encodeURIComponent(`${origin}/checkout-example.html`);
                  window.open(
                    `${origin}/contract-create?seller=0x4f118f99a4e8bb384061bcfe081e3bbdec28482d&amount=10.00&description=Basic+Product+-+One-time+Payment&tokenSymbol=USDC&order_id=BASIC-1772027291139&epoch_expiry=1772632091&return=${returnUrl}`,
                    '_blank'
                  );
                }}
              >
                See what your customers see
              </button>
              <p className="mt-3 text-xs text-secondary-400 dark:text-secondary-500">
                Pay $10 (try for free)
              </p>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOR MERCHANTS                                                    */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label="For merchants"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                For merchants
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-16"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Everything traditional processors take from you, we don&apos;t.
              </h2>
            </Fade>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
              {[
                {
                  label: 'No chargebacks',
                  text: 'Disputes are negotiated between buyer and seller. No chargeback fees, no limits, no penalties on your account.',
                },
                {
                  label: 'No floats',
                  text: 'Your money is never held by a payment processor. Funds go straight from escrow to your wallet on the payout date.',
                },
                {
                  label: 'No freezes',
                  text: 'Transactions run on smart contracts. They execute even if our servers go down — nobody can freeze your funds.',
                },
                {
                  label: 'No vetting',
                  text: 'No KYC, no KYB, no applications, no approval process. Install and start accepting payments immediately.',
                },
                {
                  label: '10-minute setup',
                  text: 'WordPress plugin, Shopify plugin, or one line of JavaScript. No admin approval needed.',
                },
                {
                  label: 'Significant savings',
                  text: '1% flat fee vs. 1.5-3.5% + monthly fees + chargeback fees + float costs with traditional processors.',
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

            <Fade delay={0.4}>
              <div className="mt-12 flex flex-wrap gap-3">
                <Link href="/plugins">
                  <button className={btnPrimary}>View integrations</button>
                </Link>
                <Link href="/merchant-savings-calculator">
                  <button className={btnOutline}>Calculate savings</button>
                </Link>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOR BUYERS                                                       */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="For buyers"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                For buyers
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-16"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Pay with stablecoins and actually be protected.
              </h2>
            </Fade>

            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
              {[
                {
                  label: 'Buyer protection on every payment',
                  text: 'Funds are held in escrow until a pre-agreed date. If something goes wrong, raise a dispute before payout to freeze the funds. Works on P2P payments too.',
                },
                {
                  label: 'Gas-free transactions',
                  text: 'You don\'t need to hold ETH or any native coin. The system covers gas fees in the background.',
                },
                {
                  label: 'Automatic network and wallet',
                  text: 'No choosing networks, no copying wallet addresses. Sign in with Google or email and pay. The system handles the rest.',
                },
                {
                  label: 'Non-custodial',
                  text: 'The smart contract holds funds — they can only go to buyer or seller. Nobody else can touch them, not even us.',
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
                    <span>Merchant floats</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between border-b border-secondary-100 dark:border-secondary-800 pb-3">
                    <span>Minimum volume</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between border-b border-secondary-100 dark:border-secondary-800 pb-3">
                    <span>Vetting / KYB</span>
                    <span className="text-secondary-900 dark:text-white font-medium">None</span>
                  </div>
                  <div className="flex justify-between pb-3">
                    <span>Testing</span>
                    <span className="text-secondary-900 dark:text-white font-medium">Free</span>
                  </div>
                  <Link
                    href="/merchant-savings-calculator"
                    className="inline-block mt-2 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    See how much you&apos;d save vs. Stripe, Square or PayPal
                  </Link>
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
          aria-label="Explore plugins"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-28 pb-16 lg:pb-20">
            <Fade>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-3"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Add stablecoin checkout to your store.
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8 max-w-md">
                Integrate Stabledrop into your existing platform with our ready-made plugins.
              </p>
              <Link href="/plugins">
                <button className={btnPrimary}>Explore Plugins</button>
              </Link>
            </Fade>

            {/* Footer links */}
            <Fade delay={0.2}>
              <div className="mt-14 pt-8 border-t border-secondary-100 dark:border-secondary-800 flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
                <a
                  href="https://github.com/conduit-ucpi/contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  Source code
                </a>
                <Link href="/how-it-works" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  How it works
                </Link>
                <Link href="/faq" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  FAQ
                </Link>
                <Link href="/plugins" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  Integrations
                </Link>
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
