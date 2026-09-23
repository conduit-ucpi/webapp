/**
 * Everything the /landing-test-0N pages say and link to, in one place.
 *
 * The five pages are an A/B of *presentation*: each borrows a different look from
 * Stripe, Mercury and Wise. They must be functionally identical so that a visitor's
 * behaviour, not a missing button, is what differs between them. Sharing the copy and
 * the link targets is what keeps that true — and __tests__/pages/landing-test.test.tsx
 * checks every page against this inventory.
 */

export const DEMO_SELLER = '0x4f118f99a4e8bb384061bcfe081e3bbdec28482d';
export const VIDEO_URL = 'https://youtu.be/uUSlf3FmazQ';
export const SOURCE_URL = 'https://github.com/conduit-ucpi/contracts';
export const API_DOC_URL = 'https://api.stabledrop.me/api/ap2/settle/doc';
export const MCP_URL = 'https://api.stabledrop.me/api/ap2/mcp';
export const WORDPRESS_PLUGIN_URL = 'https://wordpress.org/plugins/usdc-payments-with-buyer-protection/';
export const CONTACT_EMAIL = 'info@conduit-ucpi.com';

/**
 * "Make payment" — paying someone rather than asking to be paid. The flow does not exist
 * yet; the landings carry the button so the option is on the page from day one. Change
 * this in one place when the route lands (it 404s until then).
 */
export const MAKE_PAYMENT_HREF = '/pay';

/** The live checkout, exactly as landing7 opens it: a real $0.001 USDC payment to the demo seller. */
export function demoCheckoutUrl(origin: string): string {
  const returnUrl = encodeURIComponent(`${origin}/checkout-example.html`);
  return (
    `${origin}/contract-create?seller=${DEMO_SELLER}&amount=0.001` +
    `&description=Basic+Product+-+One-time+Payment&tokenSymbol=USDC` +
    `&order_id=BASIC-1772027291139&epoch_expiry=1772632091&return=${returnUrl}`
  );
}

export interface NavLink {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavLink[];
}

/** Stripe/Mercury-style top bar: Products / Solutions / Developers / Resources + Pricing. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Products',
    items: [
      { label: 'Request payment', href: '/create', description: 'Ask to be paid, into escrow until the payout date' },
      { label: 'Make payment', href: MAKE_PAYMENT_HREF, description: 'Pay someone, by email, with the right to dispute' },
      { label: 'Dashboard', href: '/dashboard', description: 'Every payment you have sent or requested' },
      { label: 'Liquidity marketplace', href: '/liquidity', description: 'Buy locked payments early, at a discount' },
      { label: 'Early payment', href: '/early-payment-offer', description: 'Sell an escrowed invoice for cash today' },
      { label: 'Projects', href: '/projects', description: 'Milestone escrow for multi-party work' },
    ],
  },
  {
    label: 'Solutions',
    items: [
      { label: 'Online stores', href: '/merchant', description: 'WordPress, Shopify or any site' },
      { label: 'Person to person', href: '/p2p', description: 'Sell to a stranger without the risk' },
      { label: 'B2B invoices', href: '/b2b', description: 'Get paid on day one' },
      { label: 'AI agents', href: '/plugins#mcp', description: 'Let an agent pay with a human veto' },
    ],
  },
  {
    label: 'Developers',
    items: [
      { label: 'Integrations', href: '/plugins', description: 'Plugins and the one-line SDK' },
      { label: 'JavaScript SDK', href: '/integrate', description: 'No backend required' },
      { label: 'WordPress plugin', href: WORDPRESS_PLUGIN_URL, external: true },
      { label: 'Shopify', href: '/shopify/install-button' },
      { label: 'API reference', href: API_DOC_URL, external: true },
      { label: 'Source code', href: SOURCE_URL, external: true },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Arbitration policy', href: '/arbitration-policy' },
      { label: 'Demos', href: '/demos' },
    ],
  },
];

export const NAV_PRICING: NavLink = { label: 'Pricing', href: '#pricing' };

export const PROOF_POINTS = ['1% flat fee', 'No vetting', 'Put a checkout on your site in 10 minutes'] as const;

export const HOW_IT_WORKS = [
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
];

/** Mercury's "stop losing money to fees": what a processor takes, side by side. */
export const MERCHANT_POINTS = [
  { label: 'No chargebacks', text: 'Disputes are negotiated between buyer and seller. No chargeback fees, no limits, no penalties on your account.' },
  { label: 'No floats', text: 'Your money is never held by a payment processor. Funds go straight from escrow to your wallet on the payout date.' },
  { label: 'No freezes', text: 'Transactions run on smart contracts. They execute even if our servers go down — nobody can freeze your funds.' },
  { label: 'No vetting', text: 'No KYC, no KYB, no applications, no approval process. Install and start accepting payments immediately.' },
  { label: 'Put a checkout on your site in 10 minutes', text: 'WordPress plugin, Shopify plugin, or one line of JavaScript. No admin approval needed. A one-off payment request takes a few clicks.' },
  { label: 'Significant savings', text: '1% flat fee vs. 1.5-3.5% + monthly fees + chargeback fees + float costs with traditional processors.' },
];

