import type { FaqContent } from './types';

/** The /faq page in English: the source every other language follows. See ./types.ts. */
export const faqEn: FaqContent = {
  seo: {
    title: "FAQ - Protected Payment Questions Answered | Stabledrop",
    description: "Get answers to all your questions about protected payments, USDC payments, disputes, security, merchant payment processing, chargebacks, PCI compliance, and how our protected payments protect buyers and sellers.",
    keywords: "crypto escrow faq, blockchain escrow questions, USDC payment help, escrow dispute resolution, smart contract security, crypto payment protection, merchant payments, stablecoin payments, no chargebacks, PCI compliance free, high-risk merchant, escrow how it works",
  },
  hero: { eyebrow: 'FAQ', heading: 'Frequently asked questions.' },
  sections: [
    {
      id: "basic-functionality",
      eyebrow: "Basic Functionality",
      heading: "How protected payments work.",
      items: [
        {
          id: "what-happens-if-the-seller",
          q: "What happens if the seller never delivers my item - do I actually get my money back?",
          a: "Yes. If the seller doesn't deliver, you raise a dispute before the payout date by entering a comment explaining the issue and suggesting a refund amount. This immediately freezes the funds. The seller is notified by email and can respond with their own comments and refund suggestion through the dashboard. When both parties agree on the same refund amount, the dispute automatically resolves and pays out accordingly. If you can't agree, the funds remain frozen until you reach an agreement.",
        },
        {
          id: "how-do-i-know-the",
          q: "How do I know the admin team won't just steal my money?",
          a: "The smart contract code is verified and published on the blockchain. You can see that only the seller or admin can claim funds, and the admin can only allocate disputed funds to either the buyer or seller - never to themselves. The code prevents theft. Additionally, our dispute management system means disputes can resolve automatically when both parties agree, without admin intervention.",
        },
        {
          id: "who-exactly-makes-dispute-decisions",
          q: "Who exactly makes dispute decisions and what are their qualifications?",
          a: "Disputes use our dispute management system. When you raise a dispute, you suggest a refund amount and explain your position. The other party can respond with their suggestion. You can both see the history of comments and suggestions in your dashboard. When you both enter the same refund amount, the dispute automatically resolves and distributes the funds accordingly. Full details at [our dispute policy page](/dispute-policy).",
        },
      ],
    },
    {
      id: "timing-and-process",
      eyebrow: "Timing and Process",
      heading: "Timelines and cancellation.",
      items: [
        {
          id: "how-long-do-i-have",
          q: "How long do I have to receive my item before money goes to the seller?",
          a: "The seller sets an expiry date when creating the contract, and you agree to it before funding. If you don't like the timeframe, ask them to create a new contract with a different expiry date. You control what you agree to.",
        },
        {
          id: "can-i-cancel-if-i",
          q: "Can I cancel if I made a mistake or change my mind?",
          a: "Once you've funded a contract, you can raise a dispute with a refund request. Enter your reason and suggest 100% refund if you made a mistake. The seller will be notified and can agree to your refund amount, allowing automatic resolution. This protects sellers who may have already shipped goods while giving buyers a path to resolution.",
        },
        {
          id: "what-if-i-want-to",
          q: "What if I want to cancel before the buyer has put money in?",
          a: "This feature is on our development list. Currently, just tell the buyer the contract is invalid - they'd be foolish to fund it after you've said that.",
        },
      ],
    },
    {
      id: "technical-issues",
      eyebrow: "Technical Issues",
      heading: "Platform reliability and edge cases.",
      items: [
        {
          id: "what-if-the-seller-loses",
          q: "What if the seller loses access to their email or wallet?",
          a: "If someone's account is compromised, raise a dispute to prevent funds from being accessed by malicious parties.",
        },
        {
          id: "what-happens-if-your-website",
          q: "What happens if your website goes down or your company shuts down?",
          a: "All contracts will continue to run their course since they're on the blockchain. We use Google Cloud for extremely reliable hosting. Our policy is to resolve any outstanding disputes before any potential shutdown.",
        },
        {
          id: "what-if-theres-a-dispute",
          q: "What if there's a dispute after your company is gone?",
          a: "All outstanding disputes would be resolved before any shutdown. The contracts technically belong to the buyer - our service just makes it easy to create and administer programmable money.",
        },
      ],
    },
    {
      id: "costs-and-payments",
      eyebrow: "Costs and Payments",
      heading: "Fees and payment options.",
      items: [
        {
          id: "what-does-this-actually-cost",
          q: "What does this actually cost me?",
          a: "Our service charges a 1% transaction fee. The system works in USDC, and we provide tools to obtain USDC if needed, but we have no control over third-party conversion costs in your location. All blockchain gas fees are covered by us - the service is gasless for users.",
        },
        {
          id: "what-if-i-want-to-make",
          q: "What if I want to make partial payments or installments?",
          a: "Currently, you would create multiple separate contracts for different payment stages.",
        },
      ],
    },
    {
      id: "disputes-and-problems",
      eyebrow: "Disputes and Problems",
      heading: "When things go wrong.",
      items: [
        {
          id: "how-long-do-i-have-to",
          q: "How long do I have to wait for dispute resolution?",
          a: "Once in dispute, funds are frozen so you're protected. Through the 'Manage Dispute' feature in your dashboard, you and the seller can exchange comments and refund proposals. The dispute automatically resolves as soon as you both agree on the same refund amount. There's no fixed timeline - resolution happens instantly when you reach agreement.",
        },
        {
          id: "what-stops-people-from-creating",
          q: "What stops people from creating fake contracts to scam others?",
          a: "If someone turns out to be a scammer and your goods don't arrive, you can dispute at any point up until the expiry date and get your money back for non-delivery.",
        },
        {
          id: "what-if-someone-disputes-in",
          q: "What if someone disputes in bad faith to get free stuff?",
          a: "Sellers should keep evidence of packing and sending. When disputes are raised, investigation with courier companies will reveal the truth about delivery.",
        },
        {
          id: "what-if-the-item-arrives",
          q: "What if the item arrives but is completely different from what was described?",
          a: "The system provides trustless payment infrastructure. It's between buyer and seller to agree whether an item is \"as described\" and what the resolution should be. A common resolution is for the seller to accept returned goods and refund the buyer once the item is back with the seller.",
        },
        {
          id: "what-if-i-need-to",
          q: "What if I need to dispute but it's outside business hours?",
          a: "Once in dispute, funds are frozen so you're safe. You can manage the dispute through your dashboard at any time - view the history of comments and refund suggestions, and add your own. The system works 24/7, and disputes auto-resolve the moment both parties agree on a refund amount.",
        },
        {
          id: "what-if-the-seller-goes",
          q: "What if the seller goes silent after I pay but before expiry?",
          a: "You can dispute at any time before expiry by clicking 'Raise Dispute' in your dashboard. Enter a comment explaining the lack of communication and suggest a full refund. The seller will be notified and can respond through their dashboard. If they agree to your refund amount, the dispute resolves automatically.",
        },
      ],
    },
    {
      id: "international-and-legal-issues",
      eyebrow: "International and Legal Issues",
      heading: "Cross-border transactions and legal questions.",
      items: [
        {
          id: "what-about-international-transactions-and",
          q: "What about international transactions and different countries' laws?",
          a: "This is a protected money transfer service, not a legal dispute-resolution service. Formal legal proceedings are between buyer and seller. Once resolution has been agreed (with or without legal involvement), funds are allocated according to that agreement.",
        },
        {
          id: "what-if-expensive-items-need",
          q: "What if expensive items need a formal legal resolution?",
          a: "The contracts are technically owned by the buyer. If buyer and seller can't reach agreement, formal legal proceedings between them are their responsibility. The conclusion of that process informs our admin team how to allocate disputed funds.",
        },
      ],
    },
    {
      id: "privacy-and-security",
      eyebrow: "Privacy and Security",
      heading: "Data, code audits, and transparency.",
      items: [
        {
          id: "what-information-do-you-store",
          q: "What information do you store about me?",
          a: "Our privacy policy is at [our privacy policy page](/privacy-policy). On the public blockchain: amount, buyer wallet ID, seller wallet ID, expiry date, and description. We store email addresses on secured servers as they're necessary to provide the service, but this data is not part of any public interface.",
        },
        {
          id: "what-if-theres-a-bug",
          q: "What if there's a bug in the smart contract code?",
          a: "Every contract uses the same verified code available on the blockchain. We have verified our code using established security services.",
        },
        {
          id: "how-can-i-verify-for",
          q: "How can I verify for myself that you can't steal my money?",
          a: "Want to verify our code yourself? Copy the verified contract from the blockchain explorer and paste it into tools like MythX, ask ChatGPT \"can the admin steal funds from this contract?\", or have any Solidity developer review it. The code is extensively commented to make admin limitations clear.\n\nWe've used [SolidityScan](https://solidityscan.com/quickscan) to audit our contracts - you can too. It'll ask you to select a blockchain (we are on Base) and then paste in a contract address. It'll give you a full audit report with a score of 94%: 'Great'.",
          showContractAddress: true,
        },
        {
          id: "is-your-code-open-source",
          q: "Is your code open source so I can review it myself?",
          a: "Yes! The entire Conduit UCPI platform is open source and available at [github.com/conduit-ucpi](https://github.com/conduit-ucpi). This includes our smart contracts, backend services, and frontend applications. You can review every line of code, see our development history, and verify that the deployed contracts match the published source code. This transparency is core to our commitment to trustless, secure transactions.",
        },
        {
          id: "is-there-any-reputation-tracking",
          q: "Is there any reputation tracking or feedback system?",
          a: "No. This system exists to eliminate the need for trust in transactions because both parties are protected - no more \"pay and hope.\"",
        },
      ],
    },
    {
      id: "support-and-documentation",
      eyebrow: "Support and Documentation",
      heading: "Help and practical guidance.",
      items: [
        {
          id: "what-if-i-need-help",
          q: "What if I need help with technical issues that aren't disputes?",
          a: "Technical support is available by emailing [info@stabledrop.me](mailto:info@stabledrop.me)",
        },
        {
          id: "can-i-get-proper-receiptsinvoices",
          q: "Can I get proper receipts/invoices for business transactions?",
          a: "That sounds like a great enhancement. Email us at [info@stabledrop.me](mailto:info@stabledrop.me) to discuss your needs.",
        },
        {
          id: "what-if-my-payment-gets",
          q: "What if my payment gets stuck and doesn't make it to the contract?",
          a: "The system reads contract status directly from the blockchain where funds are held. Our contract code makes it impossible for a transaction to go from \"funds-deposited\" back to \"awaiting payment.\"",
        },
        {
          id: "what-about-timesensitive-purchases-like",
          q: "What about time-sensitive purchases like concert tickets?",
          a: "This system is ideal for time-sensitive purchases. You can set the expiry date when making the buyer/seller agreement to ensure delivery by your required date.",
        },
        {
          id: "what-if-i-accidentally-send",
          q: "What if I accidentally send money to the wrong contract or enter the wrong amount?",
          a: "You're not stuck with mistakes - raise a dispute immediately with a comment explaining the error and request 100% refund. When the other party sees your explanation and agrees to the refund amount, the dispute will automatically resolve and return your funds.",
        },
        {
          id: "how-long-should-i-wait",
          q: "How long should I wait before disputing if I need time to inspect complex items?",
          a: "This system provides payment-protection infrastructure to make transactions trustless. Agreements about inspection periods and acceptance criteria are for buyer and seller to negotiate between themselves.",
        },
      ],
    },
    {
      id: "getting-started",
      eyebrow: "Getting Started",
      heading: "Your first transaction.",
      items: [
        {
          id: "this-sounds-complicated-with-crypto",
          q: "This sounds complicated with crypto and wallets - can you walk me through what I actually need to do?",
          a: "1. Get USDC using the instructions on our wallet management screen. 2. Ask your seller to go to our website, authenticate, and click 'request payment' (they enter your email, amount, payout date, description). 3. You get an email, log in to see the pending payment, check details and accept. That's it!",
        },
        {
          id: "what-is-usdc-and-why",
          q: "What is USDC and why can't I just pay with regular money?",
          a: "USDC is a stablecoin cryptocurrency that's always 1:1 with USD. You need it to use blockchain smart contracts that make this service possible - giving you mathematical guarantees about payment protection that regular payment systems can't provide.",
        },
        {
          id: "im-nervous-about-using-cryptocurrency",
          q: "I'm nervous about using cryptocurrency - isn't this risky and complicated?",
          a: "You've been using electronic money for decades - your bank balance is just numbers in a computer, not physical cash. USDC works the same way, except it runs on public infrastructure instead of private bank systems. The main practical differences: 1) You can verify transactions yourself on the blockchain, 2) No one can freeze or reverse your payments without your consent, 3) It works 24/7 globally without bank business hours or international transfer delays. The \"crypto\" part is just the technology that makes these guarantees possible - you don't need to understand blockchain any more than you need to understand SWIFT networks to use regular bank transfers.",
        },
        {
          id: "how-do-i-authenticate-is",
          q: "How do I authenticate - is this another username/password account?",
          a: "Authentication is simple: either choose your Google account or enter your email address and receive a 6-digit code to enter on screen.",
        },
        {
          id: "what-does-it-cost-to",
          q: "What does it cost to get USDC?",
          a: "We don't control crypto exchanges, so costs depend on which exchange you use and their terms. If you find this service useful, consider keeping some money in USDC for future transactions.",
        },
        {
          id: "what-if-i-make-a",
          q: "What if I make a mistake during setup?",
          a: "If the seller creates the wrong email, you won't get notifications. Wrong amount? Just ignore it and ask them to create a new request. If you somehow fund the wrong contract, raise a dispute and we'll sort it out.",
        },
      ],
    },
    {
      id: "why-use-this",
      eyebrow: "Why Use This",
      heading: "Is this right for you?",
      items: [
        {
          id: "why-not-just-negotiate-directly",
          q: "Why not just negotiate directly with the seller instead of using your service?",
          a: "The key advantage is that sellers don't get the money until you're satisfied, so they're incentivized to resolve any problems. It also protects sellers by showing they're dealing with a buyer who has funds ready.",
        },
        {
          id: "whats-the-smallest-purchase-amount",
          q: "What's the smallest purchase amount where this makes sense?",
          a: "Consider the exchange fees to get USDC plus our 1% transaction fee. This works well for purchases where you can't meet in person or need extra protection. Also remember: if a seller refuses to use this system for spurious reasons, you probably just avoided a scam.",
        },
        {
          id: "is-this-mainly-for-cryptosavvy",
          q: "Is this mainly for crypto-savvy people or can regular consumers use it?",
          a: "It's designed for regular people. The biggest friction is getting USDC initially - we're working on easier onramps. If you can copy and paste addresses, you should be fine. Try our free $0.001 test option to see how it works risk-free.",
        },
        {
          id: "can-i-use-this-for",
          q: "Can I use this for purchases from other cities or countries?",
          a: "Yes! This enables safe transactions with sellers anywhere, since you're protected regardless of geographic location. You're not limited to local sellers you can meet in person.",
        },
      ],
    },
    {
      id: "system-reliability",
      eyebrow: "System Reliability",
      heading: "Uptime and infrastructure.",
      items: [
        {
          id: "what-if-your-website-crashes",
          q: "What if your website crashes or there are technical problems?",
          a: "The system runs on Google Cloud with automated deployment and is built by experienced engineers (ex-Skyscanner principals with 50+ years combined experience). Most importantly, your transactions exist on the blockchain independently of our servers - you own them and could theoretically use other tools to access them if needed.",
        },
      ],
    },
    {
      id: "for-merchants-getting-started",
      eyebrow: "For Merchants - Getting Started",
      heading: "Start accepting payments in minutes.",
      items: [
        {
          id: "what-do-i-need-to",
          q: "What do I need to start accepting payments as a merchant?",
          a: "An email address. That's it. No application, no bank statements, no business plan, no waiting period. You can process your first transaction in under 10 minutes.",
        },
        {
          id: "why-is-there-no-approval",
          q: "Why is there no approval process?",
          a: "Traditional processors take custody of your money, so they need to assess your risk. We never touch your funds — they go from buyer to smart contract to you. No custody means no underwriting.",
        },
        {
          id: "why-is-there-no-credit",
          q: "Why is there no credit check or business verification?",
          a: "Processors who hold funds need to know you won't disappear owing them money. We can't be left holding the bag because we never hold anything.",
        },
        {
          id: "why-no-reserve-requirements",
          q: "Why no reserve requirements?",
          a: "Reserves exist so processors can cover chargebacks if you can't. Our system doesn't have chargebacks — disputes are resolved before funds leave the payment contract. Nothing to reserve against.",
        },
        {
          id: "why-no-monthly-minimums-or",
          q: "Why no monthly minimums or volume requirements?",
          a: "Those exist to make small merchants worth the processor's underwriting cost. We have no underwriting cost.",
        },
        {
          id: "what-if-i-sell-cbd",
          q: "What if I sell CBD, supplements, adult content, firearms, or other high-risk categories?",
          a: "We don't restrict product categories. Traditional processors reject high-risk merchants because they're afraid of chargebacks and regulatory scrutiny. Our system doesn't have chargebacks, and we don't make decisions about your funds, so we don't need to police what you sell.",
        },
        {
          id: "can-my-merchant-account-be",
          q: "Can my merchant account be frozen or terminated?",
          a: "We can't freeze funds that aren't in our custody. Your money is either in the payment contract (where only you and the buyer can claim it) or in your wallet. There's no \"account\" to terminate — each transaction is its own contract.",
        },
      ],
    },
    {
      id: "for-merchants-how-it-works",
      eyebrow: "For Merchants - How It Works",
      heading: "Payments, disputes, and chargebacks.",
      items: [
        {
          id: "what-happens-when-a-customer",
          q: "What happens when a customer pays me as a merchant?",
          a: "Funds go into a smart contract (not to you, not to us). At the agreed payout date, funds release to your wallet automatically. If there's a dispute before then, funds stay frozen until you and the buyer agree on a resolution.",
        },
        {
          id: "how-is-this-different-from",
          q: "How is this different from a chargeback?",
          a: "**Chargebacks:**\n\n- Customer calls their bank\n- Bank takes your money immediately\n- You pay $15-25 fee regardless of outcome\n- You have 7-10 days to gather evidence\n- Bank decides\n- You can lose even with proof\n- Customer has up to 180 days to dispute\n\n**This system:**\n\n- Customer raises dispute in the app\n- Funds freeze (but aren't taken from you)\n- You negotiate directly with the customer\n- When you both agree on a split, funds release automatically\n- No fee\n- No third party deciding your fate",
        },
        {
          id: "what-if-a-buyer-disputes",
          q: "What if a buyer disputes in bad faith?",
          a: "They can freeze the funds, but they can't get them without your agreement. A buyer who received goods and disputes anyway is stuck — they don't get money back, you don't get paid, until someone blinks. Keep your shipping receipts.",
        },
        {
          id: "what-does-my-customer-see",
          q: "What does my customer see during checkout?",
          a: "Your customer authenticates with email or social login. If they don't have a wallet, one is created automatically — but they still own it (they can export their keys anytime). If they don't have USDC or USDT, we provide links to buy some. They confirm the payment, sign it on their device, done. No wallet setup, no gas fees, no crypto knowledge required.",
        },
      ],
    },
    {
      id: "understanding-stablecoins",
      eyebrow: "Understanding Stablecoins",
      heading: "USDC, USDT, and off-ramping.",
      items: [
        {
          id: "which-stablecoins-can-customers-pay",
          q: "Which stablecoins can customers pay with?",
          a: "USDC or USDT. Both are pegged 1:1 to USD. USDT has higher global circulation; USDC has cleaner off-ramp economics via Coinbase.",
        },
        {
          id: "what-if-my-customer-doesnt",
          q: "What if my customer doesn't have USDC or USDT?",
          a: "The checkout provides links to purchase stablecoins directly. Customers can buy with card or bank transfer through integrated on-ramps.",
        },
        {
          id: "do-my-customers-need-a",
          q: "Do my customers need a crypto wallet?",
          a: "No. Customers who don't have a wallet get one created automatically during checkout. They still own it — they can export their private keys anytime. It's their wallet, we just make setup invisible.",
        },
        {
          id: "what-if-a-customer-already",
          q: "What if a customer already has a wallet?",
          a: "They can connect it instead. Works either way.",
        },
        {
          id: "who-pays-the-blockchain-transaction",
          q: "Who pays the blockchain transaction fees?",
          a: "We do. Gas fees on Base are fractions of a cent, but users would normally need to hold ETH to pay them. We've eliminated that — your customers never need to touch ETH. They pay in USDC or USDT, that's it.",
        },
        {
          id: "what-about-price-volatility-with",
          q: "What about price volatility with cryptocurrency?",
          a: "USDC and USDT are stablecoins — they're pegged 1:1 to USD. $100 USDC is always worth $100. This isn't Bitcoin.",
        },
        {
          id: "how-do-i-turn-stablecoins",
          q: "How do I turn stablecoins into real money?",
          a: "Coinbase converts USDC to USD at 1:1 with no fee for conversions under $5 million per month. For USDT, most exchanges charge a small fee (typically 0.1-0.5%) or you can swap USDT to USDC first. Either way, your effective cost is close to just the 1% transaction fee.",
        },
        {
          id: "how-do-i-handle-accounting",
          q: "How do I handle accounting for stablecoin payments?",
          a: "USDC and USDT are 1:1 with USD, so the transaction value is straightforward. Each transaction has a blockchain record with timestamp, amount, and addresses. Treat the off-ramp (converting to fiat) as a separate event. Talk to your accountant about crypto income reporting in your jurisdiction.",
        },
        {
          id: "what-about-taxes-on-stablecoin",
          q: "What about taxes on stablecoin payments?",
          a: "In most jurisdictions, receiving stablecoins as payment is treated like receiving USD — it's income at the time of receipt. The off-ramp may have tax implications depending on timing and any value fluctuation. This isn't tax advice; consult a professional.",
        },
      ],
    },
    {
      id: "security-and-fraud-protection",
      eyebrow: "Security and Fraud Protection",
      heading: "Push payments eliminate fraud at the root.",
      items: [
        {
          id: "why-is-fraud-lower-with",
          q: "Why is fraud lower with stablecoin payments?",
          a: "Card payments are \"pull\" — you hand over credentials that let the merchant's processor extract funds. Stablecoin payments are \"push\" — the buyer actively sends funds. There's no shared secret to steal. A fraudster would need access to your customer's wallet, not just a number printed on a piece of plastic. No credentials are exchanged, nothing is stored, nothing can be skimmed or phished.",
        },
        {
          id: "what-does-lower-fraud-mean",
          q: "What does lower fraud mean for me as a merchant?",
          a: "Card-not-present fraud runs about 0.5% of transaction volume. You pay for that — either directly through losses, or indirectly through processor fees that price in fraud risk. With push payments, that category of fraud doesn't exist. Buyers must have the funds and actively authorize the transaction.",
        },
        {
          id: "where-does-payment-security-actually",
          q: "Where does payment security actually happen?",
          a: "With stablecoin payments, all security happens on the customer's device at the moment they connect their wallet and sign the transaction. There's no card number to store, no credentials database to breach, no sensitive data flowing through servers. We couldn't leak your customers' payment details if we wanted to — we never have them.",
        },
        {
          id: "does-this-mean-i-dont",
          q: "Does this mean I don't need PCI compliance?",
          a: "There's no card data, so there's nothing to comply with. No annual audits, no questionnaires, no security requirements for handling data you never touch.",
        },
        {
          id: "what-about-fraud-protection-services",
          q: "What about fraud protection services?",
          a: "You don't need them. Push payments from user-owned wallets eliminate the problem at the root. There's no stolen card number to use, no credentials to phish, no processor database to breach. You don't need AI fraud detection, velocity checks, address verification, 3D Secure, or any of it.",
        },
      ],
    },
    {
      id: "regulatory-and-custody",
      eyebrow: "Regulatory and Custody",
      heading: "Non-custodial by design.",
      items: [
        {
          id: "dont-escrow-services-require-banking",
          q: "Don't escrow services require banking licenses and regulatory approval?",
          a: "Traditional escrow does, because a third party holds your money. We're not custodial. Funds go directly from the buyer's wallet into a smart contract that both parties own. We never hold, control, or have access to the funds. The contract code determines what happens. Admin can only allocate disputed funds between buyer and seller, never to anyone else.",
        },
        {
          id: "what-about-mica-or-money",
          q: "What about MiCA or money transmission laws?",
          a: "Regulations like MiCA apply to Crypto-Asset Service Providers who custody funds or act as intermediaries. We're infrastructure. The smart contracts run on a public blockchain. Users interact directly with their own contracts. If our website disappeared tomorrow, your contracts would still execute.",
        },
        {
          id: "but-you-resolve-disputes-doesnt",
          q: "But you resolve disputes — doesn't that make you a custodian?",
          a: "No. Dispute resolution means we can allocate funds between buyer and seller when they can't agree. We cannot extract funds to ourselves or any third party. The contract code makes this impossible — not against policy, impossible. Anyone can verify this by reading the verified contract on-chain.",
        },
        {
          id: "what-if-a-regulator-disagrees",
          q: "What if a regulator disagrees with your interpretation?",
          a: "Regulatory interpretation varies by jurisdiction. But the architecture is genuinely different from custodial services. If a specific jurisdiction decides non-custodial smart contract infrastructure requires licensing, that's a conversation about that jurisdiction — it doesn't change the technical reality of how the system works.",
        },
        {
          id: "what-if-regulations-change-and",
          q: "What if regulations change and you get shut down?",
          a: "Your in-flight transactions still complete. The smart contracts exist on the blockchain, not on our servers. If regulators shut us down tomorrow, every active contract keeps running — funds release at the scheduled time, disputes resolve when parties agree.",
        },
      ],
    },
    {
      id: "trust-and-platform-risk",
      eyebrow: "Trust and Platform Risk",
      heading: "Verify, don't trust.",
      items: [
        {
          id: "how-do-i-know-you",
          q: "How do I know you won't steal my money as a merchant?",
          a: "You don't have to trust us. The smart contract code is verified on-chain — anyone can read it. The code proves funds can only go to buyer or seller. Paste it into ChatGPT and ask \"can the admin steal my funds?\" The answer is provably no.",
        },
        {
          id: "what-if-your-company-shuts",
          q: "What if your company shuts down while I have active transactions?",
          a: "Your in-flight transactions complete automatically — they're smart contracts, not our servers. If we disappeared tomorrow, funds release to you at the scheduled time, or stay frozen in dispute until you and the buyer work it out directly.",
        },
      ],
    },
    {
      id: "comparison-to-traditional-payment-processing",
      eyebrow: "Comparison to Traditional Payment Processing",
      heading: "How this stacks up.",
      items: [
        {
          id: "what-fees-am-i-actually",
          q: "What fees am I actually avoiding compared to traditional payment processors?",
          a: "- Interchange fees (~2%): Gone\n- Per-transaction fees ($0.25-0.30): Gone\n- Chargeback fees ($15-25 per dispute): Gone\n- Rolling reserve (20-30% held): Gone\n- Monthly minimums: Gone\n- PCI compliance costs: Gone\n- Fraud protection services: Gone",
        },
        {
          id: "whats-the-catch-with-this",
          q: "What's the catch with this payment system?",
          a: "Your customers need USDC or USDT. That's the real barrier. We've reduced the friction (auto-wallets, on-ramp links, gas-free transactions), but if your customers don't have stablecoins and won't get them, this doesn't help you.",
        },
        {
          id: "why-wouldnt-i-just-keep",
          q: "Why wouldn't I just keep using Stripe or traditional processors?",
          a: "If Stripe works for you, keep using it. This is for merchants who: sell in high-risk categories that get rejected or shut down, have been burned by account freezes or fund holds, want to reach crypto holders, want a backup payment channel that can't be frozen, or are tired of chargeback economics.",
        },
        {
          id: "can-i-test-the-merchant",
          q: "Can I test the merchant payment system first?",
          a: "Yes. Create a test transaction for $0.001 — the fee is waived so you can see how it works risk-free.",
        },
        {
          id: "can-i-pay-someone-or",
          q: "Can I pay someone, or name who may dispute, using just their email address?",
          a: "Yes. Wherever a payment asks for a wallet — the seller who gets paid, or the buyer who may dispute — you can give an email address instead. We convert it to the wallet that person owns, creating one for them if they have never signed in, and the same email always converts to the same wallet. This works when creating a payment request on the site, through the API, and through the MCP tools an agent uses.",
        },
        {
          id: "a-payment-was-sent-to",
          q: "A payment was sent to my email address. How do I get the money?",
          a: "Sign in with that email address, by email code or Google. The wallet tied to it already holds the payment. From the Wallet page you can send the funds anywhere, or export the wallet's key to use it elsewhere.",
        },
      ],
    },
  ],
  more: {
    eyebrow: 'Need more help?',
    heading: 'Still have questions?',
    body: "Contact our support team at [info@stabledrop.me](mailto:info@stabledrop.me) for additional assistance.",
  },
  footer: { home: 'Home', support: 'Technical support' },
  contractAddress: {
    label: 'Contract Implementation Address:',
    note: 'You can use this address to verify our smart contract code on SolidityScan or any blockchain explorer.',
  },
};
