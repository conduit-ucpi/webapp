import { NextApiRequest, NextApiResponse } from 'next';
import { verifyShopifyWebhook } from '@/lib/server/shopifyWebhook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyShopifyWebhook(req)) {
    console.warn('Invalid HMAC on customers/data_request webhook');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { shop_domain, customer, orders_requested } = req.body;

  console.log('Shopify customers/data_request webhook received:', {
    shop: shop_domain,
    customerEmail: customer?.email,
    ordersRequested: orders_requested,
  });

  // InstantEscrow stores minimal customer data (wallet addresses only).
  // No PII is stored beyond what Shopify provides during the OAuth flow.
  // Respond with 200 to acknowledge receipt.

  return res.status(200).json({});
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
