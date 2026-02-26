import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import SEO from '@/components/SEO';
import Fade from '@/components/ui/Fade';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { btnPrimary } from '@/utils/landingStyles';
import WalletRegistrationPrereq from '@/components/ui/WalletRegistrationPrereq';

const integrationTabs = [
  { id: 'simple', label: 'Simple (Copy & Paste)' },
  { id: 'advanced', label: 'Advanced (Customizable)' },
  { id: 'liquid', label: 'Liquid Theme' },
];

// Structured data for HowTo
const structuredData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Install USDC Payment Button on Shopify",
  "description": "Install the universal 'Buy with USDC' cryptocurrency payment button on your Shopify store in 2 minutes. Free to install, 1% transaction fee, automatic escrow protection, works on any Shopify theme.",
  "totalTime": "PT2M",
  "step": [
    { "@type": "HowToStep", "name": "Copy the JavaScript code", "text": "Copy the single line of JavaScript code provided for your Shopify store" },
    { "@type": "HowToStep", "name": "Open theme editor", "text": "Go to Online Store → Themes, click the three dots, and select 'Edit code'" },
    { "@type": "HowToStep", "name": "Add code to theme.liquid", "text": "Open Layout → theme.liquid, find </head>, paste the code just before it, and save" },
  ],
  "tool": [{ "@type": "HowToTool", "name": "Shopify Admin Access" }],
};

