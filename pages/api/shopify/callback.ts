import { NextApiRequest, NextApiResponse } from 'next';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import { saveMerchantSettings } from '../../../lib/mongodb';
import '@shopify/shopify-api/adapters/node';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_CLIENT_ID!,
  apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES || 'write_orders,write_draft_orders').split(','),
  hostName: process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  apiVersion: ApiVersion.October23,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Complete OAuth callback
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;

    if (!session?.shop || !session?.accessToken) {
      throw new Error('Invalid session data from Shopify');
    }

    // Save initial merchant settings
    await saveMerchantSettings({
      shop: session.shop,
      walletAddress: '', // Will be set by merchant
      payoutDelayDays: 14, // Default 14 days
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      accessToken: session.accessToken,
    });

    // Redirect to settings page
    const settingsUrl = `/shopify/merchant-settings?shop=${encodeURIComponent(session.shop)}&success=true`;
    res.redirect(settingsUrl);
  } catch (error) {
    console.error('Shopify callback error:', error);
    res.status(500).json({ error: 'Failed to complete OAuth flow' });
  }
}