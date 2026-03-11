import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { deleteMerchantSettings } from '../../../../lib/mongodb';

function verifyShopifyWebhook(req: NextApiRequest): boolean {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  if (!hmacHeader || !process.env.SHOPIFY_CLIENT_SECRET) return false;

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

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
