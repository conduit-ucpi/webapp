import { useState } from 'react'
import Head from 'next/head'
import { useConfig } from '../components/auth/ConfigProvider'
import { getChainName } from '../utils/chainNames'
import { formatDateTimeWithTZ, formatDate } from '../utils/validation'

const sections = {
  faq: 'FAQ',
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  arbitration: 'Arbitration'
}

interface FAQItem {
  question: string
  answer: string | ((contractAddress: string, chainName: string, explorerUrl: string) => string)
}

interface FAQSection {
  title: string
  items: FAQItem[]
}

const getFaqSections = (chainName: string, explorerUrl: string): FAQSection[] => [
  {
    title: 'Basic Functionality',
    items: [
      {
        question: "What happens if the seller never delivers my item - do I actually get my money back?",
        answer: "Yes. If the seller doesn't deliver, you raise a dispute before the payout date by entering a comment explaining the issue and suggesting a refund amount. This immediately freezes the funds. The seller is notified by email and can respond with their own comments and refund suggestion through the dashboard. When both parties agree on the same refund amount, the dispute automatically resolves and pays out accordingly. If you can't agree, the funds remain frozen until you reach an agreement."
      },
      {
        question: "How do I know the admin team won't just steal my money?",
        answer: "The smart contract code is verified and published on the blockchain. You can see that only the seller or admin can claim funds, and the admin can only allocate disputed funds to either the buyer or seller - never to themselves. The code prevents theft. Additionally, our auto-arbitration system means disputes can resolve automatically when both parties agree, without admin intervention."
      },
      {
        question: "Who exactly makes dispute decisions and what are their qualifications?",
        answer: "Disputes use our auto-arbitration system. When you raise a dispute, you suggest a refund amount and explain your position. The other party can respond with their suggestion. You can both see the history of comments and suggestions in your dashboard. When you both enter the same refund amount, the dispute automatically resolves and distributes the funds accordingly. Full details at https://app.instantescrow.nz/arbitration-policy."
      }
    ]
  },
  {
    title: 'Getting Started',
    items: [
      {
        question: "This sounds complicated with crypto and wallets - can you walk me through what I actually need to do?",
        answer: "1. Get USDC using the instructions on our wallet management screen. 2. Ask your seller to go to https://app.instantescrow.nz, authenticate, and click 'request payment' (they enter your email, amount, payout date, description). 3. You get an email, log in to see the pending payment, check details and accept. That's it!"
      },
      {
        question: "What is USDC and why can't I just pay with regular money?",
        answer: "USDC is a stablecoin cryptocurrency that's always 1:1 with USD. You need it to use blockchain smart contracts that make this service possible - giving you mathematical guarantees about payment protection that regular payment systems can't provide."
      },
      {
        question: "How do I authenticate - is this another username/password account?",
        answer: "Authentication is simple: either choose your Google account or enter your email address and receive a 6-digit code to enter on screen."
      }
    ]
  },
  {
    title: 'Costs and Security',
    items: [
      {
        question: "What does this actually cost me?",
        answer: "Our service charges a flat $1 USDC fee. The system works in USDC, and we provide tools to obtain USDC if needed, but we have no control over third-party conversion costs in your location. All blockchain gas fees are covered by us - the service is gasless for users."
      },
      {
        question: "How can I verify for myself that you can't steal my money?",
        answer: (contractAddress: string, chainName: string, explorerUrl: string) => `Want to verify our code yourself? Copy the verified contract from the blockchain explorer link (available from any contract in our app or <a href="${explorerUrl}/address/${contractAddress}#code" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">here</a>) and paste it into tools like MythX, ask ChatGPT "can the admin steal funds from this contract?", or have any Solidity developer review it. The code is extensively commented to make admin limitations clear.
We've used https://solidityscan.com/quickscan to audit our contracts - you can too. It'll ask you to select a blockchain (we are on ${chainName}) and then paste in a contract address (you can get one by making a test transaction of $0.001 on our system for free). It'll give you a full audit report. If you don't want to do that, you can use our current contract address: <a href="${explorerUrl}/address/${contractAddress}#code" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">${contractAddress}</a> - score is now 94%: 'Great'`
      }
    ]
  }
]

