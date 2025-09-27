import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

export default function InstallButton() {
  const router = useRouter();
  const { shop, configured } = router.query;
  const [activeTab, setActiveTab] = useState('simple');
  const [shopDomain, setShopDomain] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

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

    // Ensure proper format
    const domain = shopDomain.includes('.') ? shopDomain : `${shopDomain}.myshopify.com`;

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
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: '20px', background: '#fafbfb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#202223', margin: '0 0 8px' }}>🚀 Install Universal "Buy with USDC" Button</h1>
        <p style={{ color: '#6d7175', marginBottom: '24px' }}>Add instant USDC checkout to ANY Shopify store in 2 minutes - <strong>FREE to install, only 1% transaction fee!</strong></p>

        {/* Show setup form if not configured */}
        {!isConfigured && !shop && (
          <div style={{ background: '#f0f8ff', border: '2px solid #667eea', padding: '24px', borderRadius: '8px', margin: '20px 0' }}>
            <h2 style={{ color: '#667eea', margin: '0 0 16px' }}>🔐 Step 1: Connect Your Shopify Store</h2>
            <p style={{ color: '#6d7175', marginBottom: '20px' }}>
              First, connect your Shopify store and configure your wallet address to receive USDC payments.
            </p>
            <form onSubmit={handleShopifyConnect} style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                required
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '2px solid #dfe3e8',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#667eea',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Connect Store
              </button>
            </form>
            <p style={{ fontSize: '14px', color: '#6d7175', marginTop: '12px' }}>
              You'll be redirected to Shopify to authorize the connection.
            </p>
          </div>
        )}

        {/* Show success message if configured */}
        {isConfigured && shop && (
          <div style={{ background: '#d1e7dd', border: '1px solid #badbcc', color: '#0f5132', padding: '12px', borderRadius: '6px', margin: '16px 0' }}>
            ✅ <strong>Store configured!</strong> Shop: {shop}<br />
            ✅ Now add the button code to your theme below
          </div>
        )}

        {/* Show default message if viewing page directly */}
        {!isConfigured && shop === undefined && (
          <div style={{ background: '#d1e7dd', border: '1px solid #badbcc', color: '#0f5132', padding: '12px', borderRadius: '6px', margin: '16px 0' }}>
            ✅ <strong>Ready to use!</strong><br />
            ✅ Escrow protection: <strong>14 days</strong>
          </div>
        )}

        <h2 style={{ color: '#202223', marginTop: '30px' }}>
          {isConfigured || shop ? 'Step 2: ' : ''}Installation Methods
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

        <div style={{ background: '#fff3cd', border: '1px solid #ffecb5', color: '#664d03', padding: '12px', borderRadius: '6px', margin: '16px 0' }}>
          <strong>⚠️ Testing:</strong> Visit your store in incognito mode to test the button as a customer would see it.
        </div>
      </div>
    </div>
  );
}