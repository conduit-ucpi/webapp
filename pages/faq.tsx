import Layout from '@/components/layout/Layout'
import SEO from '@/components/SEO'
import Link from 'next/link'
import { GetStaticProps } from 'next'

export default function FAQ() {
  // FAQ schema for search engines
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What happens if the seller never delivers my item - do I actually get my money back?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. If the seller doesn't deliver, you raise a dispute before the payout date by entering a comment explaining the issue and suggesting a refund amount. This immediately freezes the funds. The seller is notified by email and can respond with their own comments and refund suggestion through the dashboard. When both parties agree on the same refund amount, the dispute automatically resolves and pays out accordingly. If you can't agree, the funds remain frozen until you reach an agreement."
        }
      },
      {
        "@type": "Question",
        "name": "How do I know the admin team won't just steal my money?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The smart contract code is verified and published on the blockchain. You can see that only the seller or admin can claim funds, and the admin can only allocate disputed funds to either the buyer or seller - never to themselves. The code prevents theft. Additionally, our auto-arbitration system means disputes can resolve automatically when both parties agree, without admin intervention."
        }
      },
      {
        "@type": "Question",
        "name": "Who exactly makes dispute decisions and what are their qualifications?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Disputes use our auto-arbitration system. When you raise a dispute, you suggest a refund amount and explain your position. The other party can respond with their suggestion. You can both see the history of comments and suggestions in your dashboard. When you both enter the same refund amount, the dispute automatically resolves and distributes the funds accordingly."
        }
      }
    ]
  };

  return (
    <>
      <SEO
        title="FAQ - Crypto Escrow Questions Answered | Conduit Escrow"
        description="Get answers to all your questions about crypto escrow, USDC payments, disputes, security, and how our blockchain escrow system protects buyers and sellers."
        keywords="crypto escrow faq, blockchain escrow questions, USDC payment help, escrow dispute resolution, smart contract security, crypto payment protection, escrow how it works"
        canonical="/faq"
        structuredData={faqSchema}
      />
      <Layout children={
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h1>

              <div className="space-y-8">
                {/* Basic Functionality */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Basic Functionality</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What happens if the seller never delivers my item - do I actually get my money back?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Yes. If the seller doesn't deliver, you raise a dispute before the payout date by entering a comment explaining the issue and suggesting a refund amount. This immediately freezes the funds. The seller is notified by email and can respond with their own comments and refund suggestion through the dashboard. When both parties agree on the same refund amount, the dispute automatically resolves and pays out accordingly. If you can't agree, the funds remain frozen until you reach an agreement.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How do I know the admin team won't just steal my money?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The smart contract code is verified and published on the blockchain. You can see that only the seller or admin can claim funds, and the admin can only allocate disputed funds to either the buyer or seller - never to themselves. The code prevents theft. Additionally, our auto-arbitration system means disputes can resolve automatically when both parties agree, without admin intervention.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Who exactly makes dispute decisions and what are their qualifications?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Disputes use our auto-arbitration system. When you raise a dispute, you suggest a refund amount and explain your position. The other party can respond with their suggestion. You can both see the history of comments and suggestions in your dashboard. When you both enter the same refund amount, the dispute automatically resolves and distributes the funds accordingly. Full details at <Link href="/arbitration-policy" className="text-blue-600 hover:text-blue-800 underline">our arbitration policy page</Link>.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Timing and Process */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Timing and Process</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How long do I have to receive my item before money goes to the seller?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The seller sets an expiry date when creating the contract, and you agree to it before funding. If you don't like the timeframe, ask them to create a new contract with a different expiry date. You control what you agree to.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Can I cancel if I made a mistake or change my mind?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Once you've funded a contract, you can raise a dispute with a refund request. Enter your reason and suggest 100% refund if you made a mistake. The seller will be notified and can agree to your refund amount, allowing automatic resolution. This protects sellers who may have already shipped goods while giving buyers a path to resolution.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if I want to cancel before the buyer has put money in?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        This feature is on our development list. Currently, just tell the buyer the contract is invalid - they'd be foolish to fund it after you've said that.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Technical Issues */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Technical Issues</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if the seller loses access to their email or wallet?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        If someone's account is compromised, raise a dispute to prevent funds from being accessed by malicious parties.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What happens if your website goes down or your company shuts down?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        All contracts will continue to run their course since they're on the blockchain. We use Google Cloud for extremely reliable hosting. Our policy is to resolve any outstanding disputes before any potential shutdown.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if there's a dispute after your company is gone?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        All outstanding disputes would be resolved before any shutdown. The contracts technically belong to the buyer - our service just makes it easy to create and administer programmable money.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Costs and Payments */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Costs and Payments</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What does this actually cost me?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Our service charges a 1% transaction fee. The system works in USDC, and we provide tools to obtain USDC if needed, but we have no control over third-party conversion costs in your location. All blockchain gas fees are covered by us - the service is gasless for users.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if I want to make partial payments or installments?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Currently, you would create multiple separate contracts for different payment stages.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Disputes and Problems */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Disputes and Problems</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How long do I have to wait for dispute resolution?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Once in dispute, funds are frozen so you're protected. Through the 'Manage Dispute' feature in your dashboard, you and the seller can exchange comments and refund proposals. The dispute automatically resolves as soon as you both agree on the same refund amount. There's no fixed timeline - resolution happens instantly when you reach agreement.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What stops people from creating fake contracts to scam others?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        If someone turns out to be a scammer and your goods don't arrive, you can dispute at any point up until the expiry date and get your money back for non-delivery.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if someone disputes in bad faith to get free stuff?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Sellers should keep evidence of packing and sending. When disputes are raised, investigation with courier companies will reveal the truth about delivery.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if the item arrives but is completely different from what was described?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The system provides trustless payment infrastructure. It's between buyer and seller to agree whether an item is "as described" and what the resolution should be. A common resolution is for the seller to accept returned goods and refund the buyer once the item is back with the seller.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if I need to dispute but it's outside business hours?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Once in dispute, funds are frozen so you're safe. You can manage the dispute through your dashboard at any time - view the history of comments and refund suggestions, and add your own. The system works 24/7, and disputes auto-resolve the moment both parties agree on a refund amount.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if the seller goes silent after I pay but before expiry?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        You can dispute at any time before expiry by clicking 'Raise Dispute' in your dashboard. Enter a comment explaining the lack of communication and suggest a full refund. The seller will be notified and can respond through their dashboard. If they agree to your refund amount, the dispute resolves automatically.
                      </p>
                    </article>
                  </div>
                </section>

                {/* International and Legal Issues */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">International and Legal Issues</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What about international transactions and different countries' laws?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        This is an escrow money transfer service, not an arbitration service. Legal arbitration is between buyer and seller. Once resolution has been agreed (with or without legal involvement), funds are allocated according to that agreement.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if expensive items need legal arbitration?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The contracts are technically owned by the buyer. If buyer and seller can't reach agreement, legal arbitration between them is their responsibility. The conclusion of that process informs our admin team how to allocate disputed funds.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Privacy and Security */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Privacy and Security</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What information do you store about me?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Our privacy policy is at <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">our privacy policy page</Link>. On the public blockchain: amount, buyer wallet ID, seller wallet ID, expiry date, and description. We store email addresses on secured servers as they're necessary to provide the service, but this data is not part of any public interface.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if there's a bug in the smart contract code?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Every contract uses the same verified code available on the blockchain. We have verified our code using established security services.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How can I verify for myself that you can't steal my money?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Want to verify our code yourself? Copy the verified contract from the blockchain explorer and paste it into tools like MythX, ask ChatGPT "can the admin steal funds from this contract?", or have any Solidity developer review it. The code is extensively commented to make admin limitations clear.
                        <br /><br />
                        We've used <a href="https://solidityscan.com/quickscan" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">SolidityScan</a> to audit our contracts - you can too. It'll ask you to select a blockchain (we are on Base) and then paste in a contract address (you can get one by making a test transaction of $0.001 on our system for free). It'll give you a full audit report with a score of 94%: 'Great'.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Is there any reputation tracking or feedback system?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        No. This system exists to eliminate the need for trust in transactions because both parties are protected - no more "pay and hope."
                      </p>
                    </article>
                  </div>
                </section>

                {/* Support and Documentation */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Support and Documentation</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if I need help with technical issues that aren't disputes?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Technical support is available by emailing <a href="mailto:info@conduit-ucpi.com" className="text-blue-600 hover:text-blue-800 underline">info@conduit-ucpi.com</a>
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Can I get proper receipts/invoices for business transactions?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        That sounds like a great enhancement. Email us at <a href="mailto:info@conduit-ucpi.com" className="text-blue-600 hover:text-blue-800 underline">info@conduit-ucpi.com</a> to discuss your needs.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if my payment gets stuck and doesn't make it to the contract?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The system reads contract status directly from the blockchain where funds are held. Our contract code makes it impossible for a transaction to go from "funds-deposited" back to "awaiting payment."
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What about time-sensitive purchases like concert tickets?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        This system is ideal for time-sensitive purchases. You can set the expiry date when making the buyer/seller agreement to ensure delivery by your required date.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if I accidentally send money to the wrong contract or enter the wrong amount?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        You're not stuck with mistakes - raise a dispute immediately with a comment explaining the error and request 100% refund. When the other party sees your explanation and agrees to the refund amount, the dispute will automatically resolve and return your funds.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How long should I wait before disputing if I need time to inspect complex items?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        This system provides escrow infrastructure to make transactions trustless. Agreements about inspection periods and acceptance criteria are for buyer and seller to negotiate between themselves.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Getting Started */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Getting Started</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        This sounds complicated with crypto and wallets - can you walk me through what I actually need to do?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        1. Get USDC using the instructions on our wallet management screen. 2. Ask your seller to go to our website, authenticate, and click 'request payment' (they enter your email, amount, payout date, description). 3. You get an email, log in to see the pending payment, check details and accept. That's it!
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What is USDC and why can't I just pay with regular money?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        USDC is a stablecoin cryptocurrency that's always 1:1 with USD. You need it to use blockchain smart contracts that make this service possible - giving you mathematical guarantees about payment protection that regular payment systems can't provide.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        I'm nervous about using cryptocurrency - isn't this risky and complicated?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        You've been using electronic money for decades - your bank balance is just numbers in a computer, not physical cash. USDC works the same way, except it runs on public infrastructure instead of private bank systems. The main practical differences: 1) You can verify transactions yourself on the blockchain, 2) No one can freeze or reverse your payments without your consent, 3) It works 24/7 globally without bank business hours or international transfer delays. The "crypto" part is just the technology that makes these guarantees possible - you don't need to understand blockchain any more than you need to understand SWIFT networks to use regular bank transfers.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How do I authenticate - is this another username/password account?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Authentication is simple: either choose your Google account or enter your email address and receive a 6-digit code to enter on screen.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What does it cost to get USDC?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        We don't control crypto exchanges, so costs depend on which exchange you use and their terms. If you find this service useful, consider keeping some money in USDC for future transactions.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if I make a mistake during setup?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        If the seller creates the wrong email, you won't get notifications. Wrong amount? Just ignore it and ask them to create a new request. If you somehow fund the wrong contract, raise a dispute and we'll sort it out.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Why Use This */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Why Use This</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Why not just negotiate directly with the seller instead of using your service?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The key advantage is that sellers don't get the money until you're satisfied, so they're incentivized to resolve any problems. It also protects sellers by showing they're dealing with a buyer who has funds ready.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What's the smallest purchase amount where this makes sense?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Consider the exchange fees to get USDC plus our 1% transaction fee. This works well for purchases where you can't meet in person or need extra protection. Also remember: if a seller refuses to use this system for spurious reasons, you probably just avoided a scam.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Is this mainly for crypto-savvy people or can regular consumers use it?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        It's designed for regular people. The biggest friction is getting USDC initially - we're working on easier onramps. If you can copy and paste addresses, you should be fine. Try our free $0.001 test option to see how it works risk-free.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Can I use this for purchases from other cities or countries?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Yes! This enables safe transactions with sellers anywhere, since you're protected regardless of geographic location. You're not limited to local sellers you can meet in person.
                      </p>
                    </article>
                  </div>
                </section>

                {/* System Reliability */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">System Reliability</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if your website crashes or there are technical problems?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The system runs on Google Cloud with automated deployment and is built by experienced engineers (ex-Skyscanner principals with 50+ years combined experience). Most importantly, your transactions exist on the blockchain independently of our servers - you own them and could theoretically use other tools to access them if needed.
                      </p>
                    </article>
                  </div>
                </section>
              </div>

              <div className="mt-12 p-6 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Still have questions?
                </h3>
                <p className="text-gray-600">
                  Contact our support team at <a href="mailto:info@conduit-ucpi.com" className="text-blue-600 hover:text-blue-800 underline">info@conduit-ucpi.com</a> for additional assistance.
                </p>
              </div>
            </div>
          </div>
        </div>
      } />
    </>
  )
}

// Static generation for SEO
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 86400, // Revalidate daily
  };
};
