/**
 * @jest-environment node
 */
import crypto from 'crypto';
import { verifyShopifyWebhook } from '@/lib/server/shopifyWebhook';

const SECRET = 'test-secret';
const body = { shop_domain: 'shop.myshopify.com' };
const sign = (b: unknown) => crypto.createHmac('sha256', SECRET).update(JSON.stringify(b), 'utf8').digest('base64');
const req = (hmac?: string) => ({ body, headers: hmac === undefined ? {} : { 'x-shopify-hmac-sha256': hmac } }) as any;

describe('verifyShopifyWebhook', () => {
  const env = process.env.SHOPIFY_CLIENT_SECRET;
  beforeEach(() => { process.env.SHOPIFY_CLIENT_SECRET = SECRET; });
  afterAll(() => { process.env.SHOPIFY_CLIENT_SECRET = env; });

  it('accepts the right signature', () => {
    expect(verifyShopifyWebhook(req(sign(body)))).toBe(true);
  });

  it('refuses a wrong signature of the right length', () => {
    expect(verifyShopifyWebhook(req(sign({ other: 1 })))).toBe(false);
  });

  it.each(['x', 'abc', 'not base64 at all!!', sign(body) + 'AAAA', ''])(
    'refuses a malformed or wrong-length signature %p without throwing', (hmac) => {
      expect(() => verifyShopifyWebhook(req(hmac))).not.toThrow();
      expect(verifyShopifyWebhook(req(hmac))).toBe(false);
    });

  it('refuses when there is no header or no secret', () => {
    expect(verifyShopifyWebhook(req())).toBe(false);
    delete process.env.SHOPIFY_CLIENT_SECRET;
    expect(verifyShopifyWebhook(req(sign(body)))).toBe(false);
  });
});
