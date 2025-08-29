import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Notification endpoint for Farcaster deposit transactions
 * This replaces the full deposit-funds endpoint when using eth_sendTransaction
 * Only handles notification/email sending, not the actual transaction
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      contractAddress,
      userWalletAddress,
      transactionHash,
      contractId,
      buyerEmail,
      sellerEmail,
      contractDescription,
      amount,
      currency,
      payoutDateTime,
      contractLink
    } = req.body;

    console.log('🔧 Deposit notification received:', {
      contractAddress,
      userWalletAddress,
      transactionHash,
      contractId
    });

    // TODO: Add notification logic here
    // - Send email to seller about funded contract
    // - Update contract status in database
    // - Send webhook notifications
    
    // For now, just return success
    res.status(200).json({
      success: true,
      message: 'Deposit notification processed',
      transactionHash
    });

  } catch (error) {
    console.error('Deposit notification failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Notification failed'
    });
  }
}