import { NextApiRequest, NextApiResponse } from 'next';
import { verifyShopifyWebhook } from '@/lib/server/shopifyWebhook';
import { deleteMerchantSettings } from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyShopifyWebhook(req)) {
    console.warn('Invalid HMAC on shop/redact webhook');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { shop_domain } = req.body;

  console.log('Shopify shop/redact webhook received:', {
    shop: shop_domain,
  });

  // Remove merchant settings when shop data redaction is requested
  try {
    await deleteMerchantSettings(shop_domain);
    console.log('Merchant settings deleted for shop:', shop_domain);
  } catch (error) {
    console.error('Error deleting merchant settings:', error);
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
