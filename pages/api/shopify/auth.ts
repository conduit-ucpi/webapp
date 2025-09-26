import { NextApiRequest, NextApiResponse } from 'next';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_CLIENT_ID!,
  apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES || 'write_orders,write_draft_orders').split(','),
  hostName: process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  apiVersion: ApiVersion.October23,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { shop } = req.query;

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  // Ensure shop has proper format
  const shopDomain = shop.includes('.') ? shop : `${shop}.myshopify.com`;

  try {
    // Generate auth URL
    const authUrl = await shopify.auth.begin({
      shop: shopDomain,
      callbackPath: '/api/shopify/callback',
      isOnline: false, // Offline access for persistent token
    });

    // Redirect to Shopify OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('Shopify auth error:', error);
    res.status(500).json({ error: 'Failed to start OAuth flow' });
  }
}