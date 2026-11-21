import { NextApiRequest, NextApiResponse } from 'next';
import { verifyShopifyWebhook } from '@/lib/server/shopifyWebhook';
import { deleteMerchantSettings } from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyShopifyWebhook(req)) {
    console.warn('Invalid HMAC on Shopify compliance webhook');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const topic = req.headers['x-shopify-topic'] as string;
  const { shop_domain, customer } = req.body;

  console.log(`Shopify compliance webhook received: ${topic}`, {
    shop: shop_domain,
    customerId: customer?.id,
  });

  switch (topic) {
    case 'customers/data_request':
      // InstantEscrow stores minimal customer data (wallet addresses only).
      // No PII is stored beyond what Shopify provides during OAuth.
      break;

    case 'customers/redact':
      // InstantEscrow does not store customer PII.
      // Blockchain transactions are immutable but contain no personal data.
      break;

    case 'shop/redact':
      // Remove merchant settings when shop data redaction is requested
      try {
        await deleteMerchantSettings(shop_domain);
        console.log('Merchant settings deleted for shop:', shop_domain);
      } catch (error) {
        console.error('Error deleting merchant settings:', error);
      }
      break;

    default:
      console.warn('Unknown compliance webhook topic:', topic);
  }

  return res.status(200).json({});
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
