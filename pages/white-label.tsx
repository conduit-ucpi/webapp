import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import SEO from '@/components/SEO';
import { API_DOCS_URL } from '@/lib/apiDocs';
import { usePartnerBrand } from '@conduit-ucpi/whitelabel-sdk';
import BrandRequestForm from '@/components/whitelabel/BrandRequestForm';

/*
 * The white-label integration guide: who does what to run payment requests and checkout under a
 * partner's brand, with the pages a partner hosts and the ways their merchants take payments.
 *
 * Viewed under a partner's brand (`?b=`), the snippets carry that partner's real brand id, as
 * /integrate's do; otherwise a placeholder. No partner is named on the public page.
 */

const SITE = 'https://stabledrop.me';
const API = 'https://api.stabledrop.me';
const TEST = 'https://test.conduit-ucpi.com';

type Role = 'partner' | 'us' | 'merchant';

// Named from the partner's side: they are the one reading this page.
const CHIP: Record<Role, { label: string; className: string; edge: string }> = {
  partner: { label: 'You (the partner)', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', edge: 'border-amber-400' },
  us: { label: 'Stabledrop (us)', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200', edge: 'border-teal-500' },
  merchant: { label: 'Your merchants', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200', edge: 'border-violet-400' },
};

function Chip({ role }: { role: Role }) {
  return (
    <span className={`inline-block text-[0.7rem] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap ${CHIP[role].className}`}>
      {CHIP[role].label}
    </span>
  );
}

function C({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.88em] bg-secondary-100 dark:bg-secondary-800 px-1 rounded">{children}</code>;
}

function Snippet({ label, children }: { label: string; children: string }) {
  const copy = () => {
    navigator.clipboard.writeText(children).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Could not copy: select the text instead')
    );
  };
  return (
    <div className="mb-5 rounded-md overflow-hidden bg-secondary-900 dark:bg-black/40 border border-secondary-800">
      <div className="flex items-center justify-between gap-4 px-3 py-1.5 border-b border-white/10">
        <span className="font-mono text-xs text-secondary-400">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="text-xs font-semibold text-secondary-100 border border-white/20 hover:border-white/50 rounded px-2.5 py-0.5"
        >
          Copy
        </button>
      </div>
      <pre className="m-0 p-4 overflow-x-auto">
        <code className="font-mono text-[0.82rem] leading-relaxed text-secondary-100 whitespace-pre">{children}</code>
      </pre>
    </div>
  );
}

/**
 * One step, owned by someone. The owner is said three ways — chips, a "Who does this" sentence and
 * a coloured edge — because a partner skimming for "what do I have to do" must not miss it.
 */
function Step({ id, n, title, roles, who, children }: { id: string; n: string; title: string; roles: Role[]; who: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="border-t border-secondary-200 dark:border-secondary-700 pt-8 pb-2">
      <div className={`border-l-4 ${CHIP[roles[0]].edge} pl-4 sm:pl-5`}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-3">
          <span className="font-semibold text-primary-600 dark:text-primary-400 tabular-nums">{n}</span>
          <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white">{title}</h2>
        </div>
        <p className="who flex flex-wrap items-center gap-2 mb-5 text-sm text-secondary-800 dark:text-secondary-200">
          <span className="font-semibold uppercase tracking-wider text-xs text-secondary-500 dark:text-secondary-400">Who does this:</span>
          {roles.map((role) => (
            <Chip key={role} role={role} />
          ))}
          <span>{who}</span>
        </p>
        <div className="text-secondary-700 dark:text-secondary-300 space-y-4">{children}</div>
      </div>
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold text-secondary-900 dark:text-white pt-4">{children}</h3>;
}

export default function WhiteLabelGuide() {
  const brand = usePartnerBrand()?.id ?? 'your-brand';

  const contractCreatePage = `<div id="checkout"></div>
<script>
  var BRAND = '${brand}';
  var SITE = '${SITE}';

  // The merchant's terms are this page's own query string; the brand is always yours.
  var params = new URLSearchParams(window.location.search);
  params.set('b', BRAND);

  var frame = document.createElement('iframe');
  frame.src = SITE + '/contract-create?' + params.toString();
  frame.title = 'Checkout';
  frame.allow = 'clipboard-write; payment';
  frame.style.cssText = 'width:100%;height:760px;border:0';
  document.getElementById('checkout').appendChild(frame);

  // The checkout reports to this page (payment_completed, payment_error,
  // payment_cancelled, close_modal). Forward them to whatever opened this page.
  window.addEventListener('message', function (event) {
    if (event.origin !== SITE) return;
    if (window.opener) window.opener.postMessage(event.data, '*');
    if (window.parent !== window) window.parent.postMessage(event.data, '*');
  });
</script>`;

  const exampleConfig = `{
  "id": "${brand}",
  "name": "Your Brand",
  "tagline": "Protected payments",
  "locale": "en",
  "links": {
    "support": "mailto:support@your-site.example",
    "terms": "/terms-of-service",
    "privacy": "/privacy-policy",
    "arbitration": "/arbitration-policy"
  }
}`;

  const frame = (path: string, title: string, size: string, allow = 'clipboard-write; payment') =>
    `<iframe src="${SITE}${path}?b=${brand}"
        title="${title}"
        allow="${allow}"
        style="${size}"></iframe>`;

  return (
    <>
      <SEO
        title="White-label Integration Guide"
        description="How a white-label partner runs payment requests and escrow checkout under their own brand: who does what, the pages to host, and how merchants take payments."
        canonical="/white-label"
      />
      <div className="bg-white dark:bg-secondary-900 transition-colors">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
          <header className="mb-8">
            <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-4">For partners</p>
            <h1 className="text-4xl sm:text-5xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight">
              White-label integration
            </h1>
            <p className="mt-5 text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl leading-relaxed">
              Everything needed to run payment requests and checkout under a partner&apos;s own brand. The partner&apos;s
              pages frame ours; once a buyer reaches the checkout, signing in, paying and settling all happen inside our site.
            </p>
          </header>

          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm mb-8">
            <dt className="text-secondary-500 dark:text-secondary-400">Site (production)</dt>
            <dd className="min-w-0 break-all"><C>{SITE}</C></dd>
            <dt className="text-secondary-500 dark:text-secondary-400">API (production)</dt>
            <dd className="min-w-0 break-all"><C>{API}</C></dd>
            <dt className="text-secondary-500 dark:text-secondary-400">Test (site and API)</dt>
            <dd className="min-w-0 break-all"><C>{TEST}</C></dd>
          </dl>

          <div className="grid sm:grid-cols-3 gap-3 mb-10" aria-label="Who does what">
            {(
              [
                ['partner', 'The white-label brand, reading this. You request your brand (step 1) and host the pages on your site (step 4).'],
                ['us', 'The Stabledrop team. We set up your brand and allow your domains (steps 2 and 3). Nothing for you to do there.'],
                ['merchant', 'Your customers who take payments, through links, a checkout button or the API (steps 5 and 6).'],
              ] as [Role, string][]
            ).map(([role, text]) => (
              <div key={role} className="border border-secondary-200 dark:border-secondary-700 rounded-lg p-4 min-w-0">
                <Chip role={role} />
                <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">{text}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-secondary-200 dark:border-secondary-700 rounded-lg mb-10">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-secondary-500 dark:text-secondary-400">
                  <th className="px-4 py-2 font-semibold">#</th>
                  <th className="px-4 py-2 font-semibold">Step</th>
                  <th className="px-4 py-2 font-semibold">Who does it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700 text-secondary-800 dark:text-secondary-200">
                {(
                  [
                    ['1', 'Request your brand: paste your config and send', ['partner']],
                    ['2', 'Create your brand', ['us']],
                    ['3', 'Allow your domains', ['us']],
                    ['4', 'Host the framed pages on your site', ['partner']],
                    ['5', 'Take payments', ['merchant']],
                    ['6', 'Confirm payments', ['merchant', 'partner']],
                    ['7', 'Test end to end', ['partner', 'us']],
                  ] as [string, string, Role[]][]
                ).map(([n, step, roles]) => (
                  <tr key={n}>
                    <td className="px-4 py-2 tabular-nums text-secondary-500">{n}</td>
                    <td className="px-4 py-2">{step}</td>
                    <td className="px-4 py-2 space-x-1">{roles.map((r) => <Chip key={r} role={r} />)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Step id="brand-pack" n="Step 1" title="Request your brand" roles={['partner']} who="You, the partner: fill in the form below and send it.">
            <p>
              Paste your brand config, add your email address and domains, and send us the email this builds. We set up
              your brand and allow your domains (steps 2 and 3), then reply to confirm.
            </p>
            <BrandRequestForm example={exampleConfig} />
            <p>Nothing you send can change a payment&apos;s terms, fee, arbiter or verification. Branding only changes how the pages look and read.</p>
          </Step>

          <Step id="create-brand" n="Step 2" title="We create your brand" roles={['us']} who="Stabledrop, once your request arrives. Nothing for you to do here; this is how we do it.">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Upload the image and font files to the service (<C>POST /api/brands/{'{id}'}/assets</C>); each upload returns an asset id.</li>
              <li>Add the brand to <C>webapp/config/brands/snapshot.json</C>, referring to those asset ids. Pull first, because pushing replaces the whole record.</li>
              <li>Push it, then commit the updated snapshot so the copy bundled with the site agrees.</li>
              <li>Tell the partner their brand id.</li>
            </ol>
            <Snippet label={`snapshot.json · brands.${brand}.config (excerpt)`}>{exampleConfig}</Snippet>
            <Snippet label="shell · from the webapp repo">{`WHITELABEL_URL=${API} WHITELABEL_ADMIN_KEY=… node scripts/brands/pull.mjs
# edit config/brands/snapshot.json, then push only this brand
WHITELABEL_URL=${API} WHITELABEL_ADMIN_KEY=… node scripts/brands/push.mjs ${brand}`}</Snippet>
            <p>Theme colours are <C>&quot;R G B&quot;</C> triples in <C>primary</C> and <C>secondary</C> ramps. Use the test service&apos;s address for the test environment.</p>
          </Step>

          <Step id="domains" n="Step 3" title="We allow your domains" roles={['us']} who="Stabledrop. Nothing for you to do here; we email you when your pages can go live.">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Frame allow-list</strong>: add every partner domain to the webapp&apos;s <C>ALLOWED_FRAME_ANCESTORS</C> variable, in each environment the partner will use (test and production), then redeploy the webapp. Without this the browser shows an empty frame.</li>
              <li><strong>Privy</strong>: add the domains to the allowed origins in the Privy dashboard.</li>
            </ul>
            <p className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 px-4 py-3 rounded-r">
              Check the variable for each environment before telling a partner their pages are ready.
            </p>
          </Step>

          <Step id="pages" n="Step 4" title="Host the framed pages on your site" roles={['partner']} who="You, the partner, on your own website: copy these pages into it.">
            <p>
              Each page on your site frames one of ours with your brand id. Keep the <C>allow</C> attribute: without{' '}
              <C>clipboard-write</C> the copy buttons fail inside your page.
            </p>

            <H3>Checkout: <C>your-site/contract-create</C> (required for checkout)</H3>
            <p>
              Passes its own address parameters straight to our checkout, always under your brand. A link such as{' '}
              <C>your-site/contract-create?seller=0x…&amp;amount=9.77&amp;description=Order%20%231042</C> opens that payment.
              It also forwards the checkout&apos;s results to whatever opened the page, for merchants who open it as a popup.
            </p>
            <Snippet label="contract-create.html">{contractCreatePage}</Snippet>

            <H3>Payment requests: <C>your-site/create</C></H3>
            <p>Merchants make a payment request and get a link, QR code and PDF to send their customer.</p>
            <Snippet label="create.html">{frame('/create', 'Request a payment', 'width:100%;height:760px;border:0')}</Snippet>

            <H3>Developer guide: <C>your-site/integrate</C></H3>
            <p>Our integration guide, shown with your brand. Its code samples already include your brand id, and its support contact is the one from your brand record.</p>
            <Snippet label="integrate.html">{frame('/integrate', 'Integration guide', 'width:100%;height:85vh;min-height:720px;border:0', 'clipboard-write')}</Snippet>

            <H3>Optional: <C>your-site/dashboard</C></H3>
            <Snippet label="dashboard.html">{frame('/dashboard', 'Payments dashboard', 'width:100%;height:85vh;min-height:720px;border:0')}</Snippet>
            <p>For testing, use <C>{TEST}</C> in place of <C>{SITE}</C>.</p>
          </Step>

          <Step id="payments" n="Step 5" title="Your merchants take payments" roles={['merchant']} who="Your merchants, on their own sites. Share this step with them, or point them at your integrate page from step 4, which shows the same with your brand filled in.">
            <p>Merchants can use any of three routes. All of them record the payment under the partner&apos;s brand.</p>

            <H3>A. A link to the partner&apos;s checkout page</H3>
            <Snippet label="link">{`https://your-site.example/contract-create?seller=0xYourWalletAddress&amount=9.77&description=Order%20%231042&tokenSymbol=USDC`}</Snippet>
            <div className="overflow-x-auto border border-secondary-200 dark:border-secondary-700 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-secondary-500 dark:text-secondary-400">
                    <th className="px-3 py-2 font-semibold">Parameter</th>
                    <th className="px-3 py-2 font-semibold">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                  {(
                    [
                      ['seller', 'Required. The wallet that is paid: 0x plus 40 hex characters, or an email address.'],
                      ['amount', 'Required. In dollars as typed, for example 9.77. At least 1, or exactly 0.001 for a free test.'],
                      ['description', 'Required. What the payment is for, up to 160 characters.'],
                      ['tokenSymbol', 'USDC (default) or USDT.'],
                      ['epoch_expiry', 'Payout date as a Unix timestamp. Default 7 days. 0 pays the seller instantly, with no dispute window.'],
                      ['order_id', 'Your order reference, echoed back in events and webhooks.'],
                      ['return', 'Where to send the buyer afterwards.'],
                      ['webhook_url', 'Your endpoint to be told when the payment is made.'],
                    ] as [string, string][]
                  ).map(([param, meaning]) => (
                    <tr key={param}>
                      <td className="px-3 py-2 whitespace-nowrap align-top"><C>{param}</C></td>
                      <td className="px-3 py-2">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Without all three required parameters, the buyer is sent to the general payment page instead.</p>

            <H3>B. A checkout button on the merchant&apos;s own website</H3>
            <p>
              The script opens our checkout in a popup. Point <C>baseUrl</C> at our site and set <C>brand</C>: the
              partner&apos;s branding and attribution, with nothing hosted by the partner.
            </p>
            <Snippet label="merchant's page">{`<script src="${SITE}/conduit-checkout.js"></script>
<script>
  ConduitCheckout.init({
    sellerAddress: '0xYourWalletAddress',
    baseUrl: '${SITE}',
    brand: '${brand}',
    onSuccess: function (data) { console.log('Paid', data); },
    onError: function (error) { console.error(error); },
    onCancel: function () { console.log('Cancelled'); }
  });
</script>

<button onclick="ConduitCheckout.open({ amount: '9.77', description: 'Order #1042', orderId: '1042' })">
  Pay
</button>`}</Snippet>

            <H3>C. From the merchant&apos;s server, with no script</H3>
            <p>
              No sign-in or API key. The answer contains the escrow address, how to fund it, a <C>pay_link</C> to send the
              customer, and the exact request that creates the escrow once paid. We do not email the customer for a server
              call; the merchant sends the <C>pay_link</C>.
            </p>
            <Snippet label="shell">{`curl -X POST ${API}/api/ap2/prepare \\
  -H 'Content-Type: application/json' \\
  -d '{
    "seller": "0xYourWalletAddress",
    "nominal_buyer": "customer@example.com",
    "amount": 9770000,
    "expiry_timestamp": 1893456000,
    "description": "Order #1042",
    "brand": "${brand}"
  }'`}</Snippet>
            <p>
              On the API, <C>amount</C> is in base units: 1 USDC is <C>1000000</C>, so 9.77 is <C>9770000</C>. Once the
              money arrives, send the answer&apos;s <C>settle.request.body</C> unchanged to <C>POST /api/ap2/settle</C>.
              Every field is described in the{' '}
              <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="underline text-primary-600 dark:text-primary-400">
                API reference
              </a>
              .
            </p>
          </Step>

          <Step id="confirm" n="Step 6" title="Confirm payments" roles={['merchant', 'partner']} who="Your merchants check each payment before shipping. You can see every payment made under your brand.">
            <p>Check a payment before shipping anything. The results service is public and needs no key. Treat it as the source of truth; a webhook only tells you to look.</p>
            <Snippet label="your merchants · check one payment">{`curl -X POST ${API}/api/results \\
  -H 'Content-Type: application/json' \\
  -d '{"contractid": "507f1f77bcf86cd799439011"}'`}</Snippet>
            <Snippet label="you · every payment made under your brand">{`curl -X POST ${API}/api/results \\
  -H 'Content-Type: application/json' \\
  -d '{"brandId": "${brand}"}'`}</Snippet>
            <p>
              A payment has arrived when its <C>state</C> is one of <C>ACTIVE</C>, <C>DISPUTED</C>, <C>RESOLVED</C>,{' '}
              <C>CLAIMED</C> or <C>COMPLETED</C>. Having a <C>chainAddress</C> does not mean it was paid: the address is
              recorded when the buyer opens the checkout.
            </p>
          </Step>

          <Step id="test" n="Step 7" title="Test end to end" roles={['partner', 'us']} who="You run these checks on your pages; we fix anything on our side. An empty frame means step 3 is not done yet: tell us.">
            <ul className="list-disc pl-5 space-y-1">
              <li>Each hosted page shows our page inside it, in the partner&apos;s branding (an empty frame means the domain is not on the allow-list yet).</li>
              <li><C>your-site/contract-create?seller=…&amp;amount=0.001&amp;description=Test</C> opens a checkout for the free test amount.</li>
              <li>Pay it; the payment appears in <C>/api/results</C> under your brand id.</li>
              <li>The developer guide&apos;s samples show your brand id and your support contact.</li>
              <li>A merchant&apos;s checkout button opens the popup and calls <C>onSuccess</C> after paying.</li>
            </ul>
          </Step>

          <section id="limits" className="border-t border-secondary-200 dark:border-secondary-700 pt-8">
            <div className="flex flex-wrap items-baseline gap-x-4 mb-4">
              <span className="font-semibold text-primary-600 dark:text-primary-400">Good to know</span>
              <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white">Limits of framed pages</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-secondary-700 dark:text-secondary-300">
              <li><strong>Google sign-in cannot run inside a frame.</strong> Buyers inside your page get email sign-in and an &quot;open in a new tab&quot; option for Google. Some browsers, notably Safari, may not keep a sign-in inside a frame.</li>
              <li><strong>Links we generate are on our domain.</strong> Payment links, request emails and dashboard links open <C>stabledrop.me/…?b={brand}</C>: your branding, our address.</li>
              <li><strong>No webhooks to the partner.</strong> Partners follow their payments through the results service, filtered by brand id.</li>
              <li><strong>Calling our API from a browser page</strong> on your domain needs your origin allowed for cross-origin requests. Calls from a server do not.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
