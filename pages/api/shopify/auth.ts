import { NextApiRequest, NextApiResponse } from 'next';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_CLIENT_ID!,
  apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES || 'write_orders,write_draft_orders').split(','),
  hostName: process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  apiVersion: ApiVersion.October22,
  isEmbeddedApp: false,
  isCustomStoreApp: false,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { shop } = req.query;

  console.log('Shopify auth called with shop:', shop);
  console.log('Environment check:', {
    hasClientId: !!process.env.SHOPIFY_CLIENT_ID,
    hasClientSecret: !!process.env.SHOPIFY_CLIENT_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  // Ensure shop has proper format
  const shopDomain = shop.includes('.') ? shop : `${shop}.myshopify.com`;
  console.log('Processing shop domain:', shopDomain);

  try {
    // Generate auth URL using the new API
    console.log('Calling shopify.auth.begin...');
    const authUrl = await shopify.auth.begin({
      shop: shopDomain,
      callbackPath: '/api/shopify/callback',
      isOnline: false, // Offline access for persistent token
      rawRequest: req,
      rawResponse: res,
    });

    console.log('Auth URL generated, redirect should happen automatically');
    // The begin method handles the redirect internally
  } catch (error) {
    console.error('Shopify auth error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    res.status(500).json({
      error: 'Failed to start OAuth flow',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}