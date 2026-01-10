import Layout from '@/components/layout/Layout'
import SEO from '@/components/SEO'
import Link from 'next/link'
import { GetStaticProps } from 'next'
import { useConfig } from '@/components/auth/ConfigProvider'

export default function FAQ() {
  const { config } = useConfig();
  // Comprehensive FAQ schema for search engines - ALL questions for maximum SEO/AI bot coverage
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      // Basic Functionality
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
          "text": "Disputes use our auto-arbitration system. When you raise a dispute, you suggest a refund amount and explain your position. The other party can respond with their suggestion. You can both see the history of comments and suggestions in your dashboard. When you both enter the same refund amount, the dispute automatically resolves and distributes the funds accordingly. Full details at our arbitration policy page."
        }
      },
      // Timing and Process
      {
        "@type": "Question",
        "name": "How long do I have to receive my item before money goes to the seller?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The seller sets an expiry date when creating the contract, and you agree to it before funding. If you don't like the timeframe, ask them to create a new contract with a different expiry date. You control what you agree to."
        }
      },
      {
        "@type": "Question",
        "name": "Can I cancel if I made a mistake or change my mind?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Once you've funded a contract, you can raise a dispute with a refund request. Enter your reason and suggest 100% refund if you made a mistake. The seller will be notified and can agree to your refund amount, allowing automatic resolution. This protects sellers who may have already shipped goods while giving buyers a path to resolution."
        }
      },
      {
        "@type": "Question",
        "name": "What if I want to cancel before the buyer has put money in?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "This feature is on our development list. Currently, just tell the buyer the contract is invalid - they'd be foolish to fund it after you've said that."
        }
      },
      // Technical Issues
      {
        "@type": "Question",
        "name": "What if the seller loses access to their email or wallet?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "If someone's account is compromised, raise a dispute to prevent funds from being accessed by malicious parties."
        }
      },
      {
        "@type": "Question",
        "name": "What happens if your website goes down or your company shuts down?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "All contracts will continue to run their course since they're on the blockchain. We use Google Cloud for extremely reliable hosting. Our policy is to resolve any outstanding disputes before any potential shutdown."
        }
      },
      {
        "@type": "Question",
        "name": "What if there's a dispute after your company is gone?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "All outstanding disputes would be resolved before any shutdown. The contracts technically belong to the buyer - our service just makes it easy to create and administer programmable money."
        }
      },
      // Costs and Payments
      {
        "@type": "Question",
        "name": "What does this actually cost me?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our service charges a 1% transaction fee. The system works in USDC, and we provide tools to obtain USDC if needed, but we have no control over third-party conversion costs in your location. All blockchain gas fees are covered by us - the service is gasless for users."
        }
      },
      {
        "@type": "Question",
        "name": "What if I want to make partial payments or installments?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Currently, you would create multiple separate contracts for different payment stages."
        }
      },
      // Disputes and Problems
      {
        "@type": "Question",
        "name": "How long do I have to wait for dispute resolution?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Once in dispute, funds are frozen so you're protected. Through the 'Manage Dispute' feature in your dashboard, you and the seller can exchange comments and refund proposals. The dispute automatically resolves as soon as you both agree on the same refund amount. There's no fixed timeline - resolution happens instantly when you reach agreement."
        }
      },
      {
        "@type": "Question",
        "name": "What stops people from creating fake contracts to scam others?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "If someone turns out to be a scammer and your goods don't arrive, you can dispute at any point up until the expiry date and get your money back for non-delivery."
        }
      },
      {
        "@type": "Question",
        "name": "What if someone disputes in bad faith to get free stuff?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Sellers should keep evidence of packing and sending. When disputes are raised, investigation with courier companies will reveal the truth about delivery."
        }
      },
      {
        "@type": "Question",
        "name": "What if the item arrives but is completely different from what was described?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The system provides trustless payment infrastructure. It's between buyer and seller to agree whether an item is 'as described' and what the resolution should be. A common resolution is for the seller to accept returned goods and refund the buyer once the item is back with the seller."
        }
      },
      {
        "@type": "Question",
        "name": "What if I need to dispute but it's outside business hours?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Once in dispute, funds are frozen so you're safe. You can manage the dispute through your dashboard at any time - view the history of comments and refund suggestions, and add your own. The system works 24/7, and disputes auto-resolve the moment both parties agree on a refund amount."
        }
      },
      {
        "@type": "Question",
        "name": "What if the seller goes silent after I pay but before expiry?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can dispute at any time before expiry by clicking 'Raise Dispute' in your dashboard. Enter a comment explaining the lack of communication and suggest a full refund. The seller will be notified and can respond through their dashboard. If they agree to your refund amount, the dispute resolves automatically."
        }
      },
      // International and Legal Issues
      {
        "@type": "Question",
        "name": "What about international transactions and different countries' laws?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "This is an escrow money transfer service, not an arbitration service. Legal arbitration is between buyer and seller. Once resolution has been agreed (with or without legal involvement), funds are allocated according to that agreement."
        }
      },
      {
        "@type": "Question",
        "name": "What if expensive items need legal arbitration?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The contracts are technically owned by the buyer. If buyer and seller can't reach agreement, legal arbitration between them is their responsibility. The conclusion of that process informs our admin team how to allocate disputed funds."
        }
      },
      // Privacy and Security
      {
        "@type": "Question",
        "name": "What information do you store about me?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our privacy policy is at our privacy policy page. On the public blockchain: amount, buyer wallet ID, seller wallet ID, expiry date, and description. We store email addresses on secured servers as they're necessary to provide the service, but this data is not part of any public interface."
        }
      },
      {
        "@type": "Question",
        "name": "What if there's a bug in the smart contract code?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Every contract uses the same verified code available on the blockchain. We have verified our code using established security services."
        }
      },
      {
        "@type": "Question",
        "name": "How can I verify for myself that you can't steal my money?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Want to verify our code yourself? Copy the verified contract from the blockchain explorer and paste it into tools like MythX, ask ChatGPT 'can the admin steal funds from this contract?', or have any Solidity developer review it. We've used SolidityScan to audit our contracts - you can too. It'll ask you to select a blockchain (we are on Base) and then paste in a contract address. It'll give you a full audit report with a score of 94%: 'Great'."
        }
      },
      {
        "@type": "Question",
        "name": "Is your code open source so I can review it myself?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! The entire Conduit UCPI platform is open source and available at github.com/conduit-ucpi. This includes our smart contracts, backend services, and frontend applications. You can review every line of code, see our development history, and verify that the deployed contracts match the published source code. This transparency is core to our commitment to trustless, secure transactions."
        }
      },
      {
        "@type": "Question",
        "name": "Is there any reputation tracking or feedback system?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. This system exists to eliminate the need for trust in transactions because both parties are protected - no more 'pay and hope.'"
        }
      },
      // Support and Documentation
      {
        "@type": "Question",
        "name": "What if I need help with technical issues that aren't disputes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Technical support is available by emailing info@conduit-ucpi.com"
        }
      },
      {
        "@type": "Question",
        "name": "Can I get proper receipts/invoices for business transactions?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "That sounds like a great enhancement. Email us at info@conduit-ucpi.com to discuss your needs."
        }
      },
      {
        "@type": "Question",
        "name": "What if my payment gets stuck and doesn't make it to the contract?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The system reads contract status directly from the blockchain where funds are held. Our contract code makes it impossible for a transaction to go from 'funds-deposited' back to 'awaiting payment.'"
        }
      },
      {
        "@type": "Question",
        "name": "What about time-sensitive purchases like concert tickets?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "This system is ideal for time-sensitive purchases. You can set the expiry date when making the buyer/seller agreement to ensure delivery by your required date."
        }
      },
      {
        "@type": "Question",
        "name": "What if I accidentally send money to the wrong contract or enter the wrong amount?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You're not stuck with mistakes - raise a dispute immediately with a comment explaining the error and request 100% refund. When the other party sees your explanation and agrees to the refund amount, the dispute will automatically resolve and return your funds."
        }
      },
      {
        "@type": "Question",
        "name": "How long should I wait before disputing if I need time to inspect complex items?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "This system provides escrow infrastructure to make transactions trustless. Agreements about inspection periods and acceptance criteria are for buyer and seller to negotiate between themselves."
        }
      },
      // Getting Started
      {
        "@type": "Question",
        "name": "This sounds complicated with crypto and wallets - can you walk me through what I actually need to do?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "1. Get USDC using the instructions on our wallet management screen. 2. Ask your seller to go to our website, authenticate, and click 'request payment' (they enter your email, amount, payout date, description). 3. You get an email, log in to see the pending payment, check details and accept. That's it!"
        }
      },
      {
        "@type": "Question",
        "name": "What is USDC and why can't I just pay with regular money?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "USDC is a stablecoin cryptocurrency that's always 1:1 with USD. You need it to use blockchain smart contracts that make this service possible - giving you mathematical guarantees about payment protection that regular payment systems can't provide."
        }
      },
      {
        "@type": "Question",
        "name": "I'm nervous about using cryptocurrency - isn't this risky and complicated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You've been using electronic money for decades - your bank balance is just numbers in a computer, not physical cash. USDC works the same way, except it runs on public infrastructure instead of private bank systems. The main practical differences: 1) You can verify transactions yourself on the blockchain, 2) No one can freeze or reverse your payments without your consent, 3) It works 24/7 globally without bank business hours or international transfer delays. The 'crypto' part is just the technology that makes these guarantees possible - you don't need to understand blockchain any more than you need to understand SWIFT networks to use regular bank transfers."
        }
      },
      {
        "@type": "Question",
        "name": "How do I authenticate - is this another username/password account?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Authentication is simple: either choose your Google account or enter your email address and receive a 6-digit code to enter on screen."
        }
      },
      {
        "@type": "Question",
        "name": "What does it cost to get USDC?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We don't control crypto exchanges, so costs depend on which exchange you use and their terms. If you find this service useful, consider keeping some money in USDC for future transactions."
        }
      },
      {
        "@type": "Question",
        "name": "What if I make a mistake during setup?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "If the seller creates the wrong email, you won't get notifications. Wrong amount? Just ignore it and ask them to create a new request. If you somehow fund the wrong contract, raise a dispute and we'll sort it out."
        }
      },
      // Why Use This
      {
        "@type": "Question",
        "name": "Why not just negotiate directly with the seller instead of using your service?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The key advantage is that sellers don't get the money until you're satisfied, so they're incentivized to resolve any problems. It also protects sellers by showing they're dealing with a buyer who has funds ready."
        }
      },
      {
        "@type": "Question",
        "name": "What's the smallest purchase amount where this makes sense?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Consider the exchange fees to get USDC plus our 1% transaction fee. This works well for purchases where you can't meet in person or need extra protection. Also remember: if a seller refuses to use this system for spurious reasons, you probably just avoided a scam."
        }
      },
      {
        "@type": "Question",
        "name": "Is this mainly for crypto-savvy people or can regular consumers use it?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It's designed for regular people. The biggest friction is getting USDC initially - we're working on easier onramps. If you can copy and paste addresses, you should be fine. Try our free $0.001 test option to see how it works risk-free."
        }
      },
      {
        "@type": "Question",
        "name": "Can I use this for purchases from other cities or countries?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! This enables safe transactions with sellers anywhere, since you're protected regardless of geographic location. You're not limited to local sellers you can meet in person."
        }
      },
      // System Reliability
      {
        "@type": "Question",
        "name": "What if your website crashes or there are technical problems?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The system runs on Google Cloud with automated deployment and is built by experienced engineers (ex-Skyscanner principals with 50+ years combined experience). Most importantly, your transactions exist on the blockchain independently of our servers - you own them and could theoretically use other tools to access them if needed."
        }
      },
      // Merchant Getting Started
      {
        "@type": "Question",
        "name": "What do I need to start accepting payments as a merchant?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "An email address. That's it. No application, no bank statements, no business plan, no waiting period. You can process your first transaction in under 10 minutes."
        }
      },
      {
        "@type": "Question",
        "name": "Why is there no approval process?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Traditional processors take custody of your money, so they need to assess your risk. We never touch your funds — they go from buyer to smart contract to you. No custody means no underwriting."
        }
      },
      {
        "@type": "Question",
        "name": "Why is there no credit check or business verification?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Processors who hold funds need to know you won't disappear owing them money. We can't be left holding the bag because we never hold anything."
        }
      },
      {
        "@type": "Question",
        "name": "Why no reserve requirements?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Reserves exist so processors can cover chargebacks if you can't. Our system doesn't have chargebacks — disputes are resolved before funds leave escrow. Nothing to reserve against."
        }
      },
      {
        "@type": "Question",
        "name": "Why no monthly minimums or volume requirements?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Those exist to make small merchants worth the processor's underwriting cost. We have no underwriting cost."
        }
      },
      {
        "@type": "Question",
        "name": "What if I sell CBD, supplements, adult content, firearms, or other high-risk categories?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We don't restrict product categories. Traditional processors reject high-risk merchants because they're afraid of chargebacks and regulatory scrutiny. Our system doesn't have chargebacks, and we don't make decisions about your funds, so we don't need to police what you sell."
        }
      },
      {
        "@type": "Question",
        "name": "Can my merchant account be frozen or terminated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We can't freeze funds that aren't in our custody. Your money is either in the escrow contract (where only you and the buyer can claim it) or in your wallet. There's no 'account' to terminate — each transaction is its own contract."
        }
      },
      // Merchant How It Works
      {
        "@type": "Question",
        "name": "What happens when a customer pays me as a merchant?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Funds go into a smart contract (not to you, not to us). At the agreed payout date, funds release to your wallet automatically. If there's a dispute before then, funds stay frozen until you and the buyer agree on a resolution."
        }
      },
      {
        "@type": "Question",
        "name": "How is this different from a chargeback?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Chargebacks: Customer calls their bank, bank takes your money immediately, you pay $15-25 fee regardless of outcome, you have 7-10 days to gather evidence, bank decides, you can lose even with proof, customer has up to 180 days to dispute. This system: Customer raises dispute in the app, funds freeze (but aren't taken from you), you negotiate directly with the customer, when you both agree on a split funds release automatically, no fee, no third party deciding your fate."
        }
      },
      {
        "@type": "Question",
        "name": "What if a buyer disputes in bad faith?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "They can freeze the funds, but they can't get them without your agreement. A buyer who received goods and disputes anyway is stuck — they don't get money back, you don't get paid, until someone blinks. Keep your shipping receipts."
        }
      },
      {
        "@type": "Question",
        "name": "What does my customer see during checkout?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your customer authenticates with email or social login. If they don't have a wallet, one is created automatically — but they still own it (they can export their keys anytime). If they don't have USDC or USDT, we provide links to buy some. They confirm the payment, sign it on their device, done. No wallet setup, no gas fees, no crypto knowledge required."
        }
      },
      // Stablecoin Part
      {
        "@type": "Question",
        "name": "Which stablecoins can customers pay with?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "USDC or USDT. Both are pegged 1:1 to USD. USDT has higher global circulation; USDC has cleaner off-ramp economics via Coinbase."
        }
      },
      {
        "@type": "Question",
        "name": "What if my customer doesn't have USDC or USDT?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The checkout provides links to purchase stablecoins directly. Customers can buy with card or bank transfer through integrated on-ramps."
        }
      },
      {
        "@type": "Question",
        "name": "Do my customers need a crypto wallet?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Customers who don't have a wallet get one created automatically during checkout. They still own it — they can export their private keys anytime. It's their wallet, we just make setup invisible."
        }
      },
      {
        "@type": "Question",
        "name": "What if a customer already has a wallet?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "They can connect it instead. Works either way."
        }
      },
      {
        "@type": "Question",
        "name": "Who pays the blockchain transaction fees?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We do. Gas fees on Base are fractions of a cent, but users would normally need to hold ETH to pay them. We've eliminated that — your customers never need to touch ETH. They pay in USDC or USDT, that's it."
        }
      },
      {
        "@type": "Question",
        "name": "What about price volatility with cryptocurrency?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "USDC and USDT are stablecoins — they're pegged 1:1 to USD. $100 USDC is always worth $100. This isn't Bitcoin."
        }
      },
      {
        "@type": "Question",
        "name": "How do I turn stablecoins into real money?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Coinbase converts USDC to USD at 1:1 with no fee for conversions under $5 million per month. For USDT, most exchanges charge a small fee (typically 0.1-0.5%) or you can swap USDT to USDC first. Either way, your effective cost is close to just the 1% transaction fee."
        }
      },
      {
        "@type": "Question",
        "name": "How do I handle accounting for stablecoin payments?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "USDC and USDT are 1:1 with USD, so the transaction value is straightforward. Each transaction has a blockchain record with timestamp, amount, and addresses. Treat the off-ramp (converting to fiat) as a separate event. Talk to your accountant about crypto income reporting in your jurisdiction."
        }
      },
      {
        "@type": "Question",
        "name": "What about taxes on stablecoin payments?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "In most jurisdictions, receiving stablecoins as payment is treated like receiving USD — it's income at the time of receipt. The off-ramp may have tax implications depending on timing and any value fluctuation. This isn't tax advice; consult a professional."
        }
      },
      // Security and Fraud
      {
        "@type": "Question",
        "name": "Why is fraud lower with stablecoin payments?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Card payments are 'pull' — you hand over credentials that let the merchant's processor extract funds. Stablecoin payments are 'push' — the buyer actively sends funds. There's no shared secret to steal. A fraudster would need access to your customer's wallet, not just a number printed on a piece of plastic. No credentials are exchanged, nothing is stored, nothing can be skimmed or phished."
        }
      },
      {
        "@type": "Question",
        "name": "What does lower fraud mean for me as a merchant?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Card-not-present fraud runs about 0.5% of transaction volume. You pay for that — either directly through losses, or indirectly through processor fees that price in fraud risk. With push payments, that category of fraud doesn't exist. Buyers must have the funds and actively authorize the transaction."
        }
      },
      {
        "@type": "Question",
        "name": "Where does payment security actually happen?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "With stablecoin payments, all security happens on the customer's device at the moment they connect their wallet and sign the transaction. There's no card number to store, no credentials database to breach, no sensitive data flowing through servers. We couldn't leak your customers' payment details if we wanted to — we never have them."
        }
      },
      {
        "@type": "Question",
        "name": "Does this mean I don't need PCI compliance?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "There's no card data, so there's nothing to comply with. No annual audits, no questionnaires, no security requirements for handling data you never touch."
        }
      },
      {
        "@type": "Question",
        "name": "What about fraud protection services?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You don't need them. Push payments from user-owned wallets eliminate the problem at the root. There's no stolen card number to use, no credentials to phish, no processor database to breach. You don't need AI fraud detection, velocity checks, address verification, 3D Secure, or any of it."
        }
      },
      // Regulatory and Custody
      {
        "@type": "Question",
        "name": "Don't escrow services require banking licenses and regulatory approval?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Traditional escrow does, because a third party holds your money. We're not custodial. Funds go directly from the buyer's wallet into a smart contract that both parties own. We never hold, control, or have access to the funds. The contract code determines what happens. Admin can only allocate disputed funds between buyer and seller, never to anyone else."
        }
      },
      {
        "@type": "Question",
        "name": "What about MiCA or money transmission laws?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Regulations like MiCA apply to Crypto-Asset Service Providers who custody funds or act as intermediaries. We're infrastructure. The smart contracts run on a public blockchain. Users interact directly with their own contracts. If our website disappeared tomorrow, your contracts would still execute."
        }
      },
      {
        "@type": "Question",
        "name": "But you resolve disputes — doesn't that make you a custodian?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Dispute resolution means we can allocate funds between buyer and seller when they can't agree. We cannot extract funds to ourselves or any third party. The contract code makes this impossible — not against policy, impossible. Anyone can verify this by reading the verified contract on-chain."
        }
      },
      {
        "@type": "Question",
        "name": "What if a regulator disagrees with your interpretation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Regulatory interpretation varies by jurisdiction. But the architecture is genuinely different from custodial services. If a specific jurisdiction decides non-custodial smart contract infrastructure requires licensing, that's a conversation about that jurisdiction — it doesn't change the technical reality of how the system works."
        }
      },
      {
        "@type": "Question",
        "name": "What if regulations change and you get shut down?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your in-flight transactions still complete. The smart contracts exist on the blockchain, not on our servers. If regulators shut us down tomorrow, every active contract keeps running — funds release at the scheduled time, disputes resolve when parties agree."
        }
      },
      // Trust and Platform Risk
      {
        "@type": "Question",
        "name": "How do I know you won't steal my money as a merchant?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You don't have to trust us. The smart contract code is verified on-chain — anyone can read it. The code proves funds can only go to buyer or seller. Paste it into ChatGPT and ask 'can the admin steal my funds?' The answer is provably no."
        }
      },
      {
        "@type": "Question",
        "name": "What if your company shuts down while I have active transactions?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your in-flight transactions complete automatically — they're smart contracts, not our servers. If we disappeared tomorrow, funds release to you at the scheduled time, or stay frozen in dispute until you and the buyer work it out directly."
        }
      },
      // Comparison to Traditional Processing
      {
        "@type": "Question",
        "name": "What fees am I actually avoiding compared to traditional payment processors?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Interchange fees (~2%), per-transaction fees ($0.25-0.30), chargeback fees ($15-25 per dispute), rolling reserve (20-30% held), monthly minimums, PCI compliance costs, and fraud protection services are all gone. You pay 1% transaction fee and that's it."
        }
      },
      {
        "@type": "Question",
        "name": "What's the catch with this payment system?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your customers need USDC or USDT. That's the real barrier. We've reduced the friction (auto-wallets, on-ramp links, gas-free transactions), but if your customers don't have stablecoins and won't get them, this doesn't help you."
        }
      },
      {
        "@type": "Question",
        "name": "Why wouldn't I just keep using Stripe or traditional processors?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "If Stripe works for you, keep using it. This is for merchants who: sell in high-risk categories that get rejected or shut down, have been burned by account freezes or fund holds, want to reach crypto holders, want a backup payment channel that can't be frozen, or are tired of chargeback economics."
        }
      },
      {
        "@type": "Question",
        "name": "Can I test the merchant payment system first?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Create a test transaction for $0.001 — the fee is waived so you can see how it works risk-free."
        }
      }
    ]
  };

  return (
    <>
      <SEO
        title="FAQ - Crypto Escrow Questions Answered | Conduit Escrow"
        description="Get answers to all your questions about crypto escrow, USDC payments, disputes, security, merchant payment processing, chargebacks, PCI compliance, and how our blockchain escrow system protects buyers and sellers."
        keywords="crypto escrow faq, blockchain escrow questions, USDC payment help, escrow dispute resolution, smart contract security, crypto payment protection, merchant payments, stablecoin payments, no chargebacks, PCI compliance free, high-risk merchant, escrow how it works"
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
                        We've used <a href="https://solidityscan.com/quickscan" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">SolidityScan</a> to audit our contracts - you can too. It'll ask you to select a blockchain (we are on Base) and then paste in a contract address. It'll give you a full audit report with a score of 94%: 'Great'.
                        {config?.contractAddress && (
                          <>
                            <br /><br />
                            <strong>Contract Implementation Address:</strong>
                            <br />
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm break-all">
                              {config.contractAddress}
                            </code>
                            <br />
                            <span className="text-sm text-gray-500">
                              You can use this address to verify our smart contract code on SolidityScan or any blockchain explorer.
                            </span>
                          </>
                        )}
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Is your code open source so I can review it myself?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Yes! The entire Conduit UCPI platform is open source and available at <a href="https://github.com/conduit-ucpi" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">github.com/conduit-ucpi</a>. This includes our smart contracts, backend services, and frontend applications. You can review every line of code, see our development history, and verify that the deployed contracts match the published source code. This transparency is core to our commitment to trustless, secure transactions.
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

                {/* Merchant Getting Started */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">For Merchants - Getting Started</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What do I need to start accepting payments as a merchant?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        An email address. That's it. No application, no bank statements, no business plan, no waiting period. You can process your first transaction in under 10 minutes.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Why is there no approval process?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Traditional processors take custody of your money, so they need to assess your risk. We never touch your funds — they go from buyer to smart contract to you. No custody means no underwriting.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Why is there no credit check or business verification?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Processors who hold funds need to know you won't disappear owing them money. We can't be left holding the bag because we never hold anything.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Why no reserve requirements?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Reserves exist so processors can cover chargebacks if you can't. Our system doesn't have chargebacks — disputes are resolved before funds leave escrow. Nothing to reserve against.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Why no monthly minimums or volume requirements?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Those exist to make small merchants worth the processor's underwriting cost. We have no underwriting cost.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if I sell CBD, supplements, adult content, firearms, or other high-risk categories?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        We don't restrict product categories. Traditional processors reject high-risk merchants because they're afraid of chargebacks and regulatory scrutiny. Our system doesn't have chargebacks, and we don't make decisions about your funds, so we don't need to police what you sell.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Can my merchant account be frozen or terminated?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        We can't freeze funds that aren't in our custody. Your money is either in the escrow contract (where only you and the buyer can claim it) or in your wallet. There's no "account" to terminate — each transaction is its own contract.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Merchant How It Works */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">For Merchants - How It Works</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What happens when a customer pays me as a merchant?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Funds go into a smart contract (not to you, not to us). At the agreed payout date, funds release to your wallet automatically. If there's a dispute before then, funds stay frozen until you and the buyer agree on a resolution.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How is this different from a chargeback?
                      </h3>
                      <div className="text-gray-600 leading-relaxed space-y-2">
                        <p className="font-medium">Chargebacks:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Customer calls their bank</li>
                          <li>Bank takes your money immediately</li>
                          <li>You pay $15-25 fee regardless of outcome</li>
                          <li>You have 7-10 days to gather evidence</li>
                          <li>Bank decides</li>
                          <li>You can lose even with proof</li>
                          <li>Customer has up to 180 days to dispute</li>
                        </ul>
                        <p className="font-medium pt-3">This system:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Customer raises dispute in the app</li>
                          <li>Funds freeze (but aren't taken from you)</li>
                          <li>You negotiate directly with the customer</li>
                          <li>When you both agree on a split, funds release automatically</li>
                          <li>No fee</li>
                          <li>No third party deciding your fate</li>
                        </ul>
                      </div>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if a buyer disputes in bad faith?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        They can freeze the funds, but they can't get them without your agreement. A buyer who received goods and disputes anyway is stuck — they don't get money back, you don't get paid, until someone blinks. Keep your shipping receipts.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What does my customer see during checkout?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Your customer authenticates with email or social login. If they don't have a wallet, one is created automatically — but they still own it (they can export their keys anytime). If they don't have USDC or USDT, we provide links to buy some. They confirm the payment, sign it on their device, done. No wallet setup, no gas fees, no crypto knowledge required.
                      </p>
                    </article>
                  </div>
                </section>

                {/* The Stablecoin Part */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Understanding Stablecoins</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Which stablecoins can customers pay with?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        USDC or USDT. Both are pegged 1:1 to USD. USDT has higher global circulation; USDC has cleaner off-ramp economics via Coinbase.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if my customer doesn't have USDC or USDT?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        The checkout provides links to purchase stablecoins directly. Customers can buy with card or bank transfer through integrated on-ramps.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Do my customers need a crypto wallet?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        No. Customers who don't have a wallet get one created automatically during checkout. They still own it — they can export their private keys anytime. It's their wallet, we just make setup invisible.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if a customer already has a wallet?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        They can connect it instead. Works either way.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Who pays the blockchain transaction fees?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        We do. Gas fees on Base are fractions of a cent, but users would normally need to hold ETH to pay them. We've eliminated that — your customers never need to touch ETH. They pay in USDC or USDT, that's it.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What about price volatility with cryptocurrency?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        USDC and USDT are stablecoins — they're pegged 1:1 to USD. $100 USDC is always worth $100. This isn't Bitcoin.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How do I turn stablecoins into real money?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Coinbase converts USDC to USD at 1:1 with no fee for conversions under $5 million per month. For USDT, most exchanges charge a small fee (typically 0.1-0.5%) or you can swap USDT to USDC first. Either way, your effective cost is close to just the 1% transaction fee.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How do I handle accounting for stablecoin payments?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        USDC and USDT are 1:1 with USD, so the transaction value is straightforward. Each transaction has a blockchain record with timestamp, amount, and addresses. Treat the off-ramp (converting to fiat) as a separate event. Talk to your accountant about crypto income reporting in your jurisdiction.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What about taxes on stablecoin payments?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        In most jurisdictions, receiving stablecoins as payment is treated like receiving USD — it's income at the time of receipt. The off-ramp may have tax implications depending on timing and any value fluctuation. This isn't tax advice; consult a professional.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Security and Fraud */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Security and Fraud Protection</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Why is fraud lower with stablecoin payments?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Card payments are "pull" — you hand over credentials that let the merchant's processor extract funds. Stablecoin payments are "push" — the buyer actively sends funds. There's no shared secret to steal. A fraudster would need access to your customer's wallet, not just a number printed on a piece of plastic. No credentials are exchanged, nothing is stored, nothing can be skimmed or phished.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What does lower fraud mean for me as a merchant?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Card-not-present fraud runs about 0.5% of transaction volume. You pay for that — either directly through losses, or indirectly through processor fees that price in fraud risk. With push payments, that category of fraud doesn't exist. Buyers must have the funds and actively authorize the transaction.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Where does payment security actually happen?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        With stablecoin payments, all security happens on the customer's device at the moment they connect their wallet and sign the transaction. There's no card number to store, no credentials database to breach, no sensitive data flowing through servers. We couldn't leak your customers' payment details if we wanted to — we never have them.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Does this mean I don't need PCI compliance?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        There's no card data, so there's nothing to comply with. No annual audits, no questionnaires, no security requirements for handling data you never touch.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What about fraud protection services?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        You don't need them. Push payments from user-owned wallets eliminate the problem at the root. There's no stolen card number to use, no credentials to phish, no processor database to breach. You don't need AI fraud detection, velocity checks, address verification, 3D Secure, or any of it.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Regulatory and Custody */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Regulatory and Custody</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Don't escrow services require banking licenses and regulatory approval?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Traditional escrow does, because a third party holds your money. We're not custodial. Funds go directly from the buyer's wallet into a smart contract that both parties own. We never hold, control, or have access to the funds. The contract code determines what happens. Admin can only allocate disputed funds between buyer and seller, never to anyone else.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What about MiCA or money transmission laws?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Regulations like MiCA apply to Crypto-Asset Service Providers who custody funds or act as intermediaries. We're infrastructure. The smart contracts run on a public blockchain. Users interact directly with their own contracts. If our website disappeared tomorrow, your contracts would still execute.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        But you resolve disputes — doesn't that make you a custodian?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        No. Dispute resolution means we can allocate funds between buyer and seller when they can't agree. We cannot extract funds to ourselves or any third party. The contract code makes this impossible — not against policy, impossible. Anyone can verify this by reading the verified contract on-chain.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if a regulator disagrees with your interpretation?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Regulatory interpretation varies by jurisdiction. But the architecture is genuinely different from custodial services. If a specific jurisdiction decides non-custodial smart contract infrastructure requires licensing, that's a conversation about that jurisdiction — it doesn't change the technical reality of how the system works.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if regulations change and you get shut down?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Your in-flight transactions still complete. The smart contracts exist on the blockchain, not on our servers. If regulators shut us down tomorrow, every active contract keeps running — funds release at the scheduled time, disputes resolve when parties agree.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Trust and Platform Risk */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Trust and Platform Risk</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        How do I know you won't steal my money as a merchant?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        You don't have to trust us. The smart contract code is verified on-chain — anyone can read it. The code proves funds can only go to buyer or seller. Paste it into ChatGPT and ask "can the admin steal my funds?" The answer is provably no.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What if your company shuts down while I have active transactions?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Your in-flight transactions complete automatically — they're smart contracts, not our servers. If we disappeared tomorrow, funds release to you at the scheduled time, or stay frozen in dispute until you and the buyer work it out directly.
                      </p>
                    </article>
                  </div>
                </section>

                {/* Comparison to Traditional Processing */}
                <section>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Comparison to Traditional Payment Processing</h2>
                  <div className="space-y-4">
                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What fees am I actually avoiding compared to traditional payment processors?
                      </h3>
                      <div className="text-gray-600 leading-relaxed">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Interchange fees (~2%): Gone</li>
                          <li>Per-transaction fees ($0.25-0.30): Gone</li>
                          <li>Chargeback fees ($15-25 per dispute): Gone</li>
                          <li>Rolling reserve (20-30% held): Gone</li>
                          <li>Monthly minimums: Gone</li>
                          <li>PCI compliance costs: Gone</li>
                          <li>Fraud protection services: Gone</li>
                        </ul>
                      </div>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        What's the catch with this payment system?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Your customers need USDC or USDT. That's the real barrier. We've reduced the friction (auto-wallets, on-ramp links, gas-free transactions), but if your customers don't have stablecoins and won't get them, this doesn't help you.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Why wouldn't I just keep using Stripe or traditional processors?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        If Stripe works for you, keep using it. This is for merchants who: sell in high-risk categories that get rejected or shut down, have been burned by account freezes or fund holds, want to reach crypto holders, want a backup payment channel that can't be frozen, or are tired of chargeback economics.
                      </p>
                    </article>

                    <article className="bg-white rounded-lg shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Can I test the merchant payment system first?
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Yes. Create a test transaction for $0.001 — the fee is waived so you can see how it works risk-free.
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