export const FEE_COMPARISON = [
  { item: 'Processing fee', processor: '1.5–3.5% + $0.30', us: '1%' },
  { item: 'Monthly fee', processor: '$0–$30', us: 'None' },
  { item: 'Chargeback fee', processor: '$15–$25 each', us: 'None' },
  { item: 'Rolling reserve', processor: '20–30% held', us: 'None' },
  { item: 'Settlement', processor: '2–3 days', us: 'Seconds, on payout date' },
  { item: 'Approval', processor: 'Days of KYB', us: 'None' },
];

export const BUYER_POINTS = [
  { label: 'Buyer protection on every payment', text: 'Funds are held in escrow until a pre-agreed date. If something goes wrong, raise a dispute before payout to freeze the funds. Works on P2P payments too.' },
  { label: 'Gas-free transactions', text: "You don't need to hold ETH or any native coin. The system covers gas fees in the background." },
  { label: 'Automatic network and wallet', text: 'No choosing networks, no copying wallet addresses. Sign in with Google or email and pay. The system handles the rest.' },
  { label: 'Non-custodial', text: 'The smart contract holds funds — they can only go to buyer or seller. Nobody else can touch them, not even us.' },
];

export const AGENT_INTRO =
  'Stabledrop ships as an MCP server. Connect it to Claude, ChatGPT, Cursor or any MCP client and your agent can prepare, settle and verify escrow payments in plain conversation.';

export const AGENT_POINTS = [
  { label: 'Pay an email address', text: 'Name the seller, or whoever may dispute, by email. The agent never needs to know a wallet address.' },
  { label: 'The server holds no key', text: 'It is handed a signed authorisation or the funds land at the address directly. An agent can no more move your money than a stranger can.' },
  { label: 'A person keeps the veto', text: 'Only the named buyer can dispute. Not the agent that paid, not whoever holds the receipt.' },
  { label: 'Signed receipt', text: 'Every settlement returns an AP2 receipt that anyone can verify, naming the payout and the fee.' },
  { label: 'No credential required', text: 'Streamable HTTP, no API key, no sign-up. The escrow address is a pure function of its terms, so there is nothing to authenticate.' },
  { label: 'Discoverable', text: 'Listed in the official MCP registry and published at /.well-known/mcp.json, so agents can find it on their own.' },
];

export const PRICING_ROWS = [
  ['Setup costs', 'None'],
  ['Monthly fees', 'None'],
  ['Chargeback fees', 'None'],
  ['Merchant floats', 'None'],
  ['Minimum volume', 'None'],
  ['Vetting / KYB', 'None'],
  ['Testing', 'Free'],
] as const;

