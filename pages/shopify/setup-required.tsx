import React from 'react';
import { useRouter } from 'next/router';

/**
 * Shown when a Shopify store hits quick-checkout before its wallet is configured.
 *
 * Lifted verbatim from the `isConfigured === false` branch of the old
 * pages/shopify/quick-checkout.tsx. That page read the shop from
 * getServerSideProps; here it comes from the query string on the client, so the
 * page is fully static and exportable.
 */
export default function ShopifySetupRequired() {
  const router = useRouter();
  const raw = router.query.shop;
  const shop = Array.isArray(raw) ? raw[0] : raw || '';

  return (
    <div style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Setup Required</h1>
      </div>
      <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#333' }}>Merchant Not Configured</h3>
          <p>This store hasn&apos;t completed their USDC payment setup yet. Please ask the store owner to:</p>
          <ol>
            <li>Visit the InstantEscrow setup page</li>
            <li>Connect their Shopify store</li>
            <li>Configure their wallet address</li>
          </ol>
          <p style={{ marginTop: '20px' }}>
            Store: <strong>{shop}</strong>
          </p>
          <a
            href={`/api/shopify/auth?shop=${encodeURIComponent(shop)}`}
            style={{
              background: '#667eea',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '6px',
              textDecoration: 'none',
              display: 'inline-block',
              marginTop: '20px'
            }}
          >
            Configure This Store
          </a>
        </div>
      </div>
    </div>
  );
}