export default function PluginPage() {
  const [activeSection, setActiveSection] = useState<keyof typeof sections>('faq')

  return (
    <>
      <Head>
        <title>Plugin Information - Conduit UCPI</title>
        <meta name="description" content="FAQ, Terms & Conditions, Privacy Policy, and Arbitration information for Conduit UCPI" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-3xl font-bold text-gray-900">Plugin Information</h1>
            </div>

            {/* Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {Object.entries(sections).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key as keyof typeof sections)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeSection === key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
              {activeSection === 'faq' && <FAQSection />}
              {activeSection === 'terms' && <TermsSection />}
              {activeSection === 'privacy' && <PrivacySection />}
              {activeSection === 'arbitration' && <ArbitrationSection />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function FAQSection() {
  const { config } = useConfig()
  const contractAddress = config?.contractAddress || '0xAa1Be17F1F8A0F96a1308f596740552c4145627d'
  const chainName = config ? getChainName(config.chainId) : 'blockchain'
  const explorerUrl = config?.explorerBaseUrl || 'https://base.blockscout.com'
  
  const faqSections = getFaqSections(chainName, explorerUrl)
  
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
      {faqSections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">{section.title}</h3>
          <div className="space-y-4">
            {section.items.map((faq, index) => {
              const answer = typeof faq.answer === 'function' ? faq.answer(contractAddress, chainName, explorerUrl) : faq.answer
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">{faq.question}</h4>
                  <div className="text-gray-600 leading-relaxed whitespace-pre-line" 
                       dangerouslySetInnerHTML={{ __html: answer.replace(/\n/g, '<br />') }} />
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Still have questions?</h4>
        <p className="text-gray-600">Contact our support team at info@conduit-ucpi.com for additional assistance.</p>
      </div>
    </div>
  )
}

function TermsSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Terms of Service</h2>
      <div className="prose max-w-none text-gray-600">
        <p className="text-sm text-gray-500 mb-6">
          <strong>Last Updated:</strong> {formatDateTimeWithTZ(Date.now())}
        </p>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h3>
          <p className="text-gray-700 mb-4">
            By accessing and using Conduit UCPI ("the Service"), you accept and agree to be bound by the terms 
            and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">2. Description of Service</h3>
          <p className="text-gray-700 mb-4">
            Conduit UCPI is a decentralized escrow platform that enables users to create time-delayed escrow 
            contracts on EVM-compatible blockchains. The Service facilitates:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Creation and management of escrow contracts</li>
            <li>USDC token transactions and transfers</li>
            <li>Integration with Web3 wallets and payment processors</li>
            <li>Dispute resolution mechanisms</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">3. User Responsibilities</h3>
          <p className="text-gray-700 mb-4">By using the Service, you agree to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Provide accurate and truthful information</li>
            <li>Maintain the security of your wallet and private keys</li>
            <li>Comply with all applicable laws and regulations</li>
            <li>Not use the Service for illegal or fraudulent activities</li>
            <li>Not attempt to exploit, hack, or disrupt the Service</li>
            <li>Be solely responsible for your transactions and their outcomes</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">4. Risks and Disclaimers</h3>
          <p className="text-gray-700 mb-4">
            <strong>IMPORTANT:</strong> Use of blockchain technology and cryptocurrencies involves significant risks:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Transactions on the blockchain are irreversible</li>
            <li>Smart contracts may contain bugs or vulnerabilities</li>
            <li>Network congestion may delay transactions</li>
            <li>Loss of private keys results in permanent loss of funds</li>
            <li>Regulatory changes may affect the availability of the Service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">5. Limitation of Liability</h3>
          <p className="text-gray-700 mb-4">
            To the maximum extent permitted by law, Conduit UCPI and its operators shall not be liable for any 
            direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Loss of funds or cryptocurrencies</li>
            <li>Smart contract failures or exploits</li>
            <li>Network downtime or service interruptions</li>
            <li>Third-party service failures (Web3Auth, MoonPay, etc.)</li>
            <li>User error or misuse of the platform</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">6. Contact Information</h3>
          <p className="text-gray-700">
            If you have any questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:legal@conduit-ucpi.com" className="text-primary-600 hover:text-primary-500">
              legal@conduit-ucpi.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}

function PrivacySection() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
      <div className="prose max-w-none text-gray-600">
        <p className="text-sm text-gray-500 mb-6">
          <strong>Last Updated:</strong> {formatDate(Date.now())}
        </p>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">1. Information We Collect</h3>
          <p className="text-gray-700 mb-4">When you use Conduit UCPI, we collect the following types of information:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Wallet addresses and public blockchain data</li>
            <li>Email addresses for account identification</li>
            <li>Transaction data related to escrow contracts</li>
            <li>Usage analytics and performance metrics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">2. How We Use Your Information</h3>
          <p className="text-gray-700 mb-4">We use the information we collect to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Provide and maintain our escrow services</li>
            <li>Process transactions and manage contracts</li>
            <li>Communicate with you about your account and transactions</li>
            <li>Improve our services and user experience</li>
            <li>Comply with legal obligations and prevent fraud</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">3. Information Sharing</h3>
          <p className="text-gray-700 mb-4">
            We do not sell, trade, or otherwise transfer your personal information to third parties, except:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>When required by law or legal process</li>
            <li>To protect our rights, property, or safety</li>
            <li>With your explicit consent</li>
            <li>With service providers who assist in our operations (under strict confidentiality agreements)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">4. Blockchain Data</h3>
          <p className="text-gray-700 mb-4">
            Please note that blockchain transactions are public and immutable. Once a transaction is recorded on the 
            blockchain, it cannot be modified or deleted. This includes your wallet address and transaction 
            amounts, which will be permanently visible on the blockchain.
          </p>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">5. Your Rights</h3>
          <p className="text-gray-700 mb-4">You have the right to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Access and review your personal information</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your personal information (subject to legal requirements)</li>
            <li>Withdraw consent for data processing where applicable</li>
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">6. Contact Us</h3>
          <p className="text-gray-700">
            If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
            <a href="mailto:privacy@conduit-ucpi.com" className="text-primary-600 hover:text-primary-500">
              privacy@conduit-ucpi.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}

function ArbitrationSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Instant Escrow Auto-Arbitration System</h2>
      <p className="text-lg text-gray-600 italic">How Disputes Work - For Buyers and Sellers</p>
      
      <div className="prose max-w-none">
        <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Overview</h3>
          <p className="text-gray-600 mb-2">
            Our auto-arbitration system empowers buyers and sellers to resolve disputes directly. <strong>Once funds are in dispute, they're frozen until both parties agree on a refund amount.</strong> The system automatically executes the agreed resolution without requiring admin intervention.
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">How the Auto-Arbitration System Works</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-gray-700">
                <strong>Key Innovation:</strong> When both parties enter the same refund amount, the dispute automatically resolves and distributes funds accordingly. No waiting for admin decisions.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Step-by-Step Process</h4>
              <ol className="list-decimal list-inside text-gray-600 space-y-2">
                <li><strong>Buyer raises dispute</strong> - Enters a comment explaining the issue and suggests a refund amount</li>
                <li><strong>Seller gets notified</strong> - Receives email alert about the dispute</li>
                <li><strong>Both parties negotiate</strong> - Through the dashboard, each can:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>View all comments and refund suggestions history</li>
                    <li>Add new comments to explain their position</li>
                    <li>Submit refund amount proposals</li>
                  </ul>
                </li>
                <li><strong>Automatic resolution</strong> - When both enter the same amount, funds distribute instantly</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Managing Your Dispute</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Through Your Dashboard</h4>
              <p className="text-gray-600 mb-2">Click "Manage Dispute" on any disputed contract to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li><strong>View history</strong> - See all previous comments and refund suggestions from both parties</li>
                <li><strong>Add comments</strong> - Explain your position, provide evidence, respond to the other party</li>
                <li><strong>Propose refund amount</strong> - Enter what you think is fair (can be updated anytime)</li>
                <li><strong>Track progress</strong> - See how close you are to agreement</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Contact Information</h3>
          <div className="space-y-2 text-gray-600">
            <p>
              <strong>Technical Support:</strong> info@conduit-ucpi.com<br/>
              <strong>Platform Issues:</strong> Include contract reference number and description of the problem
            </p>
            <p>
              <strong>Note:</strong> Support staff cannot make dispute allocation decisions - resolutions must come from mutual agreement through the auto-arbitration system.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}