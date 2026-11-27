import { NextApiRequest, NextApiResponse } from 'next';
import { verifyShopifyWebhook } from '@/lib/server/shopifyWebhook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyShopifyWebhook(req)) {
    console.warn('Invalid HMAC on customers/redact webhook');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { shop_domain, customer } = req.body;

  console.log('Shopify customers/redact webhook received:', {
    shop: shop_domain,
    customerEmail: customer?.email,
    customerId: customer?.id,
  });

  // InstantEscrow does not store customer PII.
  // Blockchain transactions are immutable and cannot be redacted,
  // but no personal data is linked to on-chain records.
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