/** Stripe's closing "benefit quotes" strip — outcomes, not features. */
export const BENEFITS = [
  { title: 'Get paid without a processor', text: 'No application, no reserve, no one between your customer and your wallet.' },
  { title: 'Keep every chargeback', text: 'A dispute freezes the funds; it never takes them back out of your account with a fee attached.' },
  { title: 'Sell to people who cannot pay by card', text: 'Anyone with an email address can pay from anywhere, in a currency that holds its value.' },
  { title: 'Put a checkout on your site in ten minutes', text: 'A plugin, one script tag, or one MCP URL — and a free $0.001 test before you commit.' },
];

export type AudienceKey = 'personal' | 'business' | 'platform';

export interface UseCase {
  title: string;
  text: string;
  href: string;
  cta: string;
}

/** Wise's Personal / Business / Platform switch, with industries and use cases under each. */
export const AUDIENCES: Array<{ key: AudienceKey; label: string; headline: string; cases: UseCase[] }> = [
  {
    key: 'personal',
    label: 'Personal',
    headline: 'Pay a stranger, a friend abroad, or a freelancer — and keep the right to object.',
    cases: [
      { title: 'Buying from someone you have never met', text: 'Marketplace purchases, second-hand goods, tickets. Funds only release once you have had time to check.', href: '/p2p', cta: 'Person to person' },
      { title: 'Friends and family across borders', text: 'Send stablecoins anywhere for one percent, no correspondent bank, no three-day wait.', href: '/create', cta: 'Send a payment' },
      { title: 'Freelancers getting paid', text: 'Request payment up front into escrow. Your client is protected until the payout date; you know the money is there.', href: '/create', cta: 'Request payment' },
      { title: 'A currency that holds its value', text: 'Where the local currency is unstable, a dollar-pegged stablecoin is a place to hold savings and a way to get paid.', href: '/how-it-works', cta: 'How it works' },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    headline: 'From a first online store to a fifty-thousand-dollar invoice.',
    cases: [
      { title: 'Online stores', text: 'A WordPress or Shopify plugin, or one script tag on any site. Checkout with buyer protection, no chargebacks.', href: '/merchant', cta: 'For merchants' },
      { title: 'Startups paying contractors', text: 'Pay by email address, with a payout date the contractor can see. No bank onboarding for either side.', href: '/create', cta: 'Request payment' },
      { title: 'B2B invoices, paid on day one', text: 'Your customer funds the invoice into escrow up front; you sell the claim for cash today and keep the tail.', href: '/early-payment-offer', cta: 'Early payment' },
      { title: 'Enterprise and high-value work', text: 'Milestone escrow for complex projects, with an arbitration policy and a dispute window on every stage.', href: '/projects', cta: 'Projects' },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    headline: 'Embed escrow in your product, your marketplace, or your agent.',
    cases: [
      { title: 'Embed in your platform', text: 'The JavaScript SDK opens the checkout from any button; results come back to your webhook. No backend required.', href: '/integrate', cta: 'JavaScript SDK' },
      { title: 'AI agents', text: 'One MCP URL. The agent prepares, settles and verifies; a named person keeps the veto.', href: '/plugins#mcp', cta: 'Connect your agent' },
      { title: 'Liquidity providers', text: 'Buy locked payments at a discount and collect in full at maturity. A yield with a known date.', href: '/liquidity', cta: 'Liquidity marketplace' },
      { title: 'Large, complex infrastructure', text: 'Open-source contracts on Base, non-custodial by construction. Audit the code, not our promises.', href: SOURCE_URL, cta: 'Source code' },
    ],
  },
];

/** Wise's "works everywhere": the kinds of people this is for, in one line each. */
export const EVERYWHERE = [
  'Countries where the local currency will not hold its value',
  'Cross-border payments between friends and family',
  'Startups and freelancers without a merchant account',
  'Enterprise and high-value contracts with a dispute window',
  'Large, complex infrastructure that needs open-source rails',
];

export type EmbedKey = 'javascript' | 'wordpress' | 'shopify' | 'mcp';

export interface EmbedExample {
  key: EmbedKey;
  label: string;
  intro: string;
  code: string;
  language: string;
  link: NavLink;
}

export const EMBED_EXAMPLES: EmbedExample[] = [
  {
    key: 'javascript',
    label: 'Any website',
    intro: 'Three lines. The SDK opens the checkout and tells your page when the payment lands.',
    language: 'html',
    code: `<script src="https://conduit-ucpi.com/sdk/checkout.js"></script>

<button id="checkout-btn">Pay with USDC</button>

<script>
  ConduitCheckout.init({
    amount: 99.99,
    description: "Product Name",
    onSuccess: (txHash) => console.log("Paid:", txHash)
  });
</script>`,
    link: { label: 'Integration guide', href: '/integrate' },
  },
  {
    key: 'wordpress',
    label: 'WordPress',
    intro: 'Install the plugin from wordpress.org, paste your wallet address, and USDC appears as a payment method at checkout.',
    language: 'text',
    code: `Plugins → Add New → "USDC Payments with Buyer Protection"
Settings → Payments → USDC
  Wallet address:  0x…your wallet
  Payout delay:    1 day after delivery
Save. Done.`,
    link: { label: 'Get the plugin', href: WORDPRESS_PLUGIN_URL, external: true },
  },
  {
    key: 'shopify',
    label: 'Shopify',
    intro: 'One click installs the app on your store. Orders paid in stablecoin sit in escrow until the payout date you choose.',
    language: 'text',
    code: `Install the Stabledrop app
  → Connect your wallet
  → Choose a payout delay
  → Enable at checkout

Every order paid this way carries buyer protection,
and none of them can be charged back.`,
    link: { label: 'Install on Shopify', href: '/shopify/install-button' },
  },
  {
    key: 'mcp',
    label: 'AI agents (MCP)',
    intro: 'One URL, no API key. Your agent gets tools to prepare an escrow payment, settle it, and verify the receipt.',
    language: 'bash',
    code: `# Claude Code
claude mcp add --transport http stabledrop ${MCP_URL}

# Cursor, Windsurf, any JSON config
{
  "mcpServers": {
    "stabledrop": { "url": "${MCP_URL}" }
  }
}`,
    link: { label: 'MCP setup', href: '/plugins#mcp' },
  },
];

export const FOOTER_LINKS: NavLink[] = [
  { label: 'Source code', href: SOURCE_URL, external: true },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Integrations', href: '/plugins' },
  { label: 'API & MCP', href: '/plugins#mcp' },
  { label: 'Terms of Service', href: '/terms-of-service' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
];

export const SEO_TITLE = 'Conduit Escrow - Stablecoin Payments with Buyer Protection';
export const SEO_DESCRIPTION =
  'Stablecoin checkout with buyer protection. No chargebacks, no floats, no freezes, no vetting. 1% flat fee. Put a checkout on your site in 10 minutes. Gas-free transactions. Open source escrow on Base.';
export const SEO_KEYWORDS =
  'open source escrow, crypto escrow, blockchain escrow, USDC escrow, secure crypto payments, buyer protection, smart contract escrow, Base network escrow, MCP server, AI agent payments, agentic payments';

/** What actually happens when something goes wrong — the question every buyer asks first. */
export const DISPUTE_FLOW = [
  { title: 'Buyer raises a dispute', text: 'Any time before the payout date, with a comment and a suggested refund. The funds freeze.' },
  { title: 'Seller is told', text: 'By email, straight away. Both sides see the same case in their dashboard.' },
  { title: 'They agree a number', text: 'Refund proposals go back and forth. The moment both enter the same amount, it executes.' },
  { title: 'Nobody agreed?', text: 'Funds stay frozen. Either side can bring in an arbiter; both enter the decided amount and it settles.' },
];

/** Why a dollar-pegged stablecoin, in plain terms, for people who have not used one. */
export const WHY_STABLECOINS = [
  { title: 'It is a dollar', text: 'USDC and USDT hold one US dollar each. No volatility to price in, no conversion on the way out.' },
  { title: 'It moves in seconds', text: 'Base settles in about two seconds and the fee is a fraction of a cent. We cover it.' },
  { title: 'It goes anywhere', text: 'No correspondent bank, no country list. If the other side has an email address, you can pay them.' },
  { title: 'You can program it', text: 'Which is the whole point: money that can wait for a date, and only go to one of two people.' },
];

export const FAQ_SHORT = [
  { q: 'Do I need a wallet or any crypto?', a: 'No. Sign in with Google or email and a wallet is created for you. Gas is covered, so you never need ETH.' },
  { q: 'Can a buyer just take the money back?', a: 'No. A dispute freezes the funds; it never moves them. Release needs the payout date or an agreed number.' },
  { q: 'Who holds the money while it is locked?', a: 'A smart contract on Base whose code is public. It can pay the buyer or the seller and nobody else, including us.' },
  { q: 'What does it cost?', a: '1% of the amount, with a $0.30 minimum. No setup, monthly, chargeback or reserve costs. Testing is free.' },
  { q: 'How do I get paid early?', a: 'Sell the locked payment on the liquidity marketplace at a small discount and collect cash today.' },
];

/**
 * The headline promise without the rail it runs on: fiat on-ramps are close, so the pages
 * from 11 on say "get paid" and leave "stablecoin" to the detail.
 */
export const SEO_TITLE_GETPAID = 'Get paid with buyer protection. No chargebacks. 1%.';
export const SEO_DESCRIPTION_GETPAID =
  'Request a payment in a few clicks or put a checkout on your site in 10 minutes. Funds sit in escrow until the payout date: the buyer is protected, you cannot be charged back. 1% flat, no vetting, open source.';

/** Hover definitions for the words that do the work. */
export const GLOSSARY: Record<string, string> = {
  escrow: 'A smart contract that holds the money and can only pay the buyer or the seller. Nobody else, including us.',
  'payout date': 'The date both sides agreed. On that day the seller is paid automatically, unless a dispute froze the funds first.',
  dispute: 'The buyer can raise one any time before the payout date. It freezes the funds; it never moves them.',
  gas: 'The network fee for a transaction on Base. We cover it, so the buyer never needs ETH.',
  MCP: 'Model Context Protocol: the standard that lets an AI agent use tools. One URL gives any agent ours.',
  chargeback: 'A card reversal after the fact, with a fee attached. There is no equivalent here: a dispute can only freeze, never claw back.',
};

/**
 * Pricing as a comparison. The left column is what a card processor charges for the same
 * line; the figures are the ones the FAQ and the savings calculator already use. Row labels
 * include every PRICING_ROWS label so the two tables say the same things.
 */
export const PRICING_COMPARISON: ReadonlyArray<{ item: string; traditional: string; us: string }> = [
  { item: 'Processing fee', traditional: '1.5–3.5% + $0.30', us: '1% ($0.30 minimum)' },
  { item: 'Setup costs', traditional: 'Gateway and PCI setup', us: 'None' },
  { item: 'Monthly fees', traditional: '$0–$30 plus PCI compliance', us: 'None' },
  { item: 'Chargeback fees', traditional: '$15–$25 each', us: 'None' },
  { item: 'Merchant floats', traditional: '20–30% held in reserve', us: 'None' },
  { item: 'Minimum volume', traditional: 'Monthly minimums', us: 'None' },
  { item: 'Vetting / KYB', traditional: 'Days of applications', us: 'None' },
  { item: 'Settlement', traditional: '2–3 days', us: 'Seconds, on the payout date' },
  { item: 'Testing', traditional: 'Sandbox, separate keys', us: 'Free: a real $0.001 payment' },
];
