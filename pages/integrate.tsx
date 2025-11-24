import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function IntegratePage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CodeBlock = ({ code, section, language = 'javascript' }: { code: string; section: string; language?: string }) => (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        onClick={() => copyToClipboard(code, section)}
        className="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
      >
        {copiedSection === section ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <Head children={
        <>
          <title>Integration Guide - Conduit UCPI</title>
          <meta name="description" content="Integrate secure stablecoin escrow payments into your website with just a few lines of code." />
        </>
      } />

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="container mx-auto px-6 py-16">
          <Link href="/" className="text-blue-100 hover:text-white mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-4">Integration Guide</h1>
          <p className="text-xl text-blue-100">
            Add secure stablecoin escrow payments to your website in minutes
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Quick Start */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🚀 Quick Start</h2>
          <p className="text-lg text-gray-700 mb-8">
            Get started with three simple steps. No backend integration required!
          </p>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="border-l-4 border-blue-500 pl-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Step 1: Include the Script
              </h3>
              <p className="text-gray-700 mb-4">
                Add this line to your website's HTML, just before the closing <code className="bg-gray-100 px-2 py-1 rounded">&lt;/body&gt;</code> tag:
              </p>
              <CodeBlock
                section="step1"
                language="html"
                code={`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz'}/conduit-checkout.js"></script>`}
              />
            </div>

            {/* Step 2 */}
            <div className="border-l-4 border-blue-500 pl-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Step 2: Initialize with Your Wallet
              </h3>
              <p className="text-gray-700 mb-4">
                Configure the checkout with your merchant wallet address:
              </p>
              <CodeBlock
                section="step2"
                code={`<script>
  ConduitCheckout.init({
    // Your wallet address to receive payments
    sellerAddress: '0xYourWalletAddressHere',

    // Base URL of checkout page
    baseUrl: '${typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz'}',

    // Default token: 'USDC' or 'USDT' (default: 'USDC')
    tokenSymbol: 'USDC',

    // Days until auto-release to seller (default: 7)
    expiryDays: 7,

    // Display mode: 'popup' or 'redirect'
    mode: 'popup',

    // Success callback
    onSuccess: function(data) {
      console.log('Payment completed!', data);
      alert('Thank you! Payment received: ' + data.transactionHash);
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
              />
            </div>

            {/* Step 3 */}
            <div className="border-l-4 border-blue-500 pl-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Step 3: Add Payment Buttons
              </h3>
              <p className="text-gray-700 mb-4">
                Create buttons that open the checkout:
              </p>
              <CodeBlock
                section="step3"
                language="html"
                code={`<button onclick="ConduitCheckout.open({
  amount: '50.00',
  description: 'Premium Product'
})">
  Pay $50 with USDC
</button>`}
              />
            </div>
          </div>
        </section>

        {/* Live Demo */}
        <section className="mb-16 bg-blue-50 border border-blue-200 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ✨ Try It Live
          </h2>
          <p className="text-gray-700 mb-6">
            See the integration in action with a working example page:
          </p>
          <a
            href="/checkout-example.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            View Interactive Demo →
          </a>
        </section>

        {/* Display Modes */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🎨 Display Modes</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Popup Window</h3>
              <p className="text-sm text-gray-600 mb-4">
                Opens in a centered popup. Best for minimal disruption.
              </p>
              <CodeBlock
                section="popup"
                code={`mode: 'popup'`}
              />
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Full Redirect</h3>
              <p className="text-sm text-gray-600 mb-4">
                Redirects to checkout page. Best for mobile.
              </p>
              <CodeBlock
                section="redirect"
                code={`mode: 'redirect'`}
              />
            </div>
          </div>
        </section>

        {/* Common Examples */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">💡 Common Examples</h2>

          <div className="space-y-8">
            {/* Basic Payment */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Basic Product Payment</h3>
              <CodeBlock
                section="basic"
                language="html"
                code={`<button onclick="ConduitCheckout.open({
  amount: '29.99',
  description: 'Premium Widget - Blue',
  orderId: 'ORDER-12345'
})">
  Buy Now - $29.99
