import Layout from '@/components/layout/Layout'
import { useConfig } from '@/components/auth/ConfigProvider'
import { getChainName } from '@/utils/chainNames'

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
    title: 'Timing and Process',
    items: [
      {
        question: "How long do I have to receive my item before money goes to the seller?",
        answer: "The seller sets an expiry date when creating the contract, and you agree to it before funding. If you don't like the timeframe, ask them to create a new contract with a different expiry date. You control what you agree to."
      },
      {
        question: "Can I cancel if I made a mistake or change my mind?",
        answer: "Once you've funded a contract, you can raise a dispute with a refund request. Enter your reason and suggest 100% refund if you made a mistake. The seller will be notified and can agree to your refund amount, allowing automatic resolution. This protects sellers who may have already shipped goods while giving buyers a path to resolution."
      },
      {
        question: "What if I want to cancel before the buyer has put money in?",
        answer: "This feature is on our development list. Currently, just tell the buyer the contract is invalid - they'd be foolish to fund it after you've said that."
      }
    ]
  },
  {
    title: 'Technical Issues',
    items: [
      {
        question: "What if the seller loses access to their email or wallet?",
        answer: "If someone's account is compromised, raise a dispute to prevent funds from being accessed by malicious parties."
      },
      {
        question: "What happens if your website goes down or your company shuts down?",
        answer: "All contracts will continue to run their course since they're on the blockchain. We use Google Cloud for extremely reliable hosting. Our policy is to resolve any outstanding disputes before any potential shutdown."
      },
      {
        question: "What if there's a dispute after your company is gone?",
        answer: "All outstanding disputes would be resolved before any shutdown. The contracts technically belong to the buyer - our service just makes it easy to create and administer programmable money."
      }
    ]
  },
  {
    title: 'Costs and Payments',
    items: [
      {
        question: "What does this actually cost me?",
        answer: "Our service charges a flat $1 USDC fee. The system works in USDC, and we provide tools to obtain USDC if needed, but we have no control over third-party conversion costs in your location. All blockchain gas fees are covered by us - the service is gasless for users."
      },
      {
        question: "What if I want to make partial payments or installments?",
        answer: "Currently, you would create multiple separate contracts for different payment stages."
      }
    ]
  },
  {
    title: 'Disputes and Problems',
    items: [
      {
        question: "How long do I have to wait for dispute resolution?",
        answer: "Once in dispute, funds are frozen so you're protected. Through the 'Manage Dispute' feature in your dashboard, you and the seller can exchange comments and refund proposals. The dispute automatically resolves as soon as you both agree on the same refund amount. There's no fixed timeline - resolution happens instantly when you reach agreement."
      },
      {
        question: "What stops people from creating fake contracts to scam others?",
        answer: "If someone turns out to be a scammer and your goods don't arrive, you can dispute at any point up until the expiry date and get your money back for non-delivery."
      },
      {
        question: "What if someone disputes in bad faith to get free stuff?",
        answer: "Sellers should keep evidence of packing and sending. When disputes are raised, investigation with courier companies will reveal the truth about delivery."
      },
      {
        question: "What if the item arrives but is completely different from what was described?",
        answer: "The system provides trustless payment infrastructure. It's between buyer and seller to agree whether an item is \"as described\" and what the resolution should be. A common resolution is for the seller to accept returned goods and refund the buyer once the item is back with the seller."
      },
      {
        question: "What if I need to dispute but it's outside business hours?",
        answer: "Once in dispute, funds are frozen so you're safe. You can manage the dispute through your dashboard at any time - view the history of comments and refund suggestions, and add your own. The system works 24/7, and disputes auto-resolve the moment both parties agree on a refund amount."
      },
      {
        question: "What if the seller goes silent after I pay but before expiry?",
        answer: "You can dispute at any time before expiry by clicking 'Raise Dispute' in your dashboard. Enter a comment explaining the lack of communication and suggest a full refund. The seller will be notified and can respond through their dashboard. If they agree to your refund amount, the dispute resolves automatically."
      }
    ]
  },
  {
    title: 'International and Legal Issues',
    items: [
      {
        question: "What about international transactions and different countries' laws?",
        answer: "This is an escrow money transfer service, not an arbitration service. Legal arbitration is between buyer and seller. Once resolution has been agreed (with or without legal involvement), funds are allocated according to that agreement."
      },
      {
        question: "What if expensive items need legal arbitration?",
        answer: "The contracts are technically owned by the buyer. If buyer and seller can't reach agreement, legal arbitration between them is their responsibility. The conclusion of that process informs our admin team how to allocate disputed funds."
      }
    ]
  },
  {
    title: 'Privacy and Security',
    items: [
      {
        question: "What information do you store about me?",
        answer: "Our privacy policy is at https://app.instantescrow.nz/privacy-policy. On the public blockchain: amount, buyer wallet ID, seller wallet ID, expiry date, and description. We store email addresses on secured servers as they're necessary to provide the service, but this data is not part of any public interface."
      },
      {
        question: "What if there's a bug in the smart contract code?",
        answer: "Every contract uses the same verified code available on the blockchain. We have verified our code using established security services."
      },
      {
        question: "How can I verify for myself that you can't steal my money?",
        answer: (contractAddress: string, chainName: string, explorerUrl: string) => `Want to verify our code yourself? Copy the verified contract from the blockchain explorer link (available from any contract in our app or <a href="${explorerUrl}/address/${contractAddress}#code" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">here</a>) and paste it into tools like MythX, ask ChatGPT "can the admin steal funds from this contract?", or have any Solidity developer review it. The code is extensively commented to make admin limitations clear.
We've used https://solidityscan.com/quickscan to audit our contracts - you can too. It'll ask you to select a blockchain (we are on ${chainName}) and then paste in a contract address (you can get one by making a test transaction of $0.001 on our system for free). It'll give you a full audit report. If you don't want to do that, you can use our current contract address: <a href="${explorerUrl}/address/${contractAddress}#code" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">${contractAddress}</a> - score is now 94%: 'Great'`
      },
      {
        question: "Is there any reputation tracking or feedback system?",
        answer: "No. This system exists to eliminate the need for trust in transactions because both parties are protected - no more \"pay and hope.\""
      }
    ]
  },
  {
    title: 'Support and Documentation',
    items: [
      {
        question: "What if I need help with technical issues that aren't disputes?",
        answer: "Technical support is available by emailing info@conduit-ucpi.com"
      },
      {
        question: "Can I get proper receipts/invoices for business transactions?",
        answer: "That sounds like a great enhancement. Email us at info@conduit-ucpi.com to discuss your needs."
      },
      {
        question: "What if my payment gets stuck and doesn't make it to the contract?",
        answer: "The system reads contract status directly from the blockchain where funds are held. Our contract code makes it impossible for a transaction to go from \"funds-deposited\" back to \"awaiting payment.\""
      },
      {
        question: "What about time-sensitive purchases like concert tickets?",
        answer: "This system is ideal for time-sensitive purchases. You can set the expiry date when making the buyer/seller agreement to ensure delivery by your required date."
      },
      {
        question: "What if I accidentally send money to the wrong contract or enter the wrong amount?",
        answer: "You're not stuck with mistakes - raise a dispute immediately with a comment explaining the error and request 100% refund. When the other party sees your explanation and agrees to the refund amount, the dispute will automatically resolve and return your funds."
      },
      {
        question: "How long should I wait before disputing if I need time to inspect complex items?",
        answer: "This system provides escrow infrastructure to make transactions trustless. Agreements about inspection periods and acceptance criteria are for buyer and seller to negotiate between themselves."
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
        question: "I'm nervous about using cryptocurrency - isn't this risky and complicated?",
        answer: "You've been using electronic money for decades - your bank balance is just numbers in a computer, not physical cash. USDC works the same way, except it runs on public infrastructure instead of private bank systems. The main practical differences: 1) You can verify transactions yourself on the blockchain, 2) No one can freeze or reverse your payments without your consent, 3) It works 24/7 globally without bank business hours or international transfer delays. The \"crypto\" part is just the technology that makes these guarantees possible - you don't need to understand blockchain any more than you need to understand SWIFT networks to use regular bank transfers."
      },
      {
        question: "How do I authenticate - is this another username/password account?",
        answer: "Authentication is simple: either choose your Google account or enter your email address and receive a 6-digit code to enter on screen."
      },
      {
        question: "What does it cost to get USDC?",
        answer: "We don't control crypto exchanges, so costs depend on which exchange you use and their terms. If you find this service useful, consider keeping some money in USDC for future transactions."
      },
      {
        question: "What if I make a mistake during setup?",
        answer: "If the seller creates the wrong email, you won't get notifications. Wrong amount? Just ignore it and ask them to create a new request. If you somehow fund the wrong contract, raise a dispute and we'll sort it out."
      }
    ]
  },
  {
    title: 'Why Use This',
    items: [
      {
        question: "Why not just negotiate directly with the seller instead of using your service?",
        answer: "The key advantage is that sellers don't get the money until you're satisfied, so they're incentivized to resolve any problems. It also protects sellers by showing they're dealing with a buyer who has funds ready."
      },
      {
        question: "What's the smallest purchase amount where this makes sense?",
        answer: "Consider the exchange fees to get USDC plus our $1 fee. This works well for purchases where you can't meet in person or need extra protection. Also remember: if a seller refuses to use this system for spurious reasons, you probably just avoided a scam."
      },
      {
        question: "Is this mainly for crypto-savvy people or can regular consumers use it?",
        answer: "It's designed for regular people. The biggest friction is getting USDC initially - we're working on easier onramps. If you can copy and paste addresses, you should be fine. Try our free $0.001 test option to see how it works risk-free."
      },
      {
        question: "Can I use this for purchases from other cities or countries?",
        answer: "Yes! This enables safe transactions with sellers anywhere, since you're protected regardless of geographic location. You're not limited to local sellers you can meet in person."
      }
    ]
  },
  {
    title: 'System Reliability',
    items: [
      {
        question: "What if your website crashes or there are technical problems?",
        answer: "The system runs on Google Cloud with automated deployment and is built by experienced engineers (ex-Skyscanner principals with 50+ years combined experience). Most importantly, your transactions exist on the blockchain independently of our servers - you own them and could theoretically use other tools to access them if needed."
      }
    ]
  }
]

export default function FAQ() {
  const { config } = useConfig()
  const contractAddress = config?.contractAddress || '0xAa1Be17F1F8A0F96a1308f596740552c4145627d' // fallback to current address
  const chainName = config ? getChainName(config.chainId) : 'blockchain'
  const explorerUrl = config?.explorerBaseUrl || 'https://base.blockscout.com'
  
  const faqSections = getFaqSections(chainName, explorerUrl)
  
  return (
    <Layout children={
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h1>
            
            <div className="space-y-8">
              {faqSections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">{section.title}</h2>
                  <div className="space-y-4">
                    {section.items.map((faq, index) => {
                      const answer = typeof faq.answer === 'function' ? faq.answer(contractAddress, chainName, explorerUrl) : faq.answer
                      return (
                        <div key={index} className="bg-white rounded-lg shadow-sm p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            {faq.question}
                          </h3>
                          <div className="text-gray-600 leading-relaxed whitespace-pre-line" 
                               dangerouslySetInnerHTML={{ __html: answer.replace(/\n/g, '<br />') }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Still have questions?
              </h3>
              <p className="text-gray-600">
                Contact our support team at info@conduit-ucpi.com for additional assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    } />
  )
}