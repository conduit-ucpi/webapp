import { NextApiRequest, NextApiResponse } from 'next';
import { getMerchantSettings, saveMerchantSettings, MerchantSettings } from '@/lib/mongodb';
import { shopifyUser } from '@/lib/server/shopifyOwner';

/**
 * A shop's payout settings: the wallet its sales are paid to, and how long they are held.
 *
 * ⚠️ SIGNED IN, CHECKED WITH USERSERVICE, AND ONLY THE SHOP'S OWNER.
 *    Until 2026-11-20 this had no check at all: anyone who could name an installed shop could
 *    POST a new walletAddress and have that merchant's sales paid to themselves. Somebody
 *    tried, and was stopped only by there being no shop on record that day.
 *
 *    - Who is asking is userservice's answer (fetchIdentity), never anything the browser says.
 *      A token being present is not enough: it is whatever the caller sent.
 *    - A shop belongs to one Stabledrop user (MerchantSettings.ownerUserId), fixed when they
 *      connect it, which can only be done signed in (pages/api/shopify/callback.ts). Nobody
 *      else may read or change its settings: 403.
 *    - A record with NO owner (one from before this rule) is nobody's, and is not claimed
 *      here: whoever really runs the shop reconnects it, and Shopify vouches for them.
 *    - The owner is never taken from the request and never returned in the response.
 */
const publicView = ({ accessToken, ownerUserId, ...rest }: MerchantSettings) => rest;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { shop } = req.query;

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const identity = await shopifyUser(req);
  if (!identity) {
    return res.status(401).json({ error: 'Sign in to manage this shop' });
  }

  let settings: MerchantSettings | null;
  try {
    settings = await getMerchantSettings(shop);
  } catch (error) {
    console.error('Failed to get settings:', error);
    return res.status(500).json({ error: 'Failed to retrieve settings' });
  }

  if (!settings) {
    return res.status(404).json({ error: 'Shop not found. Please complete OAuth setup first.' });
  }

  if (!settings.ownerUserId) {
    return res.status(403).json({ error: 'Reconnect this shop from the install page while signed in to manage it' });
  }

  if (settings.ownerUserId !== identity.userId) {
    console.warn(`Shopify settings refused: user ${identity.userId} is not the owner of ${shop}`);
    return res.status(403).json({ error: 'This shop is managed from a different Stabledrop account' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(publicView(settings));
  }

  const { walletAddress, payoutDelayDays } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  if (typeof payoutDelayDays !== 'number' || !Number.isInteger(payoutDelayDays) || payoutDelayDays < 1 || payoutDelayDays > 30) {
    return res.status(400).json({ error: 'Payout delay must be between 1 and 30 days' });
  }

  const updatedSettings: MerchantSettings = {
    ...settings,
    walletAddress,
    payoutDelayDays,
    updatedAt: new Date(),
  };

  try {
    await saveMerchantSettings(updatedSettings);
  } catch (error) {
    console.error('Failed to save settings:', error);
    return res.status(500).json({ error: 'Failed to save settings' });
  }

  return res.status(200).json(publicView(updatedSettings));
}
