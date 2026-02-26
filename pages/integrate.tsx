import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import toast from 'react-hot-toast';
import SEO from '@/components/SEO';
import Fade from '@/components/ui/Fade';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { btnPrimary, btnOutline } from '@/utils/landingStyles';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { useConfig } from '@/components/auth/ConfigProvider';
import WalletRegistrationPrereq from '@/components/ui/WalletRegistrationPrereq';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CodeBlock({ id, children, language = 'javascript' }: { id: string; children: string; language?: string }) {
  const copy = () => {
    navigator.clipboard.writeText(children);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="relative bg-secondary-50 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-md p-4 overflow-x-auto">
      <button
        onClick={copy}
        className={`${btnPrimary} absolute top-3 right-3 !py-1.5 !px-3 !text-xs`}
      >
        Copy
      </button>
      <code id={id} className="text-sm font-mono text-secondary-900 dark:text-secondary-100 whitespace-pre">
        {children}
      </code>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="text-[2.5rem] leading-none font-extralight text-secondary-100 dark:text-secondary-800 select-none block mb-3">
      {String(n).padStart(2, '0')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const exampleTabs = [
  { id: 'basic', label: 'Basic Payment' },
  { id: 'extended', label: 'Extended Protection' },
  { id: 'custom', label: 'Custom Amount' },
  { id: 'usdt', label: 'USDT Payment' },
];

const modeTabs = [
  { id: 'popup', label: 'Popup Window' },
  { id: 'redirect', label: 'Full Redirect' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegratePage() {
  const [exampleTab, setExampleTab] = useState('basic');
  const [modeTab, setModeTab] = useState('popup');

  const { config } = useConfig();
  const siteName = getSiteNameFromDomain();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz';

  const currencyList = config?.supportedTokens?.length
    ? config.supportedTokens.map(t => t.symbol).join('/')
    : config?.tokenSymbol || 'USDC';

  return (
    <>
      <SEO
        title={`Integration Guide — Add Stablecoin Checkout to Your Website | ${siteName}`}
        description="Add secure stablecoin escrow payments to your website in minutes. No backend required. 1% fee, escrow protection, webhook support."
        keywords="integrate crypto payments, USDC checkout widget, stablecoin payment integration, escrow checkout, accept crypto payments website"
        canonical="/integrate"
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
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32 w-full">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Integration Guide
              </p>
              <h1 className="text-4xl sm:text-5xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl">
                Add stablecoin checkout to your website.
              </h1>
              <p
                className="mt-6 text-base text-secondary-500 dark:text-secondary-400 max-w-xl leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Include one script, configure your wallet, and start accepting payments. No backend integration required.
              </p>
              <div className="mt-14 flex flex-wrap gap-x-8 gap-y-2 text-xs text-secondary-400 dark:text-secondary-500">
                <span>3-step setup</span>
                <span>No backend required</span>
                <span>Webhook support</span>
                <a href="/checkout-example.html" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors underline">Live demo</a>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PREREQUISITES                                                    */}
        {/* ================================================================ */}
        <WalletRegistrationPrereq />

        {/* ================================================================ */}
        {/* QUICK START                                                      */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Quick start"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Quick start
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Three steps to accepting payments.
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-12 max-w-md">
                No backend integration required. Add the script, configure your wallet, and create payment buttons.
              </p>
            </Fade>

            <div className="space-y-12">
              <Fade>
                <div>
                  <StepNumber n={1} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Include the script</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Add this line just before the closing <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">&lt;/body&gt;</code> tag.
                  </p>
                  <CodeBlock id="step1" language="html">
                    {`<script src="${origin}/conduit-checkout.js"></script>`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.1}>
                <div>
                  <StepNumber n={2} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Initialize with your wallet</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Configure the checkout with your merchant wallet address.
                  </p>
                  <CodeBlock id="step2">
                    {`<script>
  ConduitCheckout.init({
    // REQUIRED: Your wallet address to receive payments
    sellerAddress: '0xYourWalletAddressHere',

    // REQUIRED: Base URL of checkout page
    baseUrl: '${origin}',

    // RECOMMENDED: Auto-send verified payment to your backend
    webhookUrl: 'https://yoursite.com/api/conduit-webhook',
    webhookSecret: 'your-secret-key',  // For HMAC signature verification

    // Optional: Default token ('USDC' or 'USDT')
    tokenSymbol: 'USDC',

    // Optional: Days until auto-release (default: 7)
    expiryDays: 7,

    // Optional: Display mode ('popup' or 'redirect')
    mode: 'popup',

    // Success callback (webhook already sent!)
    onSuccess: function(data) {
      console.log('Payment verified!', data);
      alert('Thank you! Order #' + data.orderId + ' confirmed!');
    },

    // Error callback
    onError: function(error) {
      console.error('Payment failed:', error);
      alert('Payment failed: ' + error);
    },

    // Cancel callback
    onCancel: function() {
      console.log('Payment cancelled');
    }
  });
</script>`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.2}>
                <div>
                  <StepNumber n={3} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Add payment buttons</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Create buttons that open the checkout.
                  </p>
                  <CodeBlock id="step3" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '50.00',
  description: 'Premium Product'
})">
  Pay $50 with USDC
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* DISPLAY MODES                                                    */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label="Display modes"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Display modes
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Choose how checkout appears.
              </h2>
            </Fade>

            <Tabs tabs={modeTabs} activeTab={modeTab} onTabChange={setModeTab} className="mb-8" />

            <TabPanel isActive={modeTab === 'popup'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Popup window</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Opens in a centered popup. Best for minimal disruption to the shopping experience.
                  </p>
                  <CodeBlock id="mode-popup">{`mode: 'popup'`}</CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={modeTab === 'redirect'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Full redirect</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Redirects to checkout page. Best for mobile devices and single-product flows.
                  </p>
                  <CodeBlock id="mode-redirect">{`mode: 'redirect'`}</CodeBlock>
                </div>
              </Fade>
            </TabPanel>
          </div>
        </section>

        {/* ================================================================ */}
        {/* EXAMPLES                                                         */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Examples"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Examples
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Common integration patterns.
              </h2>
            </Fade>

            <Tabs tabs={exampleTabs} activeTab={exampleTab} onTabChange={setExampleTab} className="mb-8" />

            <TabPanel isActive={exampleTab === 'basic'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Basic product payment</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Simple checkout for a single product with order tracking.
                  </p>
                  <CodeBlock id="ex-basic" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '29.99',
  description: 'Premium Widget - Blue',
  orderId: 'ORDER-12345'
})">
  Buy Now - $29.99
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={exampleTab === 'extended'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Extended buyer protection</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Set a longer escrow period for services or high-value items.
                  </p>
                  <CodeBlock id="ex-extended" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '99.00',
  description: 'Professional Service Package',
  orderId: 'SERVICE-' + Date.now(),
  expiryDays: 30,  // 30-day buyer protection
  email: 'customer@example.com'
})">
  Purchase - $99
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={exampleTab === 'custom'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Custom amount (donations, tips)</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Let the user enter their own amount before checkout.
                  </p>
                  <CodeBlock id="ex-custom" language="html">
                    {`<input type="number" id="amount" placeholder="Enter amount" min="1.001" step="0.01">
<button onclick="
  const amount = document.getElementById('amount').value;
  ConduitCheckout.open({
    amount: amount,
    description: 'Support our project',
    orderId: 'DONATION-' + Date.now()
  });
">
  Donate with USDC
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={exampleTab === 'usdt'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Accept USDT instead of USDC</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Override the default token on a per-payment basis.
                  </p>
                  <CodeBlock id="ex-usdt" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '500.00',
  description: 'Enterprise License',
  tokenSymbol: 'USDT',  // Use USDT instead of USDC
  expiryDays: 14
})">
  Pay $500 with USDT
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>
          </div>
        </section>

        {/* ================================================================ */}
        {/* CONFIGURATION REFERENCE                                          */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label="Configuration reference"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Reference
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Configuration options.
              </h2>
            </Fade>

            {/* init() options */}
            <Fade>
              <div className="mb-12">
                <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
                  <code className="bg-secondary-100 dark:bg-secondary-800 px-2 py-1 rounded text-base">ConduitCheckout.init(options)</code>
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                    <thead className="bg-secondary-100 dark:bg-secondary-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Option</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Type</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Required</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Default</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                      {[
                        { opt: 'sellerAddress', type: 'string', req: true, def: '-', desc: 'Your wallet address to receive payments' },
                        { opt: 'baseUrl', type: 'string', req: true, def: '-', desc: 'Base URL of checkout page' },
                        { opt: 'webhookUrl', type: 'string', req: false, def: '-', desc: 'Webhook URL for payment verification' },
                        { opt: 'webhookSecret', type: 'string', req: false, def: '-', desc: 'HMAC secret for webhook signatures' },
                        { opt: 'tokenSymbol', type: 'string', req: false, def: "'USDC'", desc: "'USDC' or 'USDT'" },
                        { opt: 'expiryDays', type: 'number', req: false, def: '7', desc: 'Days until auto-release to seller' },
                        { opt: 'mode', type: 'string', req: false, def: "'popup'", desc: "'popup' or 'redirect'" },
                        { opt: 'onSuccess', type: 'function', req: false, def: '-', desc: 'Callback when payment completes' },
                        { opt: 'onError', type: 'function', req: false, def: '-', desc: 'Callback when payment fails' },
                        { opt: 'onCancel', type: 'function', req: false, def: '-', desc: 'Callback when user cancels' },
                      ].map((row, i) => (
                        <tr key={row.opt} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                          <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.opt}</td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.type}</td>
                          <td className={`px-4 py-3 font-medium ${row.req ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-500 dark:text-secondary-400'}`}>
                            {row.req ? 'Yes' : 'No'}
                          </td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.def}</td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Fade>

            {/* open() params */}
            <Fade delay={0.1}>
              <div>
                <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
                  <code className="bg-secondary-100 dark:bg-secondary-800 px-2 py-1 rounded text-base">ConduitCheckout.open(params)</code>
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                    <thead className="bg-secondary-100 dark:bg-secondary-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Parameter</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Type</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Required</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                      {[
                        { param: 'amount', type: 'string/number', req: true, desc: "Payment amount (e.g., '50.00')" },
                        { param: 'description', type: 'string', req: true, desc: 'Payment description (max 160 chars)' },
                        { param: 'orderId', type: 'string', req: false, desc: 'Your internal order/transaction ID' },
                        { param: 'email', type: 'string', req: false, desc: 'Customer email address' },
                        { param: 'tokenSymbol', type: 'string', req: false, desc: 'Override default token for this payment' },
                        { param: 'expiryDays', type: 'number', req: false, desc: 'Override default expiry' },
                        { param: 'webhookUrl', type: 'string', req: false, desc: 'Override webhook URL for this payment' },
                        { param: 'metadata', type: 'object', req: false, desc: 'Custom metadata to include' },
                      ].map((row, i) => (
                        <tr key={row.param} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                          <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.param}</td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.type}</td>
                          <td className={`px-4 py-3 font-medium ${row.req ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-500 dark:text-secondary-400'}`}>
                            {row.req ? 'Yes' : 'No'}
                          </td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* WEBHOOK INTEGRATION                                              */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Webhook integration"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Backend integration
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Webhook-based order fulfillment.
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-12 max-w-md">
                Receive server-to-server notifications when payments complete. The SDK sends verified payment data to your webhook automatically.
              </p>
            </Fade>

            <div className="space-y-12">
              <Fade>
                <div>
                  <StepNumber n={1} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Configure SDK with webhook</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    The SDK handles verification and webhook delivery automatically. No manual <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">fetch()</code> calls needed.
                  </p>
                  <CodeBlock id="webhook-init">
                    {`ConduitCheckout.init({
  sellerAddress: '0xYourWalletAddress',
  baseUrl: '${origin}',

  // Webhook config
  webhookUrl: 'https://yoursite.com/api/conduit-webhook',
  webhookSecret: 'your-secret-key',  // Store securely!

  onSuccess: function(verifiedData) {
    // Webhook already sent! Just show UI confirmation
    console.log('Payment verified!', verifiedData);
    window.location.href = '/thank-you?order=' + verifiedData.orderId;
  },

  onError: function(error) {
    alert('Payment failed: ' + error);
  }
});`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.1}>
                <div>
                  <StepNumber n={2} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Create webhook endpoint</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    One endpoint handles verification, order processing, and fulfillment.
                  </p>
                  <CodeBlock id="webhook-handler">
                    {`const crypto = require('crypto');

// POST /api/conduit-webhook
app.post('/api/conduit-webhook', async (req, res) => {
  try {
    // 1. VERIFY HMAC SIGNATURE (prevents spoofing)
    const signature = req.headers['x-conduit-signature'];
    const payload = JSON.stringify(req.body);

    const expectedSig = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSig) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. EXTRACT VERIFIED DATA
    const {
      contractId,
      chainAddress,
      amount,
      currencySymbol,
      state,
      verified,
      verifiedAt,
      orderId,
      email,
      metadata
    } = req.body;

    console.log('Payment verified:', contractId, amount, currencySymbol);

    // 3. PROCESS PAYMENT IN YOUR SYSTEM
    await db.orders.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentContractId: contractId,
        paymentChainAddress: chainAddress,
        paymentAmount: amount,
        paidAt: new Date(verifiedAt)
      }
    });

    // 4. FULFILL ORDER
    await fulfillment.ship(orderId);
    await email.sendConfirmation(email, orderId);

    // 5. RESPOND SUCCESS
    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.2}>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-3">Webhook payload</h3>
                  <CodeBlock id="webhook-payload" language="json">
                    {`{
  "transaction_hash": "0x1234...",
  "contract_address": "0x5678...",
  "contract_id": "abc123",
  "order_id": "1234",
  "expected_amount": 50.00,
  "expected_recipient": "0x9abc...",
  "merchant_wallet": "0xdef0..."
}`}
                  </CodeBlock>
                </div>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* VERIFIED DATA REFERENCE                                          */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label="Verified data"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Verification
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                What verified data means.
              </h2>
            </Fade>

            <Fade delay={0.06}>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                  <thead className="bg-secondary-100 dark:bg-secondary-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Field</th>
                      <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                    {[
                      { field: 'verified: true', meaning: 'Backend confirmed payment exists in blockchain' },
                      { field: 'state: "ACTIVE"', meaning: 'Funds are locked in escrow contract' },
                      { field: 'seller: "0x..."', meaning: 'Matches your wallet (verified by SDK)' },
                      { field: 'amount: 50.0', meaning: 'Matches expected amount (verified by SDK)' },
                      { field: 'chainAddress', meaning: 'Blockchain contract address (permanent record)' },
                    ].map((row, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                        <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.field}</td>
                        <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-secondary-500 dark:text-secondary-400">
                Once you receive verified data, it is safe to fulfil the order. The SDK has confirmed everything on-chain.
              </p>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURES & SECURITY                                              */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Features and security"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Platform
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-16"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Built-in protection for every transaction.
              </h2>
            </Fade>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-10">
              {[
                {
                  label: 'Buyer protection',
                  items: ['Funds held in escrow smart contract', 'Time-delayed release (default 7 days)', 'Dispute mechanism', 'Admin arbitration'],
                },
                {
                  label: 'No gas fees',
                  items: ['Platform covers all blockchain fees', 'Users pay 1% platform fee', 'Minimum payment: $1.001', 'Fee included in payment amount'],
                },
                {
                  label: 'Client-side security',
                  items: ['Users sign with own wallet', 'No custody of user funds', 'HTTPS required', 'Open-source smart contracts'],
                },
                {
                  label: 'Multi-token support',
                  items: ['USDC (default)', 'USDT (optional)', 'Base network (Ethereum L2)', 'Low transaction costs'],
                },
              ].map((feat, i) => (
                <Fade key={i} delay={i * 0.06}>
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-3">
                      {feat.label}
                    </h3>
                    <ul className="space-y-1.5 text-sm text-secondary-500 dark:text-secondary-400">
                      {feat.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* CUSTOMER EXPERIENCE FLOW                                         */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label="Customer experience"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-16">
                End-to-end flow
              </p>
            </Fade>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-x-12 gap-y-12">
              {[
                { num: '01', title: 'Customer clicks pay', desc: 'Opens checkout popup or redirect.' },
                { num: '02', title: 'Wallet connects & pays', desc: 'Customer signs the transaction.' },
                { num: '03', title: 'SDK verifies on-chain', desc: 'Automatic blockchain verification.' },
                { num: '04', title: 'Webhook sent to backend', desc: 'Your server receives verified data.' },
                { num: '05', title: 'Order fulfilled', desc: 'Ship goods, deliver product, send receipt.' },
              ].map((step, i) => (
                <Fade key={step.num} delay={i * 0.08}>
                  <div>
                    <span className="text-[3rem] leading-none font-extralight text-secondary-100 dark:text-secondary-800 select-none block mb-3">
                      {step.num}
                    </span>
                    <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-1">
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
        {/* FAQ                                                              */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="FAQ"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                FAQ
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Frequently asked questions.
              </h2>
            </Fade>

            <div className="space-y-4">
              {[
                {
                  q: 'What tokens are supported?',
                  a: `Currently ${currencyList} on the Base network (Ethereum Layer 2).`,
                },
                {
                  q: 'What are the fees?',
                  a: '1% platform fee per transaction. No setup costs, no monthly fees. Minimum payment is $1.001. Gas fees are covered by the platform.',
                },
                {
                  q: 'How long until I receive funds?',
                  a: 'Funds are automatically released after the expiry period (default 7 days) unless the buyer raises a dispute. You can customize the expiry period per payment.',
                },
                {
                  q: 'Can buyers get refunds?',
                  a: 'Buyers can raise a dispute within the protection period. Our admin team reviews disputes and can release funds to either party based on the evidence.',
                },
                {
                  q: 'Do I need a crypto wallet?',
                  a: 'Yes, you need a wallet address to receive payments. We recommend MetaMask, Coinbase Wallet, or any Web3-compatible wallet. Buyers can use email + social login (we create embedded wallets for them).',
                },
                {
                  q: 'Is this secure?',
                  a: 'Yes. Payments are secured by immutable smart contracts on the Base blockchain. Users sign transactions with their own wallets. All transactions are auditable on-chain. HTTPS is required for all integrations.',
                },
                {
                  q: 'What about chargebacks?',
                  a: 'Cryptocurrency transactions are irreversible — there are no chargebacks like with credit cards. The escrow system provides buyer protection through the dispute mechanism during the protection period.',
                },
              ].map((item, i) => (
                <Fade key={i} delay={i * 0.04}>
                  <details className="border border-secondary-200 dark:border-secondary-700 rounded-lg group">
                    <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-secondary-900 dark:text-white hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors rounded-lg">
                      {item.q}
                    </summary>
                    <div className="px-6 pb-4 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                      {item.a}
                    </div>
                  </details>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FINAL CTA                                                        */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Get started"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-28 pb-16 lg:pb-20">
            <Fade>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-3"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Ready to integrate?
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8 max-w-md">
                Try the interactive demo or start integrating directly into your site.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/checkout-example.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnPrimary}
                >
                  View Live Demo
                </a>
                <Link href="/merchant" className={btnOutline}>
                  Merchant Overview
                </Link>
              </div>
            </Fade>

            {/* Footer links */}
            <Fade delay={0.2}>
              <div className="mt-14 pt-8 border-t border-secondary-100 dark:border-secondary-800 flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
                <Link href="/how-it-works" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  How it works
                </Link>
                <Link href="/faq" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  FAQ
                </Link>
                <Link href="/shopify/install-button" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  Shopify integration
                </Link>
                <a
                  href="https://github.com/conduit-ucpi/contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  Source code
                </a>
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
