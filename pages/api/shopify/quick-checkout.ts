import type { NextApiRequest, NextApiResponse } from 'next';
import { getMerchantSettings } from '../../../lib/mongodb';

/**
 * Shopify quick-checkout entry point.
 *
 * Was pages/shopify/quick-checkout.tsx, where all of this lived in
 * getServerSideProps. It reads MongoDB and answers with a redirect, so it cannot
 * be part of the static export — and it was never really a page: the configured
 * path rendered nothing, it redirected straight to /contract-create. Moved here so
 * it stays on the box with the rest of the Node API
 * (STATIC_FRONTEND_MIGRATION_PLAN.md, Phase 4 step 16).
 *
 * The unconfigured case now redirects to /shopify/setup-required, which is a
 * static page in the exported bundle.
 *
 * NOTE: the old page also carried an "Order Summary / Connect Your Account"
 * interstitial for the configured case. It was unreachable — getServerSideProps
 * always redirected before it could render — so it is not carried over. Recover it
 * from git history if it is ever wanted.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    shop,
    product_id,
    variant_id,
    title = 'Product',
    price = '0',
    quantity = '1',
    cart,
    type = 'product'
  } = req.query;

  if (!shop) {
    return res.status(404).json({ error: 'Not found' });
  }

  const shopString = Array.isArray(shop) ? shop[0] : shop;

  // Fetch merchant settings
  const merchantSettings = await getMerchantSettings(shopString);

  // Check if merchant is configured
  if (!merchantSettings || !merchantSettings.walletAddress) {
    return res.redirect(
      302,
      `/shopify/setup-required?shop=${encodeURIComponent(shopString)}`
    );
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
    `title=${encodeURIComponent((title as string) || productData.title)}&` +
    `quantity=${quantity || '1'}&` +
    `return=${encodeURIComponent(`https://${shopString}`)}`;

  // Redirect directly to the payment page — skip the interstitial
  return res.redirect(302, paymentUrl);
}
