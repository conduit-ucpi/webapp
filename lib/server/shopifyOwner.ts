import type { NextApiRequest } from 'next';
import { fetchIdentity, UserIdentity } from '@/lib/server/coinbaseCdp';
import { extractAuthToken } from '@/utils/api-auth';

/**
 * Who is connecting or managing a Shopify shop, as userservice sees them.
 *
 * ⚠️ A SHOP IS ONLY EVER CONNECTED BY SOMEBODY SIGNED IN. Its payout settings belong to one
 *    Stabledrop account (MerchantSettings.ownerUserId), and that account is fixed at the moment
 *    Shopify vouches for the person in the browser (pages/api/shopify/callback.ts). There is no
 *    later "claim": a record with no owner is one nobody may open, because the alternative was
 *    that the first signed-in stranger to name the shop became its owner and set its payout
 *    wallet.
 *
 * Null for no session, a token userservice does not recognise, or an identity with no id. A
 * token being present is not enough: it is whatever the caller sent.
 */
export async function shopifyUser(req: NextApiRequest): Promise<(UserIdentity & { userId: string }) | null> {
  const authToken = extractAuthToken(req);
  const identity = authToken ? await fetchIdentity(req, authToken) : null;
  return identity?.userId ? { ...identity, userId: identity.userId } : null;
}

/** Where a browser is sent to sign in before connecting `shop`: the form, with the shop kept. */
export const signInToConnect = (shop: string) =>
  `/shopify/install-button?signin=required&connect=${encodeURIComponent(shop)}`;
