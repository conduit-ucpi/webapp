/**
 * Copy owned by this deployment's own pages, in the source language.
 *
 * Distinct from the SDK catalogue, which covers the product surfaces the SDK
 * ships (the wizard, the dashboard, the payer pages). Anything in here is copy
 * a different tenant would write differently, so it stays on our side of the
 * line rather than being inherited by everyone who installs the SDK.
 *
 * Keys are namespaced by page. Add a namespace when you add a page; the Spanish
 * file is typed against this one, so a key added here without a translation is
 * a compile error rather than a string that quietly renders in English.
 *
 * `{brand}` and friends are filled by interpolate() at call time — never
 * concatenate around a translated string, because word order is not the same in
 * every language.
 */

export const pagesEn = {
  // /create-cobro — the white-labelled create page. Generic wording: the brand
  // name is interpolated, so this same copy serves any pinned partner route.
  'wl.badge': 'Protected payment · settled in USDC on Base',
  'wl.dashboard': 'Dashboard',

  'wl.loadingTitle': 'Create a payment request',
  'wl.loadingSubtitle': 'Setting things up…',

  'wl.connectTitle': 'Get started with {brand}',
  'wl.connectSubtitle':
    'We use a wallet to securely send and receive your payments. Sign in with Google or an email address and one is created for you.',

  'wl.createTitle': 'Time-locked payment request',
  'wl.createSubtitle':
    'Set an amount and a release date. The buyer pays into a protected payment, disputes stay open until that date, and the funds then move to you automatically.',

  'wl.howTitle': 'How this works',
  'wl.howStep1': 'You set the amount, stablecoin, and release terms',
  'wl.howStep2': 'The buyer pays into a protected payment – funds are held but not sent to you yet',
  'wl.howStep3':
    'Funds release to your wallet automatically on the release terms you set',

  'wl.assuranceFee': '1% flat fee',
  'wl.assuranceChargebacks': 'No chargebacks',
  'wl.assuranceGas': 'Gas paid for you',
  'wl.assuranceCustody': 'Non-custodial',

  'wl.footerTerms': 'Terms',
  'wl.footerPrivacy': 'Privacy',
  'wl.footerDisputes': 'Disputes',

  'wl.seoTitle': '{brand} — create a payment request',
  'wl.seoDescription':
    'Set an amount and a payout date. The buyer pays into a protected payment, and the funds release automatically on the date you both agreed.',

  // /integrate — the developer integration guide. Code samples, field names and
  // identifiers stay in the page and are never translated; `{name}` placeholders
  // here stand for inline code or links, so a sentence stays whole and each
  // language puts them where its own word order wants them.
  'integrate.seo.title':
    'Integration Guide — Add Stablecoin Checkout to Your Website | {siteName}',
  'integrate.seo.description':
    'Add protected stablecoin payments to your website in minutes. No backend required. 1% fee, payment protection, webhook support.',
  'integrate.seo.keywords':
    'integrate crypto payments, USDC checkout widget, stablecoin payment integration, escrow checkout, accept crypto payments website',

  'integrate.copy': 'Copy',
  'integrate.copied': 'Copied to clipboard',
  'integrate.yes': 'Yes',
  'integrate.no': 'No',
  'integrate.apiReference': 'API reference',
  'integrate.col.option': 'Option',
  'integrate.col.parameter': 'Parameter',
  'integrate.col.field': 'Field',
  'integrate.col.type': 'Type',
  'integrate.col.required': 'Required',
  'integrate.col.default': 'Default',
  'integrate.col.description': 'Description',
  'integrate.col.meaning': 'Meaning',

  'integrate.hero.ariaLabel': 'Hero',
  'integrate.hero.eyebrow': 'Integration Guide',
  'integrate.hero.title': 'Add stablecoin checkout to your website.',
  'integrate.hero.subtitle':
    'Include one script, configure your wallet, and start accepting payments. No backend integration required.',
  'integrate.hero.setup': '3-step setup',
  'integrate.hero.noBackend': 'No backend required',
  'integrate.hero.webhooks': 'Webhook support',
  'integrate.hero.liveDemo': 'Live demo',

  'integrate.quick.eyebrow': 'Quick start',
  'integrate.quick.title': 'Three steps to accepting payments.',
  'integrate.quick.subtitle':
    'No backend integration required. Add the script, configure your wallet, and create payment buttons.',
  'integrate.quick.step1.title': 'Include the script',
  'integrate.quick.step1.body': 'Add this line just before the closing {tag} tag.',
  'integrate.quick.step2.title': 'Initialize with your wallet',
  'integrate.quick.step2.body': 'Configure the checkout with your merchant wallet address.',
  'integrate.quick.step3.title': 'Add payment buttons',
  'integrate.quick.step3.body': 'Create buttons that open the checkout.',

  'integrate.modes.eyebrow': 'Display modes',
  'integrate.modes.title': 'Choose how checkout appears.',
  'integrate.modes.tab.popup': 'Popup Window',
  'integrate.modes.tab.redirect': 'Full Redirect',
  'integrate.modes.popup.title': 'Popup window',
  'integrate.modes.popup.body':
    'Opens in a centered popup. Best for minimal disruption to the shopping experience.',
  'integrate.modes.redirect.title': 'Full redirect',
  'integrate.modes.redirect.body':
    'Redirects to checkout page. Best for mobile devices and single-product flows.',

  'integrate.examples.eyebrow': 'Examples',
  'integrate.examples.title': 'Common integration patterns.',
  'integrate.examples.tab.basic': 'Basic Payment',
  'integrate.examples.tab.extended': 'Extended Protection',
  'integrate.examples.tab.custom': 'Custom Amount',
  'integrate.examples.tab.usdt': 'USDT Payment',
  'integrate.examples.basic.title': 'Basic product payment',
  'integrate.examples.basic.body': 'Simple checkout for a single product with order tracking.',
  'integrate.examples.extended.title': 'Extended buyer protection',
  'integrate.examples.extended.body':
    'Set a longer protection period for services or high-value items.',
  'integrate.examples.custom.title': 'Custom amount (donations, tips)',
  'integrate.examples.custom.body': 'Let the user enter their own amount before checkout.',
  'integrate.examples.usdt.title': 'Accept USDT instead of USDC',
  'integrate.examples.usdt.body': 'Override the default token on a per-payment basis.',

  'integrate.reference.ariaLabel': 'Configuration reference',
  'integrate.reference.eyebrow': 'Reference',
  'integrate.reference.title': 'Configuration options.',
  'integrate.init.sellerAddress': 'Your wallet address to receive payments',
  'integrate.init.baseUrl': 'Base URL of checkout page',
  'integrate.init.brand':
    "A white-label partner's brand id: the checkout shows its branding and payments are attributed to it",
  'integrate.init.webhookUrl': 'Webhook URL for payment verification',
  'integrate.init.webhookSecret':
    'Optional HMAC secret for webhook signatures. Set in the browser, so confirm against /api/results before fulfilling',
  'integrate.init.tokenSymbol': "'USDC' or 'USDT'",
  'integrate.init.expiryDays': 'Days until auto-release to seller',
  'integrate.init.mode': "'popup' or 'redirect'",
  'integrate.init.onSuccess': 'Callback when payment completes',
  'integrate.init.onError': 'Callback when payment fails',
  'integrate.init.onCancel': 'Callback when user cancels',
  'integrate.open.amount': "Payment amount (e.g., '50.00')",
  'integrate.open.description': 'Payment description (max 160 chars)',
  'integrate.open.orderId': 'Your internal order/transaction ID',
  'integrate.open.email': 'Customer email address',
  'integrate.open.tokenSymbol': 'Override default token for this payment',
  'integrate.open.expiryDays': 'Override default expiry',
  'integrate.open.webhookUrl': 'Override webhook URL for this payment',
  'integrate.open.metadata': 'Custom metadata to include',

  'integrate.server.ariaLabel': 'Server-side payments',
  'integrate.server.eyebrow': 'Server-side',
  'integrate.server.title': 'No script: prepare, fund, settle.',
  'integrate.server.intro':
    'With a backend you can skip the checkout script. Call {prepare} with the terms; it answers with where the money goes, how to fund it, a link that opens the payment for your customer, and the exact request that creates the protected payment once paid. No sign-in or API key is needed.',
  'integrate.server.step1.title': 'Prepare the payment',
  'integrate.server.step1.body':
    "Amounts are in the token's base units (1 USDC = 1000000). The seller and buyer may be wallets or email addresses; the buyer is who can dispute.",
  'integrate.server.step2.title': 'Get paid',
  'integrate.server.step2.body':
    'Send your customer {payLink} (or a QR of it): it opens this exact payment, and they pay by wallet, card or transfer. Or fund {escrowAddress} yourself using {fundByTransfer}.',
  'integrate.server.step3.title': 'Settle',
  'integrate.server.step3.body':
    "Once the money has arrived, send the request in the answer's {settle} block, unchanged: {settleRequest}. It creates the protected payment and returns a signed receipt. Sent too early, it says what the address holds and spends nothing; if you never send it, a funded payment is still activated within about 30 minutes.",
  'integrate.server.step3.reference': 'Every field is described in the {link}.',

  'integrate.webhook.ariaLabel': 'Webhook integration',
  'integrate.webhook.eyebrow': 'Backend integration',
  'integrate.webhook.title': 'Webhook-based order fulfillment.',
  'integrate.webhook.intro':
    'Get told when a payment completes, then confirm it yourself. The webhook says something happened; {results} is the source of truth, and it is a public endpoint you can query from your server with no key and no setup.',
  'integrate.webhook.step1.title': 'Configure SDK with webhook',
  'integrate.webhook.step1.body':
    'The SDK handles verification and webhook delivery automatically. No manual {fetch} calls needed.',
  'integrate.webhook.step2.title': 'Confirm it, then fulfil',
  'integrate.webhook.step2.body':
    'Ask {results} what really happened before you ship anything. It reads the same record the checkout polls, so it settles the amount, the currency and who was paid — and a request that never arrives changes nothing.',
  'integrate.webhook.step3.title': 'Check a payment yourself',
  'integrate.webhook.step3.body':
    'The same query, on its own. Public, unauthenticated, no key to request — give it a {contractid} and it tells you what was paid and to whom. Useful for reconciliation, for support, and for replaying anything a webhook missed.',
  'integrate.webhook.step3.openapi':
    'The full request and response schema is published as an OpenAPI document: {link}. Point your OpenAPI tooling at it to generate a client.',
  'integrate.webhook.step3.response': 'Response:',
  'integrate.webhook.payloadTitle': 'Webhook payload',

  'integrate.results.queryTitle': 'Query fields',
  'integrate.results.query.contractid': 'Exact match on the contract id the checkout returns',
  'integrate.results.query.chainAddress': 'Exact match on the payment address',
  'integrate.results.query.chainAddresses':
    'The batch form. OR within the list, so one round trip fills in a whole page of contracts instead of one call each. Case-insensitive, because addresses read from event logs are lower case while records may be checksummed',
  'integrate.results.query.sellerWalletId':
    'Matches seller OR buyer, case-insensitively — this is how you list everything paid to your wallet',
  'integrate.results.queryNote':
    'All optional, but at least one is required — an empty body returns 400. Multiple fields combine with AND.',
  'integrate.results.responseTitle': 'Response fields',
  'integrate.results.response.contractid': 'The contract id',
  'integrate.results.response.chainAddress':
    'The payment address. Assigned when the buyer opens the payment page, so its presence says nothing about whether they paid — read state for that',
  'integrate.results.response.sellerWalletId': 'Who gets paid. Compare against your own wallet',
  'integrate.results.response.amount':
    'In the units of currency below, so divide by 1,000,000 for a micro currency',
  'integrate.results.response.description': 'What the payment was for',
  'integrate.results.response.currency':
    'e.g. microUSDC. There is no separate currencySymbol field',
  'integrate.results.response.state':
    'Whether the money arrived. ACTIVE, DISPUTED, RESOLVED, CLAIMED and COMPLETED all mean it did; treat anything else as not yet paid, including states you do not recognise',
  'integrate.results.response.chainId': 'e.g. 8453 for Base',
  'integrate.results.response.createdate': 'Unix seconds when the record was made',
  'integrate.results.response.maturity':
    'Unix seconds when the cashflow unlocks. Distinct from createdate',
  'integrate.results.note':
    "{countZero} means no such payment — treat it as unpaid, never as an error. You can also query by {chainAddress}, or by {sellerWalletId} to list everything paid to your wallet. Amounts in a {micro}-prefixed currency are in millionths, so divide by 1,000,000. {state} is the payment's lifecycle, not a pass/fail — a completed payment reads {claimed}, so check for the failure states rather than for one success value.",

  'integrate.verified.ariaLabel': 'Verified data',
  'integrate.verified.eyebrow': 'Verification',
  'integrate.verified.title': 'What verified data means.',
  'integrate.verified.verified': 'Backend confirmed payment exists in blockchain',
  'integrate.verified.state': 'Funds are locked in the payment contract',
  'integrate.verified.seller': 'Matches your wallet (verified by SDK)',
  'integrate.verified.amount': 'Matches expected amount (verified by SDK)',
  'integrate.verified.chainAddress': 'Blockchain contract address (permanent record)',
  'integrate.verified.note':
    'Once you receive verified data, it is safe to fulfil the order. The SDK has confirmed everything on-chain.',

  'integrate.platform.ariaLabel': 'Features and security',
  'integrate.platform.eyebrow': 'Platform',
  'integrate.platform.title': 'Built-in protection for every transaction.',
  'integrate.platform.buyer.label': 'Buyer protection',
  'integrate.platform.buyer.1': 'Funds held in a payment smart contract',
  'integrate.platform.buyer.2': 'Time-delayed release (default 7 days)',
  'integrate.platform.buyer.3': 'Dispute mechanism',
  'integrate.platform.buyer.4': 'Independent tiebreaker',
  'integrate.platform.gas.label': 'No gas fees',
  'integrate.platform.gas.1': 'Platform covers all blockchain fees',
  'integrate.platform.gas.2': 'Users pay 1% platform fee',
  'integrate.platform.gas.3': 'Minimum payment: $1.001',
  'integrate.platform.gas.4': 'Fee included in payment amount',
  'integrate.platform.security.label': 'Client-side security',
  'integrate.platform.security.1': 'Users sign with own wallet',
  'integrate.platform.security.2': 'No custody of user funds',
  'integrate.platform.security.3': 'HTTPS required',
  'integrate.platform.security.4': 'Open-source smart contracts',
  'integrate.platform.tokens.label': 'Multi-token support',
  'integrate.platform.tokens.1': 'USDC (default)',
  'integrate.platform.tokens.2': 'USDT (optional)',
  'integrate.platform.tokens.3': 'Base network (Ethereum L2)',
  'integrate.platform.tokens.4': 'Low transaction costs',

  'integrate.flow.ariaLabel': 'Customer experience',
  'integrate.flow.eyebrow': 'End-to-end flow',
  'integrate.flow.1.title': 'Customer clicks pay',
  'integrate.flow.1.desc': 'Opens checkout popup or redirect.',
  'integrate.flow.2.title': 'Wallet connects & pays',
  'integrate.flow.2.desc': 'Customer signs the transaction.',
  'integrate.flow.3.title': 'SDK verifies on-chain',
  'integrate.flow.3.desc': 'Automatic blockchain verification.',
  'integrate.flow.4.title': 'Webhook sent to backend',
  'integrate.flow.4.desc': 'Your server receives verified data.',
  'integrate.flow.5.title': 'Order fulfilled',
  'integrate.flow.5.desc': 'Ship goods, deliver product, send receipt.',

  'integrate.faq.eyebrow': 'FAQ',
  'integrate.faq.title': 'Frequently asked questions.',
  'integrate.faq.tokens.q': 'What tokens are supported?',
  'integrate.faq.tokens.a': 'Currently {currencies} on the Base network (Ethereum Layer 2).',
  'integrate.faq.fees.q': 'What are the fees?',
  'integrate.faq.fees.a':
    '1% platform fee per transaction. No setup costs, no monthly fees. Minimum payment is $1.001. Gas fees are covered by the platform.',
  'integrate.faq.payout.q': 'How long until I receive funds?',
  'integrate.faq.payout.a':
    'Funds are automatically released after the expiry period (default 7 days) unless the buyer raises a dispute. You can customize the expiry period per payment.',
  'integrate.faq.refunds.q': 'Can buyers get refunds?',
  'integrate.faq.refunds.a':
    'Buyers can raise a dispute within the protection period. Our admin team reviews disputes and can release funds to either party based on the evidence.',
  'integrate.faq.wallet.q': 'Do I need a crypto wallet?',
  'integrate.faq.wallet.a':
    'Yes, you need a wallet address to receive payments. We recommend MetaMask, Coinbase Wallet, or any Web3-compatible wallet. Buyers can use email + social login (we create embedded wallets for them).',
  'integrate.faq.secure.q': 'Is this secure?',
  'integrate.faq.secure.a':
    'Yes. Payments are secured by immutable smart contracts on the Base blockchain. Users sign transactions with their own wallets. All transactions are auditable on-chain. HTTPS is required for all integrations.',
  'integrate.faq.chargebacks.q': 'What about chargebacks?',
  'integrate.faq.chargebacks.a':
    'Cryptocurrency transactions are irreversible — there are no chargebacks like with credit cards. Protected payments give buyers protection through the dispute mechanism during the protection period.',

  'integrate.cta.ariaLabel': 'Get started',
  'integrate.cta.title': 'Ready to integrate?',
  'integrate.cta.body': 'Try the interactive demo or start integrating directly into your site.',
  'integrate.cta.demo': 'View Live Demo',
  'integrate.cta.merchant': 'Merchant Overview',
  'integrate.footer.howItWorks': 'How it works',
  'integrate.footer.faq': 'FAQ',
  'integrate.footer.shopify': 'Shopify integration',
  'integrate.footer.whiteLabel': 'White-label partners',
  'integrate.footer.source': 'Source code',

  // /api-keys — merchant API keys for their own backend.
  'apiKeys.title': 'API keys',
  'apiKeys.intro':
    'Let your own server create payment links, for example to send to customers on WhatsApp. Keep keys secret: anyone holding one can create payment requests in your name.',
  'apiKeys.signIn.eyebrow': 'API keys',
  'apiKeys.signIn.title': 'Sign in to manage your API keys.',
  'apiKeys.signIn.body': 'An API key lets your own server create payment links for your customers.',
  'apiKeys.wallet.title': 'Where your payments go',
  'apiKeys.wallet.body': 'Payments requested with these keys are paid into this wallet once they are released.',
  'apiKeys.wallet.copy': 'Copy address',
  'apiKeys.wallet.link': 'Go to your wallet to see your balance and withdraw your tokens',
  'apiKeys.wallet.none': 'Your account has no wallet yet. Finish setting up your account before creating a key.',
  'apiKeys.new.title': 'New key: {label}',
  'apiKeys.new.warning': "Copy this key now. You won't be able to see it again.",
  'apiKeys.new.copy': 'Copy key',
  'apiKeys.new.dismiss': "I've copied it, hide the key",
  'apiKeys.create.title': 'Create a key',
  'apiKeys.create.labelAria': 'Key label',
  'apiKeys.create.placeholder': 'e.g. WhatsApp bot',
  'apiKeys.create.help': 'A name to tell your keys apart. Up to 60 characters.',
  'apiKeys.create.submit': 'Create key',
  'apiKeys.create.submitting': 'Creating…',
  'apiKeys.list.title': 'Your keys',
  'apiKeys.list.empty': 'You have no API keys yet.',
  'apiKeys.list.retry': 'Try again',
  'apiKeys.list.meta': 'Created {created} · Last used {lastUsed}',
  'apiKeys.list.never': 'never',
  'apiKeys.revoke.button': 'Revoke',
  'apiKeys.revoke.confirm': 'Revoke this key?',
  'apiKeys.revoke.yes': 'Yes, revoke',
  'apiKeys.revoke.busy': 'Revoking…',
  'apiKeys.revoke.cancel': 'Cancel',
  'apiKeys.using.title': 'Using your key',
  'apiKeys.using.body':
    'Send your customer the {payLink} from the response. {amount} is in USDC base units (20000000 = 20 USDC), and {expiry} is when the dispute window closes (0 = instant).',
  'apiKeys.copy': 'Copy',
  'apiKeys.copied': 'Copied',
  'apiKeys.error.session': 'Your session has expired. Sign in again to manage your API keys.',
  'apiKeys.error.limit': 'You already have 10 keys. Revoke one first.',
  'apiKeys.error.noWallet':
    'Finish setting up your account first: your account needs a wallet before it can have API keys.',
  'apiKeys.error.gone': 'That key no longer exists. It may already have been revoked.',
  'apiKeys.error.create': 'Could not create the key',
  'apiKeys.error.load': 'Could not load your API keys',
  'apiKeys.error.revoke': 'Could not revoke the key',
} as const;

export type PagesMessageKey = keyof typeof pagesEn;