function CodeBlock({ id, children }: { id: string; children: string }) {
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

export default function InstallButton() {
  const router = useRouter();
  const { shop, configured } = router.query;
  const [activeTab, setActiveTab] = useState('simple');
  const [shopDomain, setShopDomain] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz';

  useEffect(() => {
    if (configured === 'true' && shop) {
      setIsConfigured(true);
      toast.success('Settings saved! Now add the button to your store.');
    }
  }, [configured, shop]);

  const handleShopifyConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopDomain) { toast.error('Please enter your shop domain'); return; }
    let cleanedDomain = shopDomain.trim().replace(/^https?:\/\//i, '');
    const domain = cleanedDomain.includes('.') ? cleanedDomain : `${cleanedDomain}.myshopify.com`;
    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(domain)}`;
  };

  return (
    <>
      <SEO
        title="Install USDC Checkout Button for Shopify | 2-Minute Setup"
        description="Install the universal 'Buy with USDC' cryptocurrency payment button on your Shopify store in 2 minutes. Free to install, 1% transaction fee, automatic escrow protection."
        keywords="install USDC button Shopify, Shopify cryptocurrency integration, add crypto payments Shopify, USDC checkout setup, stablecoin payments Shopify"
        canonical="/shopify/install-button"
        structuredData={structuredData}
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
                Shopify Integration
              </p>
              <h1
                className="text-4xl sm:text-5xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl"
              >
                Add escrow checkout to your Shopify store.
              </h1>
              <p
                className="mt-6 text-base text-secondary-500 dark:text-secondary-400 max-w-xl leading-relaxed"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                No monthly fees. 1% per transaction. Enterprise-grade escrow protection on every sale.
              </p>
              <div className="mt-14 flex flex-wrap gap-x-8 gap-y-2 text-xs text-secondary-400 dark:text-secondary-500">
                <span>2-minute setup</span>
                <span>Works on any theme</span>
                <span>No app install required</span>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PREREQUISITES                                                    */}
        {/* ================================================================ */}
        <WalletRegistrationPrereq />

        {/* ================================================================ */}
        {/* AUTHORIZE STORE                                                  */}
        {/* ================================================================ */}
        {!isConfigured && !shop && (
          <section
            className="border-t border-secondary-100 dark:border-secondary-800"
            aria-label="Authorize store"
          >
            <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
              <Fade>
                <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                  Step 1
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  Authorize store access.
                </h2>
                <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8 max-w-md">
                  Link your Shopify store to configure payment routing and settlement parameters.
                </p>
                <form onSubmit={handleShopifyConnect} className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-lg">
                  <input
                    type="text"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="your-store.myshopify.com"
                    required
                    className="flex-1 px-4 py-3 border border-secondary-300 dark:border-secondary-600 rounded bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white text-sm focus:border-primary-500 focus:outline-none transition-colors"
                  />
                  <button type="submit" className={btnPrimary}>
                    Connect Store
                  </button>
                </form>
                <p className="text-xs text-secondary-400 dark:text-secondary-500 mt-4">
                  You will be redirected to Shopify&apos;s OAuth flow to authorize secure API access.
                </p>
              </Fade>
            </div>
          </section>
        )}

        {/* Status messages */}
        {isConfigured && shop && (
          <section className="border-t border-secondary-100 dark:border-secondary-800">
            <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8">
              <p className="text-sm text-primary-600 dark:text-primary-400">
                Store authorization complete — <strong>{shop}</strong>. Proceed to theme integration below.
              </p>
            </div>
          </section>
        )}

        {!isConfigured && shop === undefined && (
          <section className="border-t border-secondary-100 dark:border-secondary-800">
            <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8">
              <p className="text-sm text-secondary-500 dark:text-secondary-400">
                Platform status: <strong className="text-secondary-900 dark:text-white">Operational</strong> — Escrow protection: <strong className="text-secondary-900 dark:text-white">14 days</strong> — Settlement: <strong className="text-secondary-900 dark:text-white">Automated</strong>
              </p>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* THEME INTEGRATION                                                */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Theme integration"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {isConfigured || shop ? 'Step 2' : 'Integration'}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Theme integration methods.
              </h2>
            </Fade>

            <Tabs
              tabs={integrationTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              className="mb-8"
            />

            <TabPanel isActive={activeTab === 'simple'}>
              <div className="space-y-12">
                <Fade>
                  <div>
                    <StepNumber n={1} />
                    <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Copy this code</h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                      This single line adds the button to all product pages automatically.
                    </p>
                    <CodeBlock id="simple-code">
                      {`<script src="${origin}/shopify-checkout.js" async></script>`}
                    </CodeBlock>
                  </div>
                </Fade>

                <Fade delay={0.1}>
                  <div>
                    <StepNumber n={2} />
                    <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Add to your theme</h3>
                    <ol className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed space-y-2 pl-5 list-decimal">
                      <li>Go to <strong className="text-secondary-900 dark:text-white">Online Store &rarr; Themes</strong></li>
                      <li>Find your current theme and click the <strong className="text-secondary-900 dark:text-white">three dots (&hellip;)</strong> button</li>
                      <li>Select <strong className="text-secondary-900 dark:text-white">Edit code</strong> from the dropdown</li>
                      <li>In the file list, open <strong className="text-secondary-900 dark:text-white">Layout</strong> folder &rarr; click <strong className="text-secondary-900 dark:text-white">theme.liquid</strong></li>
                      <li>Search for <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">&lt;/head&gt;</code> (use Ctrl+F or Cmd+F)</li>
                      <li>Paste the code just before <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">&lt;/head&gt;</code></li>
                      <li>Click <strong className="text-secondary-900 dark:text-white">Save</strong> (top right)</li>
                    </ol>
                  </div>
                </Fade>

                <Fade delay={0.2}>
                  <div>
                    <StepNumber n={3} />
                    <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Done</h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400">
                      The button will automatically appear on all product pages, the cart page, and quick shop modals.
                    </p>
                  </div>
                </Fade>
              </div>
            </TabPanel>

            <TabPanel isActive={activeTab === 'advanced'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Custom integration</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    For more control, you can manually trigger checkout.
                  </p>
                  <CodeBlock id="advanced-code">
{`// Load the script
<script src="${origin}/shopify-checkout.js"></script>

// Custom button anywhere
<button onclick="InstantEscrow.checkout()">
  Pay with USDC
</button>

// Or programmatically
<script>
  document.getElementById('my-button').addEventListener('click', function() {
    InstantEscrow.checkout();
  });
</script>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={activeTab === 'liquid'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">Liquid template integration</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    Add directly to product templates.
                  </p>
                  <CodeBlock id="liquid-code">
{`{% comment %} Add to product-template.liquid {% endcomment %}
{% if product.available %}
  <button
    onclick="window.open('${origin}/shopify/quick-checkout?shop={{ shop.domain }}&product_id={{ product.id }}&variant_id={{ product.selected_or_first_available_variant.id }}&title={{ product.title | escape }}&price={{ product.price | money_without_currency }}&quantity=1', 'instantEscrow', 'width=500,height=700')"
    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px;"
  >
    Buy with USDC - Instant Checkout
  </button>
{% endif %}`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>
          </div>
        </section>

        {/* ================================================================ */}
        {/* BUTTON PREVIEW                                                   */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label="Button preview"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20 text-center">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                Preview
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-8"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                How it looks on product pages.
              </h2>
              <div className="inline-block bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-8 shadow-sm">
                <button
                  className="w-full max-w-[300px] py-4 px-6 rounded-lg text-white font-bold text-base cursor-default"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  Buy with USDC - Instant Checkout
                </button>
                <p className="text-xs text-secondary-400 dark:text-secondary-500 mt-3">
                  Protected by 14-day escrow &middot; No gas fees
                </p>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* HOW PAYMENTS WORK                                                */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="How payments work"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-16">
                How payments work
              </p>
            </Fade>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-x-12 gap-y-12">
              {[
                { num: '01', title: 'Customer clicks button', desc: 'Opens secure checkout window.' },
                { num: '02', title: 'Pays with USDC', desc: 'Via wallet or email sign-in.' },
                { num: '03', title: 'Order created', desc: 'Automatically in your Shopify system.' },
                { num: '04', title: 'Escrow protection', desc: '14 days for dispute resolution.' },
                { num: '05', title: 'Automatic payout', desc: 'Direct to your merchant wallet.' },
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
        {/* TESTING TIP                                                      */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Testing"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-12">
            <p className="text-sm text-secondary-500 dark:text-secondary-400">
              <strong className="text-secondary-900 dark:text-white">Testing tip:</strong> Verify the payment flow in an incognito browser session to simulate the customer experience without cached authentication state.
            </p>
          </div>
        </section>

      </div>
    </>
  );
}
