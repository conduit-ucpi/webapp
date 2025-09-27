import { NextApiRequest, NextApiResponse } from 'next';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import { saveMerchantSettings } from '../../../lib/mongodb';
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
  console.log('Shopify callback called with query:', req.query);
  console.log('Environment variables check:', {
    hasClientId: !!process.env.SHOPIFY_CLIENT_ID,
    hasClientSecret: !!process.env.SHOPIFY_CLIENT_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  try {
    // Complete OAuth callback
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log('Callback response received:', callbackResponse);

    const { session } = callbackResponse;

    if (!session?.shop || !session?.accessToken) {
      console.error('Invalid session data:', { session });
      throw new Error('Invalid session data from Shopify');
    }

    console.log('Valid session received for shop:', session.shop);

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

    console.log('Merchant settings saved for shop:', session.shop);

    // Redirect to settings page
    const settingsUrl = `/shopify/merchant-settings?shop=${encodeURIComponent(session.shop)}&success=true`;
    console.log('Redirecting to:', settingsUrl);
    res.redirect(settingsUrl);
  } catch (error) {
    console.error('Shopify callback error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    res.status(500).json({
      error: 'Failed to complete OAuth flow',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}