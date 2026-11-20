/**
 * A shop is only ever connected by somebody signed in, and it is theirs from that moment. There
 * is no ownerless record to be claimed later: without a session nothing is saved, and the OAuth
 * round trip is not even started.
 */
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

const begin = jest.fn();
const callback = jest.fn();
jest.mock('@shopify/shopify-api', () => ({
  shopifyApi: () => ({ auth: { begin: (...args: unknown[]) => begin(...args), callback: (...args: unknown[]) => callback(...args) } }),
  ApiVersion: { October22: '2022-10' },
}));
jest.mock('@shopify/shopify-api/adapters/node', () => ({}));

const saveMerchantSettings = jest.fn();
jest.mock('@/lib/mongodb', () => ({ saveMerchantSettings: (...args: unknown[]) => saveMerchantSettings(...args) }));

const fetchIdentity = jest.fn();
jest.mock('@/lib/server/coinbaseCdp', () => ({ fetchIdentity: (...args: unknown[]) => fetchIdentity(...args) }));

import startConnecting from '@/pages/api/shopify/auth';
import finishConnecting from '@/pages/api/shopify/callback';

const SHOP = 'a-real-shop.myshopify.com';
const SIGN_IN = `/shopify/install-button?signin=required&connect=${encodeURIComponent(SHOP)}`;

async function run(handler: typeof startConnecting, signedIn: boolean) {
  const { req, res } = createMocks({ method: 'GET', query: { shop: SHOP }, headers: signedIn ? { cookie: 'AUTH-TOKEN=a-token' } : {} });
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return { status: res._getStatusCode(), location: (res as any)._getRedirectUrl() as string };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  begin.mockResolvedValue('https://shopify.example/oauth');
  callback.mockResolvedValue({ session: { shop: SHOP, accessToken: 'shpat_x' } });
  saveMerchantSettings.mockResolvedValue(undefined);
  fetchIdentity.mockResolvedValue({ userId: 'merchant-1' });
});
afterEach(() => jest.restoreAllMocks());

describe('starting to connect a shop', () => {
  it('signed out: sent to sign in with the shop kept, and Shopify is not asked anything', async () => {
    expect(await run(startConnecting, false)).toEqual({ status: 302, location: SIGN_IN });
    expect(begin).not.toHaveBeenCalled();
  });

  it('a token userservice does not recognise is signed out', async () => {
    fetchIdentity.mockResolvedValue(null);

    expect(await run(startConnecting, true)).toEqual({ status: 302, location: SIGN_IN });
    expect(begin).not.toHaveBeenCalled();
  });

  it('signed in: the OAuth trip begins', async () => {
    await run(startConnecting, true);
    expect(begin).toHaveBeenCalledWith(expect.objectContaining({ shop: SHOP, callbackPath: '/api/shopify/callback' }));
  });
});

describe('where the browser is sent', () => {
  const before = process.env.SERVICE_LINK;
  beforeEach(() => { process.env.SERVICE_LINK = 'https://site.example/'; });
  afterEach(() => {
    if (before === undefined) delete process.env.SERVICE_LINK;
    else process.env.SERVICE_LINK = before;
  });

  it('is the site the pages are on, not the API host these routes answer from', async () => {
    expect((await run(startConnecting, false)).location).toBe(`https://site.example${SIGN_IN}`);
    expect((await run(finishConnecting, true)).location).toBe(`https://site.example/shopify/merchant-settings?shop=${encodeURIComponent(SHOP)}&success=true`);
  });
});

describe('coming back from Shopify', () => {
  it('signed in: the shop is saved as that user\'s', async () => {
    const answer = await run(finishConnecting, true);

    expect(saveMerchantSettings).toHaveBeenCalledWith(expect.objectContaining({ shop: SHOP, ownerUserId: 'merchant-1', accessToken: 'shpat_x' }));
    expect(answer.location).toContain('/shopify/merchant-settings');
  });

  it('no session any more: nothing is saved, and they are sent to sign in and connect again', async () => {
    expect(await run(finishConnecting, false)).toEqual({ status: 302, location: SIGN_IN });
    expect(saveMerchantSettings).not.toHaveBeenCalled();
  });
});
