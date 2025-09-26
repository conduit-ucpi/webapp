import { NextApiRequest, NextApiResponse } from 'next';
import { getMerchantSettings, saveMerchantSettings, MerchantSettings } from '../../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { shop } = req.query;

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  if (req.method === 'GET') {
    // Get merchant settings
    try {
      const settings = await getMerchantSettings(shop);

      if (!settings) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      // Don't return the access token to the client
      const { accessToken, ...publicSettings } = settings;

      res.status(200).json(publicSettings);
    } catch (error) {
      console.error('Failed to get settings:', error);
      res.status(500).json({ error: 'Failed to retrieve settings' });
    }
  } else if (req.method === 'POST' || req.method === 'PUT') {
    // Update merchant settings
    try {
      const { walletAddress, payoutDelayDays } = req.body;

      // Validate inputs
      if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      if (!payoutDelayDays || payoutDelayDays < 1 || payoutDelayDays > 30) {
        return res.status(400).json({ error: 'Payout delay must be between 1 and 30 days' });
      }

      // Get existing settings
      const existingSettings = await getMerchantSettings(shop);

      if (!existingSettings) {
        return res.status(404).json({ error: 'Shop not found. Please complete OAuth setup first.' });
      }

      // Update settings
      const updatedSettings: MerchantSettings = {
        ...existingSettings,
        walletAddress,
        payoutDelayDays,
        updatedAt: new Date(),
      };

      await saveMerchantSettings(updatedSettings);

      // Return success without sensitive data
      const { accessToken, ...publicSettings } = updatedSettings;
      res.status(200).json(publicSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}