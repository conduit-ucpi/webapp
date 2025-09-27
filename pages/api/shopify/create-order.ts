import { NextApiRequest, NextApiResponse } from 'next';
import { getMerchantSettings } from '../../../lib/mongodb';

interface CreateOrderRequest {
  shop: string;
  orderId: string;
  contractId: string;
  productId?: string;
  variantId?: string;
  title: string;
  price: string;
  quantity: number;
  buyerEmail?: string;
  transactionHash?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      shop,
      orderId,
      contractId,
      productId,
      variantId,
      title,
      price,
      quantity,
      buyerEmail,
      transactionHash
    } = req.body as CreateOrderRequest;

    // Get merchant settings including access token
    const merchantSettings = await getMerchantSettings(shop);

    if (!merchantSettings || !merchantSettings.accessToken) {
      console.error('Merchant not found or not configured:', shop);
      return res.status(400).json({ error: 'Merchant not configured' });
    }

    // Create order in Shopify
    const shopifyOrderData = {
      order: {
        line_items: [
          {
            variant_id: variantId,
            quantity: quantity || 1,
            price: price,
            title: title,
            properties: [
              { name: 'Payment Method', value: 'USDC via InstantEscrow' },
              { name: 'Contract ID', value: contractId },
              { name: 'Transaction Hash', value: transactionHash || '' }
            ]
          }
        ],
        customer: buyerEmail ? {
          email: buyerEmail
        } : undefined,
        financial_status: 'paid',
        transactions: [
          {
            kind: 'sale',
            status: 'success',
            amount: price,
            gateway: 'InstantEscrow USDC'
          }
        ],
        note: `Paid with USDC via InstantEscrow. Contract ID: ${contractId}`,
        tags: 'instant-escrow, usdc-payment',
        source_name: 'instant_escrow'
      }
    };

    console.log('Creating Shopify order for shop:', shop);
    console.log('Order data:', JSON.stringify(shopifyOrderData, null, 2));

    // Make API call to Shopify
    const shopifyResponse = await fetch(
      `https://${shop}/admin/api/2023-10/orders.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': merchantSettings.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(shopifyOrderData)
      }
    );

    if (!shopifyResponse.ok) {
      const errorData = await shopifyResponse.json().catch(() => ({}));
      console.error('Shopify order creation failed:', errorData);

      // Still return success since payment was processed
      // Just log the error for debugging
      return res.status(200).json({
        success: true,
        paymentProcessed: true,
        shopifyOrderCreated: false,
        error: errorData.errors || 'Failed to create Shopify order'
      });
    }

    const shopifyOrder = await shopifyResponse.json();
    console.log('Shopify order created successfully:', shopifyOrder.order.id);

    return res.status(200).json({
      success: true,
      paymentProcessed: true,
      shopifyOrderCreated: true,
      shopifyOrderId: shopifyOrder.order.id,
      shopifyOrderNumber: shopifyOrder.order.order_number
    });

  } catch (error) {
    console.error('Error creating Shopify order:', error);

    // Still return success if payment was processed
    return res.status(200).json({
      success: true,
      paymentProcessed: true,
      shopifyOrderCreated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}