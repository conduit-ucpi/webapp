import React from 'react';
import Link from 'next/link';

export default function ShopifyIndex() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: '40px', background: '#fafbfb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '8px', padding: '40px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <h1 style={{ color: '#202223', marginBottom: '16px', fontSize: '36px' }}>💰 USDC Payments for Shopify</h1>
        <p style={{ color: '#6d7175', fontSize: '18px', lineHeight: '1.6', marginBottom: '32px' }}>
          Accept USDC payments on any Shopify store with built-in buyer protection.<br />
          <strong>FREE to install • Only 1% transaction fee • 14-day escrow protection</strong>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', margin: '40px 0' }}>
          <div style={{ padding: '30px', border: '2px solid #667eea', borderRadius: '12px', background: '#f8f9ff' }}>
            <h2 style={{ color: '#667eea', marginBottom: '16px' }}>🛒 For Merchants</h2>
            <p style={{ color: '#6d7175', marginBottom: '20px' }}>Add USDC checkout to your store in 2 minutes</p>
            <ul style={{ textAlign: 'left', color: '#6d7175', paddingLeft: '20px', marginBottom: '24px' }}>
              <li>✅ No monthly fees</li>
              <li>✅ Automatic escrow protection</li>
              <li>✅ Direct to your wallet</li>
              <li>✅ Works on any Shopify store</li>
            </ul>
            <Link
              href="/shopify/install-button"
              style={{ background: '#667eea', color: 'white', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', fontWeight: '600', fontSize: '16px' }}
            >
              Install Button Now
            </Link>
          </div>

          <div style={{ padding: '30px', border: '2px solid #10b981', borderRadius: '12px', background: '#f0fdf4' }}>
            <h2 style={{ color: '#10b981', marginBottom: '16px' }}>🔒 For Customers</h2>
            <p style={{ color: '#6d7175', marginBottom: '20px' }}>Safe, secure USDC payments with protection</p>
            <ul style={{ textAlign: 'left', color: '#6d7175', paddingLeft: '20px', marginBottom: '24px' }}>
              <li>✅ No gas fees</li>
              <li>✅ 14-day dispute window</li>
              <li>✅ Wallet or email payment</li>
              <li>✅ Built-in buyer protection</li>
            </ul>
            <a
              href="#how-it-works"
              style={{ background: '#10b981', color: 'white', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', fontWeight: '600', fontSize: '16px' }}
            >
              How It Works
            </a>
          </div>
        </div>

        <div id="how-it-works" style={{ textAlign: 'left', margin: '50px 0' }}>
          <h2 style={{ color: '#202223', marginBottom: '30px', textAlign: 'center' }}>🚀 How It Works</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', margin: '30px 0' }}>
            <div>
              <h3 style={{ color: '#667eea', marginBottom: '15px' }}>For Merchants:</h3>
              <ol style={{ color: '#6d7175', paddingLeft: '20px', lineHeight: '1.8' }}>
                <li>Add one line of JavaScript to your theme</li>
                <li>"Buy with USDC" button appears automatically</li>
                <li>Customer clicks → Opens secure checkout</li>
                <li>Payment goes to escrow for 14 days</li>
                <li>After protection period → USDC sent to your wallet</li>
              </ol>
            </div>

            <div>
              <h3 style={{ color: '#10b981', marginBottom: '15px' }}>For Customers:</h3>
              <ol style={{ color: '#6d7175', paddingLeft: '20px', lineHeight: '1.8' }}>
                <li>Click "Buy with USDC" on any product</li>
                <li>Connect wallet or use email</li>
                <li>Pay with USDC (no gas fees)</li>
                <li>Get 14-day protection period</li>
                <li>Can dispute if product not received</li>
              </ol>
            </div>
          </div>
        </div>

        <div style={{ background: '#f0f8ff', padding: '30px', borderRadius: '12px', margin: '40px 0' }}>
          <h3 style={{ color: '#202223', marginBottom: '20px' }}>💡 Why Choose USDC Payments?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', textAlign: 'left' }}>
            <div>
              <p><strong>🏦 For Merchants:</strong></p>
              <ul style={{ color: '#6d7175', paddingLeft: '20px' }}>
                <li>No chargebacks</li>
                <li>Faster settlements</li>
                <li>Global reach</li>
                <li>Lower fees than credit cards</li>
              </ul>
            </div>
            <div>
              <p><strong>👥 For Customers:</strong></p>
              <ul style={{ color: '#6d7175', paddingLeft: '20px' }}>
                <li>Stable value (pegged to USD)</li>
                <li>No credit card needed</li>
                <li>Built-in buyer protection</li>
                <li>Privacy-friendly</li>
              </ul>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '40px', borderRadius: '12px', margin: '40px 0' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '24px' }}>Ready to Get Started?</h3>
          <p style={{ marginBottom: '30px', opacity: 0.9 }}>Join thousands of merchants already accepting USDC payments</p>
          <Link
            href="/shopify/install-button"
            style={{ background: 'white', color: '#667eea', padding: '16px 32px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', fontWeight: '700', fontSize: '18px' }}
          >
            Install Button - FREE
          </Link>
        </div>

        <div style={{ borderTop: '1px solid #eee', paddingTop: '30px', marginTop: '50px' }}>
          <p style={{ color: '#6d7175', fontSize: '14px' }}>
            Questions? Visit our <Link href="/faq" style={{ color: '#667eea' }}>FAQ</Link> or{' '}
            <Link href="/dashboard" style={{ color: '#667eea' }}>contact support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}