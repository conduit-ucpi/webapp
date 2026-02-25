import React, { useState, ReactNode } from 'react';
import SEO from '@/components/SEO'
import Link from 'next/link'
import Head from 'next/head'
import { GetStaticProps } from 'next'
import { useConfig } from '@/components/auth/ConfigProvider'
import { motion, AnimatePresence } from 'framer-motion';
import Fade from '@/components/ui/Fade';

// ---------------------------------------------------------------------------
// Collapsible FAQ item — question as clickable heading, answer toggles
// ---------------------------------------------------------------------------

function FAQItem({
  question,
  children,
  defaultOpen = false,
}: {
  question: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left group cursor-pointer flex items-start justify-between gap-4 py-4"
      >
        <h3 className="text-sm font-medium text-secondary-900 dark:text-white leading-relaxed">
          {question}
        </h3>
        <span className="mt-0.5 flex-shrink-0 text-secondary-400 dark:text-secondary-500 transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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
        <section className="flex items-center" aria-label="Hero">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-10 lg:pb-12 w-full">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-10">
                FAQ
              </p>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl"
              >
                Frequently asked questions.
              </h1>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* BASIC FUNCTIONALITY                                              */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Basic Functionality"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Basic Functionality
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                How the escrow system works.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What happens if the seller never delivers my item - do I actually get my money back?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Yes. If the seller doesn&apos;t deliver, you raise a dispute before the payout date by entering a comment explaining the issue and suggesting a refund amount. This immediately freezes the funds. The seller is notified by email and can respond with their own comments and refund suggestion through the dashboard. When both parties agree on the same refund amount, the dispute automatically resolves and pays out accordingly. If you can&apos;t agree, the funds remain frozen until you reach an agreement.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="How do I know the admin team won't just steal my money?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The smart contract code is verified and published on the blockchain. You can see that only the seller or admin can claim funds, and the admin can only allocate disputed funds to either the buyer or seller - never to themselves. The code prevents theft. Additionally, our auto-arbitration system means disputes can resolve automatically when both parties agree, without admin intervention.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="Who exactly makes dispute decisions and what are their qualifications?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Disputes use our auto-arbitration system. When you raise a dispute, you suggest a refund amount and explain your position. The other party can respond with their suggestion. You can both see the history of comments and suggestions in your dashboard. When you both enter the same refund amount, the dispute automatically resolves and distributes the funds accordingly. Full details at <Link href="/arbitration-policy" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline">our arbitration policy page</Link>.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* TIMING AND PROCESS                                               */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Timing and Process"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Timing and Process
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Timelines and cancellation.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="How long do I have to receive my item before money goes to the seller?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The seller sets an expiry date when creating the contract, and you agree to it before funding. If you don&apos;t like the timeframe, ask them to create a new contract with a different expiry date. You control what you agree to.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="Can I cancel if I made a mistake or change my mind?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Once you&apos;ve funded a contract, you can raise a dispute with a refund request. Enter your reason and suggest 100% refund if you made a mistake. The seller will be notified and can agree to your refund amount, allowing automatic resolution. This protects sellers who may have already shipped goods while giving buyers a path to resolution.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="What if I want to cancel before the buyer has put money in?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    This feature is on our development list. Currently, just tell the buyer the contract is invalid - they&apos;d be foolish to fund it after you&apos;ve said that.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* TECHNICAL ISSUES                                                 */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Technical Issues"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Technical Issues
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Platform reliability and edge cases.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What if the seller loses access to their email or wallet?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    If someone&apos;s account is compromised, raise a dispute to prevent funds from being accessed by malicious parties.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What happens if your website goes down or your company shuts down?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    All contracts will continue to run their course since they&apos;re on the blockchain. We use Google Cloud for extremely reliable hosting. Our policy is to resolve any outstanding disputes before any potential shutdown.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="What if there's a dispute after your company is gone?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    All outstanding disputes would be resolved before any shutdown. The contracts technically belong to the buyer - our service just makes it easy to create and administer programmable money.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* COSTS AND PAYMENTS                                               */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Costs and Payments"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Costs and Payments
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Fees and payment options.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What does this actually cost me?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Our service charges a 1% transaction fee. The system works in USDC, and we provide tools to obtain USDC if needed, but we have no control over third-party conversion costs in your location. All blockchain gas fees are covered by us - the service is gasless for users.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What if I want to make partial payments or installments?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Currently, you would create multiple separate contracts for different payment stages.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* DISPUTES AND PROBLEMS                                            */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Disputes and Problems"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Disputes and Problems
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                When things go wrong.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="How long do I have to wait for dispute resolution?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Once in dispute, funds are frozen so you&apos;re protected. Through the &apos;Manage Dispute&apos; feature in your dashboard, you and the seller can exchange comments and refund proposals. The dispute automatically resolves as soon as you both agree on the same refund amount. There&apos;s no fixed timeline - resolution happens instantly when you reach agreement.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What stops people from creating fake contracts to scam others?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    If someone turns out to be a scammer and your goods don&apos;t arrive, you can dispute at any point up until the expiry date and get your money back for non-delivery.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="What if someone disputes in bad faith to get free stuff?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Sellers should keep evidence of packing and sending. When disputes are raised, investigation with courier companies will reveal the truth about delivery.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="What if the item arrives but is completely different from what was described?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The system provides trustless payment infrastructure. It&apos;s between buyer and seller to agree whether an item is &quot;as described&quot; and what the resolution should be. A common resolution is for the seller to accept returned goods and refund the buyer once the item is back with the seller.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="What if I need to dispute but it's outside business hours?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Once in dispute, funds are frozen so you&apos;re safe. You can manage the dispute through your dashboard at any time - view the history of comments and refund suggestions, and add your own. The system works 24/7, and disputes auto-resolve the moment both parties agree on a refund amount.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.25}>
                <FAQItem question="What if the seller goes silent after I pay but before expiry?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    You can dispute at any time before expiry by clicking &apos;Raise Dispute&apos; in your dashboard. Enter a comment explaining the lack of communication and suggest a full refund. The seller will be notified and can respond through their dashboard. If they agree to your refund amount, the dispute resolves automatically.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* INTERNATIONAL AND LEGAL ISSUES                                   */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="International and Legal Issues"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                International and Legal Issues
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Cross-border transactions and legal questions.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What about international transactions and different countries' laws?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    This is an escrow money transfer service, not an arbitration service. Legal arbitration is between buyer and seller. Once resolution has been agreed (with or without legal involvement), funds are allocated according to that agreement.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What if expensive items need legal arbitration?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The contracts are technically owned by the buyer. If buyer and seller can&apos;t reach agreement, legal arbitration between them is their responsibility. The conclusion of that process informs our admin team how to allocate disputed funds.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PRIVACY AND SECURITY                                             */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Privacy and Security"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Privacy and Security
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Data, code audits, and transparency.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What information do you store about me?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Our privacy policy is at <Link href="/privacy-policy" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline">our privacy policy page</Link>. On the public blockchain: amount, buyer wallet ID, seller wallet ID, expiry date, and description. We store email addresses on secured servers as they&apos;re necessary to provide the service, but this data is not part of any public interface.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What if there's a bug in the smart contract code?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Every contract uses the same verified code available on the blockchain. We have verified our code using established security services.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="How can I verify for myself that you can't steal my money?">
                  <div className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed space-y-3">
                    <p>
                      Want to verify our code yourself? Copy the verified contract from the blockchain explorer and paste it into tools like MythX, ask ChatGPT &quot;can the admin steal funds from this contract?&quot;, or have any Solidity developer review it. The code is extensively commented to make admin limitations clear.
                    </p>
                    <p>
                      We&apos;ve used <a href="https://solidityscan.com/quickscan" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline">SolidityScan</a> to audit our contracts - you can too. It&apos;ll ask you to select a blockchain (we are on Base) and then paste in a contract address. It&apos;ll give you a full audit report with a score of 94%: &apos;Great&apos;.
                    </p>
                    {config?.contractAddress && (
                      <div>
                        <p className="font-medium text-secondary-900 dark:text-white">Contract Implementation Address:</p>
                        <code className="block mt-1 bg-secondary-100 dark:bg-secondary-800 px-3 py-2 rounded text-sm break-all text-secondary-700 dark:text-secondary-300">
                          {config.contractAddress}
                        </code>
                        <p className="mt-1 text-xs text-secondary-400 dark:text-secondary-500">
                          You can use this address to verify our smart contract code on SolidityScan or any blockchain explorer.
                        </p>
                      </div>
                    )}
                  </div>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="Is your code open source so I can review it myself?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Yes! The entire Conduit UCPI platform is open source and available at <a href="https://github.com/conduit-ucpi" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline">github.com/conduit-ucpi</a>. This includes our smart contracts, backend services, and frontend applications. You can review every line of code, see our development history, and verify that the deployed contracts match the published source code. This transparency is core to our commitment to trustless, secure transactions.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="Is there any reputation tracking or feedback system?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    No. This system exists to eliminate the need for trust in transactions because both parties are protected - no more &quot;pay and hope.&quot;
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SUPPORT AND DOCUMENTATION                                        */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Support and Documentation"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Support and Documentation
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Help and practical guidance.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What if I need help with technical issues that aren't disputes?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Technical support is available by emailing <a href="mailto:info@conduit-ucpi.com" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline">info@conduit-ucpi.com</a>
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="Can I get proper receipts/invoices for business transactions?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    That sounds like a great enhancement. Email us at <a href="mailto:info@conduit-ucpi.com" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline">info@conduit-ucpi.com</a> to discuss your needs.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="What if my payment gets stuck and doesn't make it to the contract?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The system reads contract status directly from the blockchain where funds are held. Our contract code makes it impossible for a transaction to go from &quot;funds-deposited&quot; back to &quot;awaiting payment.&quot;
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="What about time-sensitive purchases like concert tickets?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    This system is ideal for time-sensitive purchases. You can set the expiry date when making the buyer/seller agreement to ensure delivery by your required date.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="What if I accidentally send money to the wrong contract or enter the wrong amount?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    You&apos;re not stuck with mistakes - raise a dispute immediately with a comment explaining the error and request 100% refund. When the other party sees your explanation and agrees to the refund amount, the dispute will automatically resolve and return your funds.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.25}>
                <FAQItem question="How long should I wait before disputing if I need time to inspect complex items?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    This system provides escrow infrastructure to make transactions trustless. Agreements about inspection periods and acceptance criteria are for buyer and seller to negotiate between themselves.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* GETTING STARTED                                                  */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Getting Started"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Getting Started
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Your first transaction.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="This sounds complicated with crypto and wallets - can you walk me through what I actually need to do?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    1. Get USDC using the instructions on our wallet management screen. 2. Ask your seller to go to our website, authenticate, and click &apos;request payment&apos; (they enter your email, amount, payout date, description). 3. You get an email, log in to see the pending payment, check details and accept. That&apos;s it!
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What is USDC and why can't I just pay with regular money?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    USDC is a stablecoin cryptocurrency that&apos;s always 1:1 with USD. You need it to use blockchain smart contracts that make this service possible - giving you mathematical guarantees about payment protection that regular payment systems can&apos;t provide.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="I'm nervous about using cryptocurrency - isn't this risky and complicated?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    You&apos;ve been using electronic money for decades - your bank balance is just numbers in a computer, not physical cash. USDC works the same way, except it runs on public infrastructure instead of private bank systems. The main practical differences: 1) You can verify transactions yourself on the blockchain, 2) No one can freeze or reverse your payments without your consent, 3) It works 24/7 globally without bank business hours or international transfer delays. The &quot;crypto&quot; part is just the technology that makes these guarantees possible - you don&apos;t need to understand blockchain any more than you need to understand SWIFT networks to use regular bank transfers.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="How do I authenticate - is this another username/password account?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Authentication is simple: either choose your Google account or enter your email address and receive a 6-digit code to enter on screen.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="What does it cost to get USDC?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    We don&apos;t control crypto exchanges, so costs depend on which exchange you use and their terms. If you find this service useful, consider keeping some money in USDC for future transactions.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.25}>
                <FAQItem question="What if I make a mistake during setup?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    If the seller creates the wrong email, you won&apos;t get notifications. Wrong amount? Just ignore it and ask them to create a new request. If you somehow fund the wrong contract, raise a dispute and we&apos;ll sort it out.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* WHY USE THIS                                                     */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Why Use This"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Why Use This
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Is this right for you?
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="Why not just negotiate directly with the seller instead of using your service?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The key advantage is that sellers don&apos;t get the money until you&apos;re satisfied, so they&apos;re incentivized to resolve any problems. It also protects sellers by showing they&apos;re dealing with a buyer who has funds ready.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What's the smallest purchase amount where this makes sense?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Consider the exchange fees to get USDC plus our 1% transaction fee. This works well for purchases where you can&apos;t meet in person or need extra protection. Also remember: if a seller refuses to use this system for spurious reasons, you probably just avoided a scam.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="Is this mainly for crypto-savvy people or can regular consumers use it?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    It&apos;s designed for regular people. The biggest friction is getting USDC initially - we&apos;re working on easier onramps. If you can copy and paste addresses, you should be fine. Try our free $0.001 test option to see how it works risk-free.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="Can I use this for purchases from other cities or countries?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Yes! This enables safe transactions with sellers anywhere, since you&apos;re protected regardless of geographic location. You&apos;re not limited to local sellers you can meet in person.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SYSTEM RELIABILITY                                               */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="System Reliability"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                System Reliability
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Uptime and infrastructure.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What if your website crashes or there are technical problems?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The system runs on Google Cloud with automated deployment and is built by experienced engineers (ex-Skyscanner principals with 50+ years combined experience). Most importantly, your transactions exist on the blockchain independently of our servers - you own them and could theoretically use other tools to access them if needed.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOR MERCHANTS - GETTING STARTED                                  */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="For Merchants - Getting Started"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                For Merchants - Getting Started
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Start accepting payments in minutes.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What do I need to start accepting payments as a merchant?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    An email address. That&apos;s it. No application, no bank statements, no business plan, no waiting period. You can process your first transaction in under 10 minutes.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="Why is there no approval process?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Traditional processors take custody of your money, so they need to assess your risk. We never touch your funds — they go from buyer to smart contract to you. No custody means no underwriting.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="Why is there no credit check or business verification?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Processors who hold funds need to know you won&apos;t disappear owing them money. We can&apos;t be left holding the bag because we never hold anything.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="Why no reserve requirements?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Reserves exist so processors can cover chargebacks if you can&apos;t. Our system doesn&apos;t have chargebacks — disputes are resolved before funds leave escrow. Nothing to reserve against.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="Why no monthly minimums or volume requirements?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Those exist to make small merchants worth the processor&apos;s underwriting cost. We have no underwriting cost.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.25}>
                <FAQItem question="What if I sell CBD, supplements, adult content, firearms, or other high-risk categories?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    We don&apos;t restrict product categories. Traditional processors reject high-risk merchants because they&apos;re afraid of chargebacks and regulatory scrutiny. Our system doesn&apos;t have chargebacks, and we don&apos;t make decisions about your funds, so we don&apos;t need to police what you sell.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.3}>
                <FAQItem question="Can my merchant account be frozen or terminated?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    We can&apos;t freeze funds that aren&apos;t in our custody. Your money is either in the escrow contract (where only you and the buyer can claim it) or in your wallet. There&apos;s no &quot;account&quot; to terminate — each transaction is its own contract.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOR MERCHANTS - HOW IT WORKS                                     */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="For Merchants - How It Works"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                For Merchants - How It Works
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Payments, disputes, and chargebacks.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What happens when a customer pays me as a merchant?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Funds go into a smart contract (not to you, not to us). At the agreed payout date, funds release to your wallet automatically. If there&apos;s a dispute before then, funds stay frozen until you and the buyer agree on a resolution.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="How is this different from a chargeback?">
                  <div className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed space-y-3">
                    <p className="font-medium text-secondary-900 dark:text-white">Chargebacks:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Customer calls their bank</li>
                      <li>Bank takes your money immediately</li>
                      <li>You pay $15-25 fee regardless of outcome</li>
                      <li>You have 7-10 days to gather evidence</li>
                      <li>Bank decides</li>
                      <li>You can lose even with proof</li>
                      <li>Customer has up to 180 days to dispute</li>
                    </ul>
                    <p className="font-medium text-secondary-900 dark:text-white pt-2">This system:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Customer raises dispute in the app</li>
                      <li>Funds freeze (but aren&apos;t taken from you)</li>
                      <li>You negotiate directly with the customer</li>
                      <li>When you both agree on a split, funds release automatically</li>
                      <li>No fee</li>
                      <li>No third party deciding your fate</li>
                    </ul>
                  </div>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="What if a buyer disputes in bad faith?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    They can freeze the funds, but they can&apos;t get them without your agreement. A buyer who received goods and disputes anyway is stuck — they don&apos;t get money back, you don&apos;t get paid, until someone blinks. Keep your shipping receipts.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="What does my customer see during checkout?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Your customer authenticates with email or social login. If they don&apos;t have a wallet, one is created automatically — but they still own it (they can export their keys anytime). If they don&apos;t have USDC or USDT, we provide links to buy some. They confirm the payment, sign it on their device, done. No wallet setup, no gas fees, no crypto knowledge required.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* UNDERSTANDING STABLECOINS                                        */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Understanding Stablecoins"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Understanding Stablecoins
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                USDC, USDT, and off-ramping.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="Which stablecoins can customers pay with?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    USDC or USDT. Both are pegged 1:1 to USD. USDT has higher global circulation; USDC has cleaner off-ramp economics via Coinbase.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What if my customer doesn't have USDC or USDT?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    The checkout provides links to purchase stablecoins directly. Customers can buy with card or bank transfer through integrated on-ramps.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="Do my customers need a crypto wallet?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    No. Customers who don&apos;t have a wallet get one created automatically during checkout. They still own it — they can export their private keys anytime. It&apos;s their wallet, we just make setup invisible.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="What if a customer already has a wallet?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    They can connect it instead. Works either way.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="Who pays the blockchain transaction fees?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    We do. Gas fees on Base are fractions of a cent, but users would normally need to hold ETH to pay them. We&apos;ve eliminated that — your customers never need to touch ETH. They pay in USDC or USDT, that&apos;s it.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.25}>
                <FAQItem question="What about price volatility with cryptocurrency?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    USDC and USDT are stablecoins — they&apos;re pegged 1:1 to USD. $100 USDC is always worth $100. This isn&apos;t Bitcoin.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.3}>
                <FAQItem question="How do I turn stablecoins into real money?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Coinbase converts USDC to USD at 1:1 with no fee for conversions under $5 million per month. For USDT, most exchanges charge a small fee (typically 0.1-0.5%) or you can swap USDT to USDC first. Either way, your effective cost is close to just the 1% transaction fee.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.35}>
                <FAQItem question="How do I handle accounting for stablecoin payments?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    USDC and USDT are 1:1 with USD, so the transaction value is straightforward. Each transaction has a blockchain record with timestamp, amount, and addresses. Treat the off-ramp (converting to fiat) as a separate event. Talk to your accountant about crypto income reporting in your jurisdiction.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.4}>
                <FAQItem question="What about taxes on stablecoin payments?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    In most jurisdictions, receiving stablecoins as payment is treated like receiving USD — it&apos;s income at the time of receipt. The off-ramp may have tax implications depending on timing and any value fluctuation. This isn&apos;t tax advice; consult a professional.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SECURITY AND FRAUD PROTECTION                                    */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Security and Fraud Protection"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Security and Fraud Protection
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Push payments eliminate fraud at the root.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="Why is fraud lower with stablecoin payments?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Card payments are &quot;pull&quot; — you hand over credentials that let the merchant&apos;s processor extract funds. Stablecoin payments are &quot;push&quot; — the buyer actively sends funds. There&apos;s no shared secret to steal. A fraudster would need access to your customer&apos;s wallet, not just a number printed on a piece of plastic. No credentials are exchanged, nothing is stored, nothing can be skimmed or phished.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What does lower fraud mean for me as a merchant?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Card-not-present fraud runs about 0.5% of transaction volume. You pay for that — either directly through losses, or indirectly through processor fees that price in fraud risk. With push payments, that category of fraud doesn&apos;t exist. Buyers must have the funds and actively authorize the transaction.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="Where does payment security actually happen?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    With stablecoin payments, all security happens on the customer&apos;s device at the moment they connect their wallet and sign the transaction. There&apos;s no card number to store, no credentials database to breach, no sensitive data flowing through servers. We couldn&apos;t leak your customers&apos; payment details if we wanted to — we never have them.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="Does this mean I don't need PCI compliance?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    There&apos;s no card data, so there&apos;s nothing to comply with. No annual audits, no questionnaires, no security requirements for handling data you never touch.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="What about fraud protection services?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    You don&apos;t need them. Push payments from user-owned wallets eliminate the problem at the root. There&apos;s no stolen card number to use, no credentials to phish, no processor database to breach. You don&apos;t need AI fraud detection, velocity checks, address verification, 3D Secure, or any of it.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* REGULATORY AND CUSTODY                                           */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Regulatory and Custody"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Regulatory and Custody
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Non-custodial by design.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="Don't escrow services require banking licenses and regulatory approval?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Traditional escrow does, because a third party holds your money. We&apos;re not custodial. Funds go directly from the buyer&apos;s wallet into a smart contract that both parties own. We never hold, control, or have access to the funds. The contract code determines what happens. Admin can only allocate disputed funds between buyer and seller, never to anyone else.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What about MiCA or money transmission laws?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Regulations like MiCA apply to Crypto-Asset Service Providers who custody funds or act as intermediaries. We&apos;re infrastructure. The smart contracts run on a public blockchain. Users interact directly with their own contracts. If our website disappeared tomorrow, your contracts would still execute.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="But you resolve disputes — doesn't that make you a custodian?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    No. Dispute resolution means we can allocate funds between buyer and seller when they can&apos;t agree. We cannot extract funds to ourselves or any third party. The contract code makes this impossible — not against policy, impossible. Anyone can verify this by reading the verified contract on-chain.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="What if a regulator disagrees with your interpretation?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Regulatory interpretation varies by jurisdiction. But the architecture is genuinely different from custodial services. If a specific jurisdiction decides non-custodial smart contract infrastructure requires licensing, that&apos;s a conversation about that jurisdiction — it doesn&apos;t change the technical reality of how the system works.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.2}>
                <FAQItem question="What if regulations change and you get shut down?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Your in-flight transactions still complete. The smart contracts exist on the blockchain, not on our servers. If regulators shut us down tomorrow, every active contract keeps running — funds release at the scheduled time, disputes resolve when parties agree.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* TRUST AND PLATFORM RISK                                          */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Trust and Platform Risk"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Trust and Platform Risk
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Verify, don&apos;t trust.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="How do I know you won't steal my money as a merchant?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    You don&apos;t have to trust us. The smart contract code is verified on-chain — anyone can read it. The code proves funds can only go to buyer or seller. Paste it into ChatGPT and ask &quot;can the admin steal my funds?&quot; The answer is provably no.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What if your company shuts down while I have active transactions?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Your in-flight transactions complete automatically — they&apos;re smart contracts, not our servers. If we disappeared tomorrow, funds release to you at the scheduled time, or stay frozen in dispute until you and the buyer work it out directly.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* COMPARISON TO TRADITIONAL PAYMENT PROCESSING                     */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Comparison to Traditional Payment Processing"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Comparison to Traditional Payment Processing
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                How this stacks up.
              </h2>
            </Fade>

            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              <Fade>
                <FAQItem question="What fees am I actually avoiding compared to traditional payment processors?">
                  <div className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
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
                </FAQItem>
              </Fade>

              <Fade delay={0.05}>
                <FAQItem question="What's the catch with this payment system?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Your customers need USDC or USDT. That&apos;s the real barrier. We&apos;ve reduced the friction (auto-wallets, on-ramp links, gas-free transactions), but if your customers don&apos;t have stablecoins and won&apos;t get them, this doesn&apos;t help you.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.1}>
                <FAQItem question="Why wouldn't I just keep using Stripe or traditional processors?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    If Stripe works for you, keep using it. This is for merchants who: sell in high-risk categories that get rejected or shut down, have been burned by account freezes or fund holds, want to reach crypto holders, want a backup payment channel that can&apos;t be frozen, or are tired of chargeback economics.
                  </p>
                </FAQItem>
              </Fade>

              <Fade delay={0.15}>
                <FAQItem question="Can I test the merchant payment system first?">
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    Yes. Create a test transaction for $0.001 — the fee is waived so you can see how it works risk-free.
                  </p>
                </FAQItem>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* STILL HAVE QUESTIONS                                             */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Still have questions"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                Need more help?
              </p>
              <h2
                className="text-2xl sm:text-3xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Still have questions?
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                Contact our support team at <a href="mailto:info@conduit-ucpi.com" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline">info@conduit-ucpi.com</a> for additional assistance.
              </p>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOOTER                                                           */}
        {/* ================================================================ */}
        <section className="border-t border-secondary-100 dark:border-secondary-800">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8">
            <Fade>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
                <Link href="/" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  Home
                </Link>
                <a
                  href="mailto:info@conduit-ucpi.com"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  Technical support
                </a>
              </div>
            </Fade>
          </div>
        </section>

      </div>
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
