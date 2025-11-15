import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';

export default function InstallButton() {
  const router = useRouter();
  const { shop, configured } = router.query;
  const [activeTab, setActiveTab] = useState('simple');
  const [shopDomain, setShopDomain] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  const pageTitle = "Install USDC Checkout Button for Shopify | 2-Minute Setup";
  const pageDescription = "Install the universal 'Buy with USDC' cryptocurrency payment button on your Shopify store in 2 minutes. Free to install, 1% transaction fee, automatic escrow protection, works on any Shopify theme.";
  const pageUrl = "https://conduit-ucpi.com/shopify/install-button";
  const imageUrl = "https://conduit-ucpi.com/og-shopify-install.png";

  // Structured data for HowTo
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Install USDC Payment Button on Shopify",
    "description": pageDescription,
    "totalTime": "PT2M",
    "step": [
      {
        "@type": "HowToStep",
        "name": "Copy the JavaScript code",
        "text": "Copy the single line of JavaScript code provided for your Shopify store"
      },
      {
        "@type": "HowToStep",
        "name": "Open theme editor",
        "text": "Go to Online Store → Themes, click the three dots, and select 'Edit code'"
      },
      {
        "@type": "HowToStep",
        "name": "Add code to theme.liquid",
        "text": "Open Layout → theme.liquid, find </head>, paste the code just before it, and save"
      }
    ],
    "tool": [{
      "@type": "HowToTool",
      "name": "Shopify Admin Access"
    }]
  };

  useEffect(() => {
    if (configured === 'true' && shop) {
      setIsConfigured(true);
      toast.success('Settings saved! Now add the button to your store.');
    }
  }, [configured, shop]);

  const handleShopifyConnect = (e: React.FormEvent) => {
    e.preventDefault();

    if (!shopDomain) {
      toast.error('Please enter your shop domain');
      return;
    }

    // Remove http:// or https:// prefix if present
    let cleanedDomain = shopDomain.trim();
    cleanedDomain = cleanedDomain.replace(/^https?:\/\//i, '');

    // Ensure proper format
    const domain = cleanedDomain.includes('.') ? cleanedDomain : `${cleanedDomain}.myshopify.com`;

    // Redirect to OAuth flow
    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(domain)}`;
  };

  const copyCode = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      navigator.clipboard.writeText(element.textContent || '');
      // Could add toast notification here
    }
  };

  return (
    <React.Fragment>
      <Head>
        {/* Primary Meta Tags */}
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content="install USDC button Shopify, Shopify cryptocurrency integration, add crypto payments Shopify, USDC checkout setup, Shopify Web3 payments, blockchain Shopify plugin, stablecoin payments Shopify" />

        {/* Canonical URL */}
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:site_name" content="Conduit UCPI" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        <meta property="twitter:image" content={imageUrl} />

        {/* Additional SEO Meta Tags */}
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="author" content="Conduit UCPI" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>

      <div className="bg-gray-50 min-h-screen py-4 sm:py-6 lg:py-8 px-4 sm:px-6">
        <article className="max-w-5xl mx-auto bg-white rounded-lg p-4 sm:p-6 lg:p-8 shadow-sm">
          <header className="mb-6">
            <h1 className="text-secondary-900 m-0 mb-2 text-2xl sm:text-3xl lg:text-4xl font-bold">Shopify USDC Payment Integration</h1>
            <p className="text-secondary-600 mb-4 sm:mb-6 text-sm sm:text-base">Deploy cryptocurrency payment processing to your Shopify store. <strong>No monthly fees • 1% transaction rate • Enterprise-grade security</strong></p>
          </header>

        {/* Important first step */}
        <section className="bg-yellow-50 border-2 border-yellow-400 p-4 sm:p-5 rounded-lg my-4 sm:my-5" aria-label="Required wallet configuration">
          <h2 className="text-yellow-800 m-0 mb-3 text-lg sm:text-xl font-bold">Prerequisites: Wallet Registration</h2>
          <p className="text-yellow-800 mb-3 text-sm sm:text-base">
            Before deploying the payment integration, you must register your settlement wallet address:
          </p>
          <ol className="text-yellow-800 pl-5 mb-3 space-y-1 text-sm sm:text-base">
            <li>Access the platform at <a href="https://app.instantescrow.nz" target="_blank" rel="noopener noreferrer" className="text-primary-500 font-bold hover:text-primary-600">app.instantescrow.nz</a></li>
            <li>Authenticate with your Web3 wallet to register your merchant ID</li>
            <li>Return here to complete Shopify theme integration</li>
          </ol>
          <p className="text-yellow-800 text-xs sm:text-sm mb-0">
            One-time setup. Your wallet address establishes the settlement endpoint for all USDC transactions.
          </p>
        </section>

        {/* Show setup form if not configured */}
        {!isConfigured && !shop && (
          <section className="bg-blue-50 border-2 border-primary-500 p-4 sm:p-6 rounded-lg my-4 sm:my-5" aria-label="Shopify store authorization">
            <h2 className="text-primary-500 m-0 mb-3 sm:mb-4 text-lg sm:text-xl font-bold">Step 1: Authorize Store Access</h2>
            <p className="text-secondary-600 mb-4 sm:mb-5 text-sm sm:text-base">
              Link your Shopify store to configure payment routing and settlement parameters.
            </p>
            <form onSubmit={handleShopifyConnect} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                required
                className="flex-1 p-3 border-2 border-gray-300 rounded-md text-base focus:border-primary-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-primary-500 text-white py-3 px-5 sm:px-6 border-none rounded-md text-base font-bold cursor-pointer hover:bg-primary-600 transition-colors"
              >
                Connect Store
              </button>
            </form>
            <p className="text-sm text-secondary-600 mt-3">
              You will be redirected to Shopify's OAuth flow to authorize secure API access.
            </p>
          </section>
        )}

        {/* Show success message if configured */}
        {isConfigured && shop && (
          <div className="bg-green-50 border border-green-300 text-green-900 p-3 sm:p-4 rounded-md my-4 text-sm sm:text-base">
            ✓ <strong>Store Authorization Complete</strong> | Domain: {shop}<br />
            ✓ Proceed to theme integration below
          </div>
        )}

        {/* Show default message if viewing page directly */}
        {!isConfigured && shop === undefined && (
          <div className="bg-green-50 border border-green-300 text-green-900 p-3 sm:p-4 rounded-md my-4 text-sm sm:text-base">
            ✓ <strong>Platform Status: Operational</strong><br />
            ✓ Escrow protection period: <strong>14 days</strong> | Settlement: <strong>Automated</strong>
          </div>
        )}

        <h2 className="text-secondary-900 mt-6 sm:mt-8 text-xl sm:text-2xl font-bold">
          {isConfigured || shop ? 'Step 2: ' : ''}Theme Integration Methods
        </h2>

        <div style={{ display: 'flex', gap: '10px', margin: '20px 0', borderBottom: '2px solid #eee' }}>
          {['simple', 'advanced', 'liquid'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: activeTab === tab ? '#008060' : '#6d7175',
                fontWeight: '500',
                borderBottom: activeTab === tab ? '2px solid #008060' : 'none',
                marginBottom: activeTab === tab ? '-2px' : '0'
              }}
            >
              {tab === 'simple' && 'Simple (Copy & Paste)'}
              {tab === 'advanced' && 'Advanced (Customizable)'}
              {tab === 'liquid' && 'Liquid Theme'}
            </button>
          ))}
        </div>

        {activeTab === 'simple' && (
          <div>
            <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', margin: '0 0 15px' }}>
                <span style={{ background: '#667eea', color: 'white', width: '30px', height: '30px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', fontWeight: 'bold' }}>1</span>
                Copy this code
              </h3>
              <p>This single line adds the button to ALL product pages automatically:</p>
              <div style={{ background: '#f4f6f8', border: '1px solid #dfe3e8', borderRadius: '6px', padding: '16px', position: 'relative', overflowX: 'auto' }}>
                <button
                  onClick={() => copyCode('simple-code')}
                  style={{ position: 'absolute', top: '10px', right: '10px', background: '#008060', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Copy Code
                </button>
                <code id="simple-code" style={{ fontFamily: 'Monaco, "Courier New", monospace', fontSize: '14px' }}>
                  {`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz'}/shopify-checkout.js" async></script>`}
                </code>
              </div>
            </div>

            <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', margin: '0 0 15px' }}>
                <span style={{ background: '#667eea', color: 'white', width: '30px', height: '30px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', fontWeight: 'bold' }}>2</span>
                Add to your theme
              </h3>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Go to <strong>Online Store → Themes</strong></li>
                <li>Find your current theme and click the <strong>three dots (...)</strong> button</li>
                <li>Select <strong>Edit code</strong> from the dropdown</li>
                <li>In the file list, open <strong>Layout</strong> folder → click <strong>theme.liquid</strong></li>
                <li>Search for <code>&lt;/head&gt;</code> (use Ctrl+F or Cmd+F)</li>
                <li>Paste the code just before <code>&lt;/head&gt;</code></li>
                <li>Click <strong>Save</strong> (top right)</li>
              </ol>
            </div>

            <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', margin: '0 0 15px' }}>
                <span style={{ background: '#667eea', color: 'white', width: '30px', height: '30px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', fontWeight: 'bold' }}>3</span>
                That's it! 🎉
              </h3>
              <p>The button will automatically appear on:</p>
              <ul>
                <li>✓ All product pages</li>
                <li>✓ Cart page (Express checkout)</li>
                <li>✓ Quick shop modals</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
            <h3>Custom Integration</h3>
            <p>For more control, you can manually trigger checkout:</p>
            <div style={{ background: '#f4f6f8', border: '1px solid #dfe3e8', borderRadius: '6px', padding: '16px', position: 'relative', overflowX: 'auto' }}>
              <button
                onClick={() => copyCode('advanced-code')}
                style={{ position: 'absolute', top: '10px', right: '10px', background: '#008060', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                Copy Code
              </button>
              <code id="advanced-code" style={{ fontFamily: 'Monaco, "Courier New", monospace', fontSize: '14px', whiteSpace: 'pre' }}>
{`// Load the script
<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz'}/shopify-checkout.js"></script>

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
              </code>
            </div>
          </div>
        )}

        {activeTab === 'liquid' && (
          <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
            <h3>Liquid Template Integration</h3>
            <p>Add directly to product templates:</p>
            <div style={{ background: '#f4f6f8', border: '1px solid #dfe3e8', borderRadius: '6px', padding: '16px', position: 'relative', overflowX: 'auto' }}>
              <button
                onClick={() => copyCode('liquid-code')}
                style={{ position: 'absolute', top: '10px', right: '10px', background: '#008060', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                Copy Code
              </button>
              <code id="liquid-code" style={{ fontFamily: 'Monaco, "Courier New", monospace', fontSize: '14px', whiteSpace: 'pre' }}>
{`{% comment %} Add to product-template.liquid {% endcomment %}
{% if product.available %}
  <button
    onclick="window.open('${typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz'}/shopify/quick-checkout?shop={{ shop.domain }}&product_id={{ product.id }}&variant_id={{ product.selected_or_first_available_variant.id }}&title={{ product.title | escape }}&price={{ product.price | money_without_currency }}&quantity=1', 'instantEscrow', 'width=500,height=700')"
    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px;"
  >
    Buy with USDC - Instant Checkout
  </button>
{% endif %}`}
              </code>
            </div>
          </div>
        )}

        <h2 style={{ color: '#202223', marginTop: '30px' }}>🎨 Button Preview</h2>
        <div style={{ border: '2px solid #667eea', borderRadius: '8px', padding: '20px', margin: '20px 0', background: 'white', textAlign: 'center' }}>
          <p style={{ color: '#6d7175', marginBottom: '15px' }}>This is how it looks on product pages:</p>
          <button style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '16px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
            maxWidth: '300px',
            margin: '10px auto',
            display: 'block',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
          }}>
            Buy with USDC - Instant Checkout
          </button>
          <p style={{ fontSize: '14px', color: '#667eea', marginTop: '10px' }}>
            🔒 Protected by 14-day escrow • No gas fees
          </p>
        </div>

        <h2 style={{ color: '#202223', marginTop: '30px' }}>💰 How Payments Work</h2>
        <ol style={{ paddingLeft: '20px' }}>
          <li><strong>Customer clicks button</strong> → Opens secure checkout</li>
          <li><strong>Pays with USDC</strong> → Via wallet or email (Web3Auth)</li>
          <li><strong>Order created</strong> → Automatically in your system</li>
          <li><strong>Escrow protection</strong> → 14 days for disputes</li>
          <li><strong>Automatic payout</strong> → Direct to merchant wallet</li>
        </ol>

        <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 sm:p-4 rounded-md my-4 text-sm sm:text-base">
          <strong>Integration Testing:</strong> Verify payment flow in an incognito browser session to simulate customer experience without cached authentication state.
        </div>
        </article>
      </div>
    </React.Fragment>
  );
}