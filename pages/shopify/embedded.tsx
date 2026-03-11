import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function ShopifyEmbedded() {
  const router = useRouter();
  const { shop, host } = router.query;
  const [shopDomain, setShopDomain] = useState('');

  useEffect(() => {
    if (shop) {
      setShopDomain(shop as string);
    }
  }, [shop]);

  return (
    <>
      <Head>
        <title>InstantEscrow USDC Payments</title>
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </Head>

      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        margin: 0,
        padding: '20px',
        background: '#fafbfb',
        minHeight: '100vh',
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h1 style={{ color: '#202223', marginBottom: '8px' }}>
            InstantEscrow Payment Gateway
          </h1>
          <p style={{ color: '#6d7175', marginBottom: '24px' }}>
            Accept USDC payments with automatic buyer protection
          </p>

          <div style={{
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            background: '#d1e7dd',
            border: '1px solid #badbcc',
            color: '#0f5132',
          }}>
            Your app is installed and ready to use.
          </div>

          <h2 style={{ color: '#202223' }}>Features</h2>
          <ul style={{ color: '#6d7175', lineHeight: '1.8' }}>
            <li>Accept USDC payments on Base blockchain</li>
            <li>Automatic escrow protection for buyers (14-day default)</li>
            <li>1% transaction fee, no monthly fees</li>
            <li>Built-in dispute resolution</li>
            <li>Works on any Shopify theme</li>
          </ul>

          <h2 style={{ color: '#202223', marginTop: '24px' }}>Quick Setup</h2>
          <ol style={{ color: '#6d7175', lineHeight: '1.8' }}>
            <li>
              <a
                href="/shopify/install-button"
                target="_top"
                style={{ color: '#008060', textDecoration: 'none', fontWeight: 500 }}
              >
                Configure your wallet &amp; get the install code
              </a>
            </li>
            <li>Add the script tag to your theme (2-minute setup)</li>
            <li>Start accepting USDC payments with buyer protection</li>
          </ol>

          <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
            <a
              href="/shopify/install-button"
              target="_top"
              style={{
                background: '#008060',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                textDecoration: 'none',
                display: 'inline-block',
                fontWeight: 500,
              }}
            >
              Setup Guide
            </a>
            <a
              href="/shopify/merchant-settings"
              target="_top"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                textDecoration: 'none',
                display: 'inline-block',
                fontWeight: 500,
              }}
            >
              Merchant Settings
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