</button>`}
              />
            </div>

            {/* Extended Protection */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Product with Extended Protection</h3>
              <CodeBlock
                section="extended"
                language="html"
                code={`<button onclick="ConduitCheckout.open({
  amount: '99.00',
  description: 'Professional Service Package',
  orderId: 'SERVICE-' + Date.now(),
  expiryDays: 30,  // 30-day buyer protection
  email: 'customer@example.com'
})">
  Purchase - $99
</button>`}
              />
            </div>

            {/* Custom Amount */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Custom Amount (Donations, Tips)</h3>
              <CodeBlock
                section="custom"
                language="html"
                code={`<input type="number" id="amount" placeholder="Enter amount" min="1.001" step="0.01">
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
              />
            </div>

            {/* USDT Payment */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Accept USDT Instead of USDC</h3>
              <CodeBlock
                section="usdt"
                language="html"
                code={`<button onclick="ConduitCheckout.open({
  amount: '500.00',
  description: 'Enterprise License',
  tokenSymbol: 'USDT',  // Use USDT instead of USDC
  expiryDays: 14
})">
  Pay $500 with USDT
</button>`}
              />
            </div>
          </div>
        </section>

        {/* Configuration Reference */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">⚙️ Configuration Options</h2>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              <code className="bg-gray-100 px-2 py-1 rounded text-base">ConduitCheckout.init(options)</code>
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Option</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Required</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Default</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">sellerAddress</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold">Yes</td>
                    <td className="px-4 py-3 text-sm text-gray-600">-</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Your wallet address to receive payments</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">baseUrl</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold">Yes</td>
                    <td className="px-4 py-3 text-sm text-gray-600">-</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Base URL of checkout page</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">tokenSymbol</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">'USDC'</td>
                    <td className="px-4 py-3 text-sm text-gray-600">'USDC' or 'USDT'</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">expiryDays</td>
                    <td className="px-4 py-3 text-sm text-gray-600">number</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">7</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Days until auto-release to seller</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">mode</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">'popup'</td>
                    <td className="px-4 py-3 text-sm text-gray-600">'popup' or 'redirect'</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">onSuccess</td>
                    <td className="px-4 py-3 text-sm text-gray-600">function</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">-</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Callback when payment completes</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">onError</td>
                    <td className="px-4 py-3 text-sm text-gray-600">function</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">-</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Callback when payment fails</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">onCancel</td>
                    <td className="px-4 py-3 text-sm text-gray-600">function</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">-</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Callback when user cancels</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              <code className="bg-gray-100 px-2 py-1 rounded text-base">ConduitCheckout.open(params)</code>
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Parameter</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Required</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">amount</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string/number</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold">Yes</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Payment amount (e.g., '50.00')</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">description</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold">Yes</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Payment description (max 160 chars)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">orderId</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Your internal order/transaction ID</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">email</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Customer email address</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">tokenSymbol</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Override default token for this payment</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">expiryDays</td>
                    <td className="px-4 py-3 text-sm text-gray-600">number</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Override default expiry</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">webhookUrl</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Webhook URL for payment verification</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">metadata</td>
                    <td className="px-4 py-3 text-sm text-gray-600">object</td>
                    <td className="px-4 py-3 text-sm text-gray-600">No</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Custom metadata to include</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Webhook Integration */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🔔 Webhook Integration</h2>
          <p className="text-gray-700 mb-6">
            Receive server-to-server notifications when payments are completed. Perfect for fulfilling orders automatically.
          </p>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Webhook Payload</h3>
            <CodeBlock
              section="webhook-payload"
              language="json"
              code={`{
  "transaction_hash": "0x1234...",
  "contract_address": "0x5678...",
  "contract_id": "abc123",
  "order_id": "1234",
  "expected_amount": 50.00,
  "expected_recipient": "0x9abc...",
  "merchant_wallet": "0xdef0..."
}`}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Example Webhook Handler (Node.js)</h3>
            <CodeBlock
              section="webhook-handler"
              language="javascript"
              code={`app.post('/api/payment-webhook', express.json(), async (req, res) => {
  const {
    transaction_hash,
    contract_id,
    order_id,
    expected_amount
  } = req.body;

  // Verify payment on blockchain (optional)
  // Update your database
  // Fulfill order
  // Send confirmation email

  console.log(\`Payment received for order \${order_id}: \${transaction_hash}\`);

  res.json({ success: true });
});`}
            />
          </div>
        </section>

        {/* Features & Security */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🔒 Features & Security</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-green-200 bg-green-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-3">✓ Buyer Protection</h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• Funds held in escrow smart contract</li>
                <li>• Time-delayed release (default 7 days)</li>
                <li>• Dispute mechanism for buyer protection</li>
                <li>• Admin arbitration for disputes</li>
              </ul>
            </div>

            <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">✓ No Gas Fees</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Platform covers all blockchain fees</li>
                <li>• Users only pay $1 platform fee</li>
                <li>• Minimum payment: $1.001</li>
                <li>• Fee included in payment amount</li>
              </ul>
            </div>

            <div className="border border-purple-200 bg-purple-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-900 mb-3">✓ Client-Side Security</h3>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• Users sign transactions with own wallet</li>
                <li>• No custody of user funds</li>
                <li>• HTTPS required for all integrations</li>
                <li>• Open-source smart contracts</li>
              </ul>
            </div>

            <div className="border border-orange-200 bg-orange-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-900 mb-3">✓ Multi-Token Support</h3>
              <ul className="space-y-2 text-sm text-orange-800">
                <li>• USDC (default)</li>
                <li>• USDT (optional)</li>
                <li>• Base network (Ethereum L2)</li>
                <li>• Low transaction costs</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">❓ Frequently Asked Questions</h2>

          <div className="space-y-4">
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
                What tokens are supported?
              </summary>
              <div className="px-6 pb-4 text-gray-700">
                Currently USDC and USDT on the Base network (Ethereum Layer 2). More tokens coming soon!
              </div>
            </details>

            <details className="border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
                What are the fees?
              </summary>
              <div className="px-6 pb-4 text-gray-700">
                Fixed $1 platform fee per transaction (included in the amount). Minimum payment is $1.001. No gas fees for users - we cover all blockchain costs.
              </div>
            </details>

            <details className="border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
                How long until I receive funds?
              </summary>
              <div className="px-6 pb-4 text-gray-700">
                Funds are automatically released after the expiry period (default 7 days) unless the buyer raises a dispute. You can customize the expiry period per payment.
              </div>
            </details>

            <details className="border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
                Can buyers get refunds?
              </summary>
              <div className="px-6 pb-4 text-gray-700">
                Buyers can raise a dispute within the protection period by emailing the dispute address. Our admin team reviews disputes and can release funds to either party based on the evidence.
              </div>
            </details>

            <details className="border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
                Do I need a crypto wallet?
              </summary>
              <div className="px-6 pb-4 text-gray-700">
                Yes, you need a wallet address to receive payments. We recommend MetaMask, Coinbase Wallet, or any Web3-compatible wallet. Buyers can use email + social login (we create embedded wallets for them).
              </div>
            </details>

            <details className="border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
                Is this secure?
              </summary>
              <div className="px-6 pb-4 text-gray-700">
                Yes! Payments are secured by immutable smart contracts on the Base blockchain. Users sign transactions with their own wallets (we never custody funds). All transactions are auditable on-chain. HTTPS is required for all integrations.
              </div>
            </details>

            <details className="border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
                What about chargebacks?
              </summary>
              <div className="px-6 pb-4 text-gray-700">
                Cryptocurrency transactions are irreversible - there are no chargebacks like with credit cards. However, our escrow system provides buyer protection through the dispute mechanism during the protection period.
              </div>
            </details>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg mb-6 text-blue-100">
            Try the interactive demo or integrate directly into your site
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/checkout-example.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-blue-600 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
            >
              View Live Demo
            </a>
            <Link
              href="/"
              className="inline-block bg-blue-800 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-900 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-16">
        <div className="container mx-auto px-6 py-8 text-center text-gray-600">
          <p>© {new Date().getFullYear()} Conduit UCPI. Secure stablecoin escrow payments.</p>
        </div>
      </footer>
    </div>
  );
}
