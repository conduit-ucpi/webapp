import Link from 'next/link';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import InteractiveDemo from '@/components/landing/InteractiveDemo';
import SEO from '@/components/SEO';
import { GetStaticProps } from 'next';
import { getSiteNameFromDomain } from '@/utils/siteName';

export default function Home() {
  let user = null;
  let isConnected = false;

  try {
    const authContext = useAuth();
    user = authContext.user;
    isConnected = authContext.isConnected;
    // Don't check isLoading - always render content for SSR/SEO/AI crawlers
  } catch (error) {
    // Auth context not available during SSR or hydration
  }

  const isAuthenticated = !!user;
  const siteName = getSiteNameFromDomain();

  // Comprehensive structured data for search engines and AI bots
  const structuredData = [
    // Primary service information
    {
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "name": "Conduit Escrow",
      "alternateName": "InstantEscrow",
      "description": "100% open source cryptocurrency escrow service for USDC stablecoin payments with built-in buyer protection. Smart contract-based time-delayed escrow with automatic dispute resolution. No KYC/KYB, no floats, no minimum volumes. 1% flat fee, instant settlement.",
      "url": "https://conduit-ucpi.com",
      "logo": "https://conduit-ucpi.com/icon.png",
      "image": "https://conduit-ucpi.com/preview.png",
      "sameAs": [
        "https://github.com/conduit-ucpi",
        "https://app.instantescrow.nz"
      ],
      "priceRange": "1%",
      "paymentAccepted": ["USDC", "Cryptocurrency", "Stablecoin"],
      "areaServed": {
        "@type": "Place",
        "name": "Worldwide"
      },
      "availableChannel": {
        "@type": "ServiceChannel",
        "serviceType": "Online Banking",
        "availableLanguage": "English"
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Escrow Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Time-Delayed Escrow Contracts",
              "description": "Secure smart contract payment holding with automatic release after delivery confirmation. Built-in buyer protection with instant dispute resolution. Gas-free transactions, no chargeback fees, final settlement once payout timer expires."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "E-commerce Integration",
              "description": "WordPress and Shopify plugins, JavaScript SDK for custom websites. Zero-setup POS requiring only a web browser. Built-in buyer protection, 1% fee, 10-minute installation."
            }
          }
        ]
      },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": "1",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "0.01",
          "priceCurrency": "USD",
          "referenceQuantity": {
            "@type": "QuantitativeValue",
            "value": "1",
            "unitText": "TRANSACTION"
          }
        }
      },
      "serviceType": "Cryptocurrency Escrow Service",
      "provider": {
        "@type": "Organization",
        "name": "Conduit UCPI",
        "url": "https://conduit-ucpi.com"
      },
      "termsOfService": "https://conduit-ucpi.com/terms-of-service",
      "slogan": "Stablecoin payments made safe and easy"
    },
    // Comprehensive background article explaining the why
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "What's Wrong with Payments - Why Blockchain Escrow Solves Real Problems",
      "alternativeHeadline": "The Case for Stablecoin Escrow: Fixing Payment Infrastructure Built 30 Years Ago",
      "author": {
        "@type": "Person",
        "name": "charlie"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Conduit Escrow",
        "logo": {
          "@type": "ImageObject",
          "url": "https://conduit-ucpi.com/icon.png"
        }
      },
      "datePublished": "2025-11-24",
      "dateModified": "2025-11-30",
      "articleBody": "What's wrong with payments? The problem — we are frogs that have been slowly boiled over the last 30 years by banks and payment providers.\n\nPayment Infrastructure is 30+ years old. I am old enough to remember the 'knuckle-buster' manual card machines. The infrastructure we're all using for our online card payments was built 30+ years ago, when those analogue machines were phased out. It's no secret since then, technology has advanced a lot. However, we're still accepting as normal many of the limitations of those systems: who knew, for example, that a 'security' system based on who has seen the 16 digit number embossed on your card would result in high rates of fraud? Don't worry, we can solve it by writing 3 more numbers on the back! Where else would we call CVV an acceptable solution to the ridiculous problem the industry created for themselves?\n\nThe self-created problems of the payment industry don't stop there either, the current process is so ingrained that we accept as normal multi-day settlement (despite cash having been tokenized decades ago), the whole chargeback system which hurts merchants and perpetuates the fraud problem instead of fixing it at source, merchant floats, risk profiles (for customers and merchants), high processing fees (which are ultimately paid by the consumer), banks charging customers to spend their own money via their own cards, merchant limits & freezes; I could go on… When you stand back and look at it, the whole system is a patchwork of workarounds for problems that shouldn't exist in the first place. There's no incentive for the payment providers to change it because they benefit massively from the interest earned on money in transit, and all the charges around fraud-risk assessment. The mind boggles at how complicated these providers have made the simple process of exchanging money for goods and services.\n\nAs any good business should, the banks and payment providers are investigating ways to cut their costs. The glaringly obvious choice for them is to use public blockchains to transfer their funds, and Visa and Mastercard have both been experimenting with this tech. The risk for them, though is that settlement is simple and instant, so how can they justify their high fees? If you are in any doubt about the security or reliability of public blockchains, you might want to warn banking giant JPMorgan, who 2 weeks ago, released their JPMD token (1:1 with USD) for institutional deposits and settlements on the public Base network. Retail payment settlement behemoth, Stripe has also jumped on the bandwagon and now offers to 'process' stablecoin (USDC) payments for their retailers — what their retailers get for their 1.5% is unclear, there's no chargeback protection for the buyers, so all Stripe has to do is tell the buyers which wallet to pay, and then notify the merchant when the payment has happened (ker-ching!). Interestingly, the public blockchains have already factored in the actual electricity and hardware cost of processing transactions in what they call 'gas fees'. As it makes no technical difference whether the transaction is for $1 or $1,000,000, the fees are the same. A simple transfer of funds on the Base network actually costs around $0.0002.\n\nWhat would payments look like if we built it all today? As a software engineer I seem to have been sucked into the world of web3. Having built a couple of dApps in this space, I feel I'm probably qualified to comment on this topic. By the end of this short article, it should be pretty obvious that blockchain is basically payments for the 21st century.\n\nPublic Blockchains (simplified version): There are a number of these (eg. Ethereum) — a blockchain is effectively a database which records transactions. They are built with multiple replicated instances and backups, so that it's effectively impossible to delete records, only add them. Therefore a blockchain is a very useful ledger to use as a source of truth for who gave what to whom. The hardware on which the blockchains run costs money, so the recording of each transaction incurrs a small part of the cost. This cost is charged on each transaction and is called 'gas'. Different blockchains use different tokens to pay gas, on Ethereum, the gas is the ETH token. On Avalanche it's the AVAX — you get the idea. So in order to add any transactions to the chain, the user must hold some of the gas token in their wallet, and pay some out along with the request to add the transaction to the chain. People can buy gas tokens like ETH for real money on an exchange. The ETH is originally issued by the organisation behind the chain itself and in this way they can pay their hardware costs, pay their staff etc…\n\nCrypto: When people talk about 'crypto' they mean tokens that can be transferred in transactions on a blockchain. Obviously the gas token itself can be transferred, but other tokens registered with that chain can too. The main one that you hear about is Bitcoin ('BTC') although there are literally hundreds (maybe even thousands) of other ones out there, 'minted' by many, many different people and organisations. The supply of any given token is limited by the issuer, so the amount of FIAT (real money) you need to pay for a token is very volatile and depends on the supply and demand of that token. 'But why would I want a token?' I hear you ask… well, the only plausible answer is that you think it is going to increase in value, which means you expect that the demand/supply ratio is going to increase. If you compare this with investing money in equities or bonds — each of which have underlying cashflows setting their values, you begin to understand why some people refer to crypto as a 'Ponzi' or 'pyramid' scheme.\n\nStablecoins: Tokens that are registered on blockchains, which have a fixed value tied to FIAT (real world) currency. Examples are USDC and USDT (1:1 with USD), and EURC (1:1 with EURO). These are the boring side of crypto, the tokens which provide stability and therefore the utility. It's much simpler to accept payments for goods and services in stablecoins rather than highly volatile tokens.\n\nSo blockchains end up recording an eclectic mix of transactions where people buy and sell volatile tokens for stable ones as they expect rises and falls in value. Of the 9.7Tn$ of crypto transactions in August of 2025, around half were stablecoin transactions, and only 300M$ were commerce transactions (ie for goods and services). That's right, only 0.003% of crypto transactions are for commerce. For the tradfi world that figure is 0.4% remember this number. If you look at any of the blockchains out there, they all publish stats about their uptime, transaction speed, transactions per second and total transactions processed. These stats mean nothing to the techbros trying to get you to buy their dog-based meme coin; the blockchain providers are flexing at the banks and payment providers, because that's what blockchain is really for: settling payments, and it does it faster and cheaper than the incumbents. If stablecoins made up the gap between the current 0.003% and tradfi's 0.4%, that would mean 40Bn$ of stablecoin commerce transactions per month. The writing is on the wall for the incumbents, which is why they are 'experimenting' with blockchains. It won't be long before we're paying VISA their 3.5% they'll hold the funds earning interest, then settle it instantly on day 3 via blockchain in the background for a micropayment in gas fees.\n\nSo by now you'll have realised that the question we need to be asking is: 'why don't people spend stablecoins on goods and services like they do in tradfi?' — and this really IS the multi-billion dollar question for blockchain providers, payment providers, stablecoin issuers and ecommerce merchants. There are a few merchants accepting stablecoin payments via store cards and there are a few card issuers that allow you to directly spend your crypto anywhere (it's doing an exchange transaction in the background and paying the store in USD). Stripe thought it was just a case of providing the stablecoin checkout to merchants, but that's not been the roaring success they'd hoped.\n\nThe answer is chargebacks. Bear with me, I am going somewhere with this…\n\nThe 2 chargeback problems: Chargebacks mean that buyers have the confidence to buy without being present, safe in the knowledge that if the goods aren't as expected, or don't turn up at all, their last resort is to raise a chargeback. The card issuer indemnifies the buyer, effectively guaranteeing they'll get their money back. While the buyer-protection offered by chargebacks is essential to keep the gears of commerce turning, the system is heavily biased against the merchant (problem 1). As soon as a chargeback is raised, the merchant has to pay a chargeback fee, which is often more than the value of the sold item. The onus is then on the merchant to prove the item was as described, and arrived intact, only then do they have any chance of keeping their money (even if successful, they still pay the chargeback fee). On top of this, the merchant's history is tagged with the chargeback. Too many chargebacks in their history and a payment provider might increase the merchant's float requirements, decrease their volume limits, increase their minimum volume, increase their fees or freeze their account altogether.\n\nStraight wallet-to-wallet crypto payments are effectively instant, and totally immutable, so chargebacks can't be used (problem 2). This means that crypto buyers must 'pay and pray', hoping that once the merchant has received their payment they will actually send the goods, and they will arrive on time, undamaged and as described. Remember that 150x difference in tradfi vs crypto commerce volumes? This is the reason.\n\nSmart contracts to the rescue! Smart contracts are small pieces of software that can be released onto a blockchain. They cost some gas to create and interact with. Technically a buyer could (say) create a smart contract that would accept and hold the buyer's funds, and only release them to the seller when certain conditions were met — a software version of an escrow account. In reality this doesn't happen because buyers lack the patience or technical capability to write one-off contracts for each transaction, and merchants wouldn't know what to do with them anyway. Fortunately it's possible to make a smart-contract factory which can be called to clone a smart-contract implementation.\n\nArmed with this knowledge, let's imagine a utopian payment system… a merchant checkout which accepts stablecoin payment from the buyer and puts it in an escrow smart-contract with a release to the seller timed for after the goods have arrived. The buyer has up to the release date to raise a dispute and freeze the payout until arbitration is complete. This is beginning to sound like a fairer, automated version of chargebacks on stablecoin payments.\n\nEach time I talk to people about the limitations and self-caused problems with current payment systems, and how we could build it better, the response is always about the technical difficulties of actually implementing such a system, so I know what you're thinking: what about gas fees, delivery confirmation, arbitration, legal regulation? These are solvable — gas can be sponsored, time-delays handle delivery, automated negotiation handles most disputes. The implementation details matter, but they're not the point here.\n\nHere's what matters: conceptually, this system handles every case at least as well as chargebacks, and most cases significantly better. The merchant isn't punished with fees for defending themselves. The buyer still gets protection. Settlement is instant and costs fractions of a cent instead of 1.5–3.5%.\n\nIf you're thinking 'but what about X edge case?' — ask yourself: does the current chargeback system handle X any better? Almost certainly not.\n\nThe technology exists. The conceptual framework is sound — arguably superior to what we have now. So why are we still paying 3.5% for multi-day settlement on infrastructure from the 1990s? The answer isn't technical. It's institutional inertia and entrenched interests.\n\nThe real world: Having gone through these thought processes, I arrived at the conclusion that in any sane-world, these concepts will end up being how payments are processed in future. So I built it.\n\nhttps://app.instantescrow.nz is a suite of stablecoin tools running on the same (smart-contract escrow on Base network) rails. The suite comprises a zero-setup POS requiring only a web-browser, a p2p tool (for use by individuals making private sales) and checkout plugins for wordpress, shopify and custom javascript sites.\n\nThe code is open-sourced at https://github.com/conduit-ucpi to prove there's nothing to hide, and has been reviewed and approved by Wordpress and by blockaid.io (Metamask's security screening partner).\n\nIn contrast to traditional card-payment checkouts, it has: no KYB/KYC, no chargeback limits or risk assessment, no residency stipulations, no floats, no minimum or maximum payment volumes and costs nothing to install. The process is so quick and easy I even ended up writing self-install instructions that take about 10 minutes to complete on anyone's site.\n\nSo what does it cost? The system charges a flat 1% fee on transactions. Compare that to a merchant selling a $50 item: with a traditional processor they'd pay $0.75–1.75 in fees and wait 2–3 days for settlement. With InstantEscrow, they pay $0.50 and receive funds as soon as the release timer expires (typically a day after delivery confirmation). And if a customer disputes a transaction? With traditional processors, merchants face chargeback fees (often $15–25 per dispute regardless of outcome) and can be hit with chargebacks up to 180 days after settlement — long after they've forgotten about the transaction. With InstantEscrow, there's no extra fee for disputes, the merchant participates directly in the negotiation process, and disputes can only be raised before the payout date. Once funds are released, the transaction is final.\n\nThe main features are:\n- Gas-free transactions (the system pays them in the background)\n- Eliminates usual crypto complexities around network selection, token selection, copying and pasting wallet addresses\n- Automatic time-release payment to seller's account (recommendation is to set this for a day or so after delivery, so buyer has a chance to check goods and raise a dispute if necessary)\n- Chargeback-like buyer protection with automated dispute process (if buyer raises a dispute before payout, funds are frozen until dispute is resolved)\n- Automated dispute process facilitates negotiation between buyer and seller to agree a reasonable split allocation of funds. Once agreement is reached payout is automatic\n- Smart contract security: the contract code means the funds cannot go to anyone except buyer or seller, even in cases of admin intervention\n- Because the system is non-custodial — funds are only ever handled and owned by the buyer and seller — the legal requirements for a traditional escrow system don't apply\n\nRemember that 0.003% figure — the proportion of crypto transactions that are actually for commerce, compared to 0.4% in traditional finance? That gap represents people holding crypto who aren't spending it. Not because they don't want things, but because checkout is a nightmare and there's no buyer protection. That's a pool of potential customers that most merchants are currently invisible to. InstantEscrow fixes the checkout problem and adds the buyer protection.\n\nFor merchants, the pitch is simple: There are people with money who want to buy things, and right now they can't easily buy from you. This changes that in 10 minutes, costs nothing to install, and if it doesn't bring new business, you've lost nothing.\n\nThe challenge now is getting merchants to try it. Setup takes 10 minutes, costs nothing, and the code has been independently reviewed, and is open for anyone to inspect. The technology is ready — we're just waiting for the rest of the world to catch up.",
      "keywords": "payment infrastructure, blockchain escrow, stablecoin payments, USDC commerce, chargeback problems, smart contracts, cryptocurrency escrow, merchant fees, buyer protection, instant settlement, Base network, open source payments, Web3 payments, DeFi escrow"
    }
  ];

  return (
    <>
      <SEO
        title="Conduit Escrow - Open Source Crypto Payments with Built-in Buyer Protection | 1% Fee"
        description="Get paid safely with blockchain escrow. 100% open source - audit the code yourself. Hold USDC payments in trust until delivery is confirmed. No lawyers, no banks - just security. 60 second setup, 1% fee, free testing."
        keywords="open source escrow, crypto escrow, blockchain escrow, USDC escrow, secure crypto payments, buyer protection, smart contract escrow, Base network escrow, trustless payments, cryptocurrency escrow, time-delayed payments, blockchain payment protection, auditable escrow, transparent blockchain"
        canonical="/"
        structuredData={structuredData}
      />
      <div className="bg-white dark:bg-secondary-900 min-h-screen transition-colors" key="home-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
          <div className="space-y-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-secondary-900 dark:text-white leading-tight">
              <span className="text-primary-500">Stablecoin payments</span> made safe and easy
            </h1>
            <div className="bg-primary-100 dark:bg-primary-900 rounded-lg p-6">
              <p className="text-lg lg:text-xl font-semibold text-secondary-900 dark:text-white leading-relaxed">
                <span className="text-primary-600 dark:text-primary-400">{siteName}</span> gives stablecoin payments a familiar checkout experience and buyer protections, opening stores up to new customers with just one line of code.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 w-fit">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-700 font-semibold">100% Open Source</span>
              <a
                href="https://github.com/conduit-ucpi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-700 underline text-sm"
              >
                View on GitHub →
              </a>
            </div>
            {isConnected ? (
              <div className="flex gap-4 pt-6">
                <Link href="/dashboard">
                  <Button size="lg" className="px-8 py-4 text-lg">
                    Go to Dashboard
                  </Button>
                </Link>
                <Link href="/create">
                  <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
                    Create Payment Request
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* For P2P Users - Send or Request Payment */}
                  <div className="border-2 border-primary-200 dark:border-primary-700 rounded-lg p-6 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-lg transition-all bg-white dark:bg-secondary-800">
                    <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                      Send or Request Payment
                    </h3>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                      Create payment requests or manage your escrow transactions
                    </p>
                    <ConnectWalletEmbedded
                      useSmartRouting={false}
                      showTwoOptionLayout={true}
                    />
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-secondary-600 dark:text-secondary-400">
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        No wallet needed
                      </span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        60 second setup
                      </span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        1% fee
                      </span>
                    </div>
                  </div>

                  {/* For Merchants - Add Stablecoin Checkout */}
                  <div className="border-2 border-green-200 dark:border-green-700 rounded-lg p-6 hover:border-green-400 dark:hover:border-green-500 hover:shadow-lg transition-all bg-white dark:bg-secondary-800">
                    <h3 className="text-xl font-semibold text-secondary-900 dark:text-white mb-2">
                      Add Stablecoin Checkout
                    </h3>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-2">
                      Complete checkout experience with plugins for WordPress/Shopify or JavaScript SDK for custom sites
                    </p>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-4">
                      ✓ No admin needed - self-install in 10 minutes
                    </p>
                    <Link href="/plugins">
                      <Button size="lg" className="w-full bg-green-500 hover:bg-green-600 text-white">
                        View Demos & Integration Options →
                      </Button>
                    </Link>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2 text-center">
                      See working examples and user experience videos
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-secondary-600 dark:text-secondary-400">
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        One-line SDK
                      </span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Buyer protection
                      </span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        1% fee
                      </span>
                    </div>
                    <Link href="/merchant-savings-calculator">
                      <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2 mt-4 hover:bg-green-100 dark:hover:bg-green-900/30 hover:border-green-300 dark:hover:border-green-600 transition-colors cursor-pointer">
                        <span className="text-xs text-green-800 dark:text-green-300 font-medium">
                          💰 Calculate Your Savings →
                        </span>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="hidden lg:block">
            <img
              src="/payment_gateway.png"
              alt="Secure blockchain escrow payment gateway for cryptocurrency transactions with buyer protection"
              className="w-full h-auto max-w-lg mx-auto"
              width="500"
              height="500"
            />
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-12 flex flex-col items-center animate-bounce">
          <p className="text-sm text-secondary-500 mb-2">Explore more</p>
          <svg
            className="w-6 h-6 text-primary-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>

        {/* Integration Callout */}
        <div className="mt-12">
          {/* E-commerce Integration */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-8 hover:border-green-300 hover:shadow-lg transition-all">
            <div className="text-center">
              <h3 className="text-2xl sm:text-3xl font-bold text-secondary-900 mb-3">
                E-commerce Integration
              </h3>
              <p className="text-base sm:text-lg text-secondary-700 mb-6">
                WordPress & Shopify plugins • JavaScript SDK for any website • Built-in buyer protection • 1% fee
              </p>
              <Link href="/plugins">
                <div className="inline-flex bg-green-500 text-white px-6 py-3 rounded-lg font-semibold items-center gap-2 hover:bg-green-600 transition-colors text-base sm:text-lg cursor-pointer">
                  View Integration Options
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <div className="mt-4">
                <Link href="/plugins#wordpress-heading" className="text-primary-600 hover:text-primary-700 font-medium text-sm sm:text-base inline-flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  Watch the plugin demo
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Open Source Trust Section */}
        <section className="mt-32 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-12" aria-label="Open Source Security">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold text-secondary-900 mb-4">Open Source</h2>
              <p className="text-xl text-secondary-700">Don't trust us. Verify the code yourself.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                  Every Line of Code is Public
                </h3>
                <p className="text-secondary-600">All smart contracts, frontend, and backend code is on GitHub. No hidden fees, no backdoors, no secrets.</p>
              </div>

              <div className="bg-white rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Community Audited
                </h3>
                <p className="text-secondary-600">Developers worldwide can review our code. Bugs get found and fixed faster than closed-source alternatives.</p>
              </div>

              <div className="bg-white rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Blockchain Security
                </h3>
                <p className="text-secondary-600">Smart contracts are immutable and on-chain. What you see is what you get - no surprises, no changes.</p>
              </div>

              <div className="bg-white rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-semibold text-secondary-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Fork It, Modify It, Own It
                </h3>
                <p className="text-secondary-600">MIT licensed. Run your own instance, customize it, or contribute improvements back to the community.</p>
              </div>
            </div>

            <div className="text-center">
              <a
                href="https://github.com/conduit-ucpi"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-4 bg-secondary-900 hover:bg-secondary-800 text-white font-semibold rounded-lg transition-colors text-lg"
              >
                <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View Source Code on GitHub
              </a>
              <p className="text-sm text-secondary-600 mt-4">Read every line. Audit the security. Trust through transparency.</p>
            </div>
          </div>
        </section>

        {/* Interactive Demo Section */}
        <section className="mt-32" id="how-it-works" aria-label="How Conduit Escrow Works">
          <InteractiveDemo />
        </section>

        <section className="mt-32" aria-label="Escrow Process Steps">
        <h2 className="text-3xl font-bold text-secondary-900 dark:text-white text-center mb-12">
          Simple 3-Step Escrow Process
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
            <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Seller creates payment request</h3>
            <p className="text-secondary-600 leading-relaxed">with delivery timeframe</p>
          </div>

          <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
            <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Buyer puts funds in secure trust</h3>
            <p className="text-secondary-600 leading-relaxed">Money goes into secure trust, not directly to seller</p>
          </div>

          <div className="bg-white border border-secondary-200 rounded-lg p-8 hover:border-primary-300 hover:shadow-lg transition-all">
            <div className="w-16 h-16 bg-primary-500 text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-3">Automatic payout to seller</h3>
            <p className="text-secondary-600 leading-relaxed">Seller receives payment at pre-agreed date & time. Disputed transactions held in trust until resolution.</p>
          </div>
        </div>
        </section>

        {!isConnected && (
          <>
            {/* What You Get Section */}
            <section className="mt-32 bg-secondary-50 rounded-2xl p-12" aria-label="Benefits and Features">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-secondary-900 mb-4">What you get</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">All the protection of traditional escrow</p>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">Set up in 60 seconds, not 60 days</p>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">No legal fees, contracts, or bank meetings</p>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">Payment releases automatically on the agreed date</p>
                </div>

                <div className="flex items-start space-x-4 md:col-span-2">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-secondary-700 text-lg leading-relaxed">If there's a problem, buyer hits "dispute", funds stay held in trust until buyer and seller can agree on refund amount in auto-dispute system</p>
                </div>
              </div>
            </section>

            {/* Cost Section */}
            <section className="mt-32" aria-label="Pricing">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-secondary-900 mb-4">Cost</h2>
              </div>

              <div className="bg-white border border-secondary-200 rounded-lg p-8 max-w-2xl mx-auto hover:border-primary-300 hover:shadow-lg transition-all">
                <div className="text-center space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-secondary-700">Transaction fee</span>
                    <span className="text-2xl font-bold text-primary-600">1%</span>
                  </div>
                  <div className="border-t border-secondary-200 pt-6">
                    <p className="text-primary-600 font-semibold">Free testing with $0.001 payments</p>
                    <p className="text-sm text-secondary-600 mt-1">Try it risk-free first</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Contact Section */}
            <section className="mt-32" aria-label="Contact Information">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-secondary-900 mb-4">Questions?</h2>
              </div>

              <div className="bg-white border border-secondary-200 rounded-lg p-8 max-w-2xl mx-auto hover:border-primary-300 hover:shadow-lg transition-all">
                <div className="text-center space-y-4">
                  <p className="text-lg text-secondary-700">Need help or have questions?</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <a 
                      href="mailto:info@conduit-ucpi.com"
                      className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      Contact Us
                    </a>
                    <Link href="/faq">
                      <Button variant="outline" className="border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white">
                        View FAQ
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Final CTA */}
            <section className="mt-32" aria-label="Get Started">
              <div className="text-center bg-primary-50 border border-primary-200 rounded-lg p-12 hover:border-primary-300 hover:shadow-lg transition-all">
                <h2 className="text-3xl font-bold text-secondary-900 mb-4">You've been using the "hope for the best" system.</h2>
                <p className="text-2xl text-primary-600 font-semibold mb-4">
                  Time to upgrade.
                </p>
                <p className="text-lg text-secondary-700 mb-8">
                  Start with just your email - no crypto wallet required
                </p>
                <ConnectWalletEmbedded
                  useSmartRouting={false}
                  showTwoOptionLayout={true}
                />
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-secondary-600">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    No wallet needed
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Email or social login
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Free testing
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    1% fee
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Open source
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
    </>
  );
}

// Static generation for SEO - pre-render this page at build time
export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600, // Revalidate every hour
  };
};