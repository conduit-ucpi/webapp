import crypto from 'crypto';
import type { NextApiRequest } from 'next';

/**
 * Does this request carry Shopify's HMAC for its body, signed with our app secret?
 *
 * The comparison is constant-time, and a header of the wrong length is simply a wrong header:
 * crypto.timingSafeEqual throws on unequal lengths, which used to escape as a 500, so lengths
 * are checked first. The header is compared as text, not decoded: Node's base64 decoder stops
 * at the padding, so a decoded comparison would accept a right signature with junk after it.
 */
export function verifyShopifyWebhook(req: NextApiRequest): boolean {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (typeof hmacHeader !== 'string' || !hmacHeader || !secret) return false;

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64'));
  const given = Buffer.from(hmacHeader);

  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
