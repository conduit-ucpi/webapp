import React from 'react';
import { GetServerSideProps } from 'next';
import { getMerchantSettings } from '../../lib/mongodb';

interface QuickCheckoutProps {
  shop: string;
  productData: {
    title: string;
    price: string;
    quantity: number;
    total: string;
  };
  orderId: string;
  paymentUrl: string;
  escrowDays: number;
  isConfigured: boolean;
}

export default function QuickCheckout({
  shop,
  productData,
  orderId,
  paymentUrl,
  escrowDays,
  isConfigured
}: QuickCheckoutProps) {
  // If merchant not configured, show setup message
  if (!isConfigured) {
    return (
      <div style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Setup Required</h1>
        </div>
        <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#333' }}>Merchant Not Configured</h3>
            <p>This store hasn't completed their USDC payment setup yet. Please ask the store owner to:</p>
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

  return (
    <div style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Quick Checkout</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Pay with USDC - Instant & Secure</p>
      </div>

      <div style={{ maxWidth: '500px', margin: '20px auto', padding: '0 20px' }}>
        {/* Order Summary */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 15px', color: '#333' }}>Order Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <span>{productData.title} × {productData.quantity}</span>
            <span>${productData.price}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 'bold', marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #eee' }}>
            <span>Total:</span>
            <span>{productData.total} USDC</span>
          </div>
        </div>

        {/* Escrow Info */}
        <div style={{ background: '#f0f8ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
          🔒 Your payment is protected by {escrowDays}-day escrow
        </div>

        {/* Connect Account Prompt */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '40px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h2 style={{ color: '#333', margin: '0 0 15px', fontSize: '24px' }}>Connect Your Account</h2>
          <p style={{ color: '#666', margin: '0 0 30px', fontSize: '16px' }}>
            To complete your purchase with USDC, you'll need to connect your wallet or sign in.
          </p>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '8px',
              textDecoration: 'none',
              display: 'inline-block',
              fontSize: '18px',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const {
    shop,
    product_id,
    variant_id,
    title = 'Product',
    price = '0',
    quantity = '1',
    cart,
    type = 'product'
  } = context.query;

  if (!shop) {
    return {
      notFound: true,
    };
  }

  // Fetch merchant settings
  const merchantSettings = await getMerchantSettings(shop as string);

  // Check if merchant is configured
  if (!merchantSettings || !merchantSettings.walletAddress) {
    // Return props for unconfigured state
    return {
      props: {
        shop: shop as string,
        productData: {
          title: '',
          price: '0',
          quantity: 0,
          total: '0'
        },
        orderId: '',
        paymentUrl: '',
        escrowDays: 14,
        isConfigured: false,
      },
    };
  }

  // Calculate order details
  let productData;
  if (type === 'cart' && cart) {
    const cartData = JSON.parse(cart as string);
    const total = (cartData.total_price / 100).toFixed(2);
    productData = {
      title: `Cart Items (${cartData.item_count})`,
      price: total,
      quantity: 1,
      total: total
    };
  } else {
    const itemPrice = parseFloat(price as string);
    const itemQuantity = parseInt(quantity as string);
    const total = (itemPrice * itemQuantity).toFixed(2);
    productData = {
      title: title as string,
      price: price as string,
      quantity: itemQuantity,
      total: total
    };
  }

  // Generate order ID
  const orderId = `SHOP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

  // Use merchant's configured settings
  const escrowDays = merchantSettings.payoutDelayDays;
  const epochExpiry = Math.floor(Date.now() / 1000) + (escrowDays * 24 * 60 * 60);
  const sellerWallet = merchantSettings.walletAddress;

  // Generate payment URL (using your existing contract-create page)
  const shopString = Array.isArray(shop) ? shop[0] : shop;
  const description = `${shopString} - Order ${orderId}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const paymentUrl = `${baseUrl}/contract-create?` +
    `seller=${encodeURIComponent(sellerWallet)}&` +
    `amount=${productData.total}&` +
    `description=${encodeURIComponent(description)}&` +
    `order_id=${encodeURIComponent(orderId)}&` +
    `epoch_expiry=${epochExpiry}&` +
    `shop=${encodeURIComponent(shopString)}&` +
    `product_id=${product_id || ''}&` +
    `variant_id=${variant_id || ''}&` +
    `title=${encodeURIComponent(title as string || productData.title)}&` +
    `quantity=${quantity || '1'}&` +
    `return=${encodeURIComponent(`https://${shopString}`)}`;

  return {
    props: {
      shop: shop as string,
      productData,
      orderId,
      paymentUrl,
      escrowDays,
      isConfigured: true,
    },
  };
};