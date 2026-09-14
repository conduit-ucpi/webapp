/**
 * The MoonPay signing endpoint.
 *
 * This endpoint holds the secret key, so the property that matters is not
 * "does it produce a signature" but "what will it sign". It has two phases:
 * phase 1 hands the client the parameters, phase 2 signs the URL the SDK built
 * from them.
 *
 * Phase 2 is the dangerous one, because it accepts a URL from the browser. An
 * endpoint that signs whatever it is handed issues our valid signatures for
 * anybody's payout — the secret never leaks and does not need to. Most of what
 * is below exists to pin that it verifies first.
 */

import crypto from 'crypto';
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/moonpay/sign';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const ESCROW = '0x1111111111111111111111111111111111111111';
const ATTACKER = '0x2222222222222222222222222222222222222222';
const HOST = 'https://buy-sandbox.moonpay.com';

const contractResponse = (overrides: Record<string, unknown> = {}) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'contract-123',
      chainAddress: ESCROW,
      amount: 1_500_000, // microUSDC -> 1.50
      currency: 'microUSDC',
      ...overrides,
    }),
  }) as Response;

const call = async (body: unknown, headers: Record<string, string> = { cookie: 'AUTH-TOKEN=test-token' }) => {
  const { req, res } = createMocks({ method: 'POST', headers, body });
  await handler(req as any, res);
  return {
    status: res._getStatusCode(),
    body: JSON.parse(res._getData() || '{}'),
    raw: res._getData(),
  };
};

/** A URL of the shape the SDK would produce for this contract. */
const sdkUrl = (overrides: Record<string, string | null> = {}) => {
  const merged: Record<string, string | null> = {
    apiKey: 'pk_test_key',
    currencyCode: 'usdc_base',
    quoteCurrencyAmount: '1.5',
    externalTransactionId: 'contract-123',
    walletAddress: ESCROW,
    ...overrides,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v !== null) p.set(k, v);
  return `${HOST}?${p.toString()}`;
};

describe('/api/moonpay/sign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTRACT_SERVICE_URL = 'http://localhost:8976';
    process.env.MOONPAY_API_KEY = 'pk_test_key';
    process.env.MOONPAY_API_SECRET_KEY = 'sk_test_secret';
    delete process.env.MOONPAY_ENVIRONMENT;
    delete process.env.MOONPAY_CURRENCY_CODE;
  });

  describe('phase 1: the parameters', () => {
    it('derives the destination and amount from the contract', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { status, body } = await call({ contractId: 'contract-123' });

      expect(status).toBe(200);
      expect(body.params.walletAddress).toBe(ESCROW);
      expect(body.params.quoteCurrencyAmount).toBe('1.5');
    });

    it('ignores a destination named in the request body', async () => {
      // The attack: ask for parameters while naming someone else's address.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { body } = await call({
        contractId: 'contract-123',
        walletAddress: ATTACKER,
        quoteCurrencyAmount: '9999',
      });

      expect(body.params.walletAddress).toBe(ESCROW);
      expect(body.params.quoteCurrencyAmount).toBe('1.5');
    });

    it('sends the crypto amount, never a fiat one', async () => {
      // EscrowContract.deposit reverts unless exactly AMOUNT arrives, so the
      // crypto side has to be fixed. A baseCurrencyAmount would mean fees come
      // out of the delivered USDC and the escrow underfunds.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { body } = await call({ contractId: 'contract-123' });

      expect(body.params).not.toHaveProperty('baseCurrencyAmount');
      expect(body.params).not.toHaveProperty('baseCurrencyCode');
    });

    it('names USDC on Base, not bare usdc', async () => {
      // A bare code delivers on Ethereum, and those funds are gone.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { body } = await call({ contractId: 'contract-123' });

      expect(body.params.currencyCode).toBe('usdc_base');
    });

    it('rounds the amount up, never down', async () => {
      // 1.234567 USDC must not be sent as 1.23 — short of AMOUNT is a revert.
      mockFetch.mockResolvedValueOnce(contractResponse({ amount: 1_234_567 }));

      const { body } = await call({ contractId: 'contract-123' });

      expect(body.params.quoteCurrencyAmount).toBe('1.24');
    });

    it('reads chainAddress, which is what contractservice actually returns', async () => {
      // The bug this pins: the endpoint once read `contractAddress`, which is
      // chainservice's spelling, so every real request 409'd while the tests
      // passed — the fixture had the same wrong field as the code.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { status } = await call({ contractId: 'contract-123' });

      expect(status).toBe(200);
    });

    it('also accepts a chainservice-shaped contractAddress', async () => {
      mockFetch.mockResolvedValueOnce(
        contractResponse({ chainAddress: undefined, contractAddress: ESCROW })
      );

      const { status, body } = await call({ contractId: 'contract-123' });

      expect(status).toBe(200);
      expect(body.params.walletAddress).toBe(ESCROW);
    });
  });

  describe("phase 2: signing the SDK's URL", () => {
    it('signs the query string exactly as given, including the leading ?', async () => {
      // The regression this exists for: the URL used to be built server-side
      // and then rebuilt by the SDK, so the signature covered a string that was
      // never transmitted and MoonPay answered 400 on
      // verify_widget_signature. Signing the SDK's own URL is the fix.
      mockFetch.mockResolvedValueOnce(contractResponse());
      const url = sdkUrl();

      const { status, body } = await call({ contractId: 'contract-123', url });

      expect(status).toBe(200);
      const expected = crypto
        .createHmac('sha256', 'sk_test_secret')
        .update(url.slice(url.indexOf('?')))
        .digest('base64');
      expect(body.signature).toBe(expected);
    });

    it('never returns the secret key', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { raw } = await call({ contractId: 'contract-123', url: sdkUrl() });

      expect(raw).not.toContain('sk_test_secret');
    });
  });

  describe('phase 2 refuses to be an oracle', () => {
    const refuses = async (url: string) => {
      mockFetch.mockResolvedValueOnce(contractResponse());
      const { status, body } = await call({ contractId: 'contract-123', url });
      expect(status).toBe(422);
      expect(body.signature).toBeUndefined();
      return body.error as string;
    };

    it('will not sign a URL pointing at another address', async () => {
      expect(await refuses(sdkUrl({ walletAddress: ATTACKER }))).toMatch(/not the escrow/);
    });

    it('will not sign a URL with no destination at all', async () => {
      expect(await refuses(sdkUrl({ walletAddress: null }))).toMatch(/not the escrow/);
    });

    it('will not sign a different amount', async () => {
      expect(await refuses(sdkUrl({ quoteCurrencyAmount: '9999' }))).toMatch(/does not match/);
    });

    it('will not sign a different currency, which could mean a different chain', async () => {
      expect(await refuses(sdkUrl({ currencyCode: 'usdc' }))).toMatch(/currencyCode/);
    });

    it("will not sign for somebody else's MoonPay account", async () => {
      expect(await refuses(sdkUrl({ apiKey: 'pk_test_someone_else' }))).toMatch(/apiKey/);
    });

    it('rejects walletAddresses, which outranks walletAddress', async () => {
      // MoonPay document that the plural form takes precedence. A URL carrying
      // the verified escrow AND a plural override would pass a naive check and
      // still pay someone else.
      const url = `${sdkUrl()}&walletAddresses=${encodeURIComponent(`{"eth":"${ATTACKER}"}`)}`;
      expect(await refuses(url)).toMatch(/walletAddresses/);
    });

    it('rejects a URL that already carries a signature', async () => {
      expect(await refuses(`${sdkUrl()}&signature=abc`)).toMatch(/signature/);
    });

    it('rejects a fiat amount being driven alongside the crypto one', async () => {
      expect(await refuses(`${sdkUrl()}&baseCurrencyAmount=100`)).toMatch(/baseCurrencyAmount/);
    });

    it('will not sign for a host that is not MoonPay', async () => {
      const url = sdkUrl().replace('buy-sandbox.moonpay.com', 'evil.example.com');
      expect(await refuses(url)).toMatch(/unexpected host/);
    });

    it('will not sign a non-https URL', async () => {
      expect(await refuses(sdkUrl().replace('https:', 'http:'))).toMatch(
        /not https|unexpected host/
      );
    });

    it('rejects a url that is not a URL', async () => {
      expect(await refuses('not a url at all')).toMatch(/not a valid URL/);
    });
  });

  describe('access', () => {
    it('requires authentication', async () => {
      const { status } = await call({ contractId: 'contract-123' }, {});

      expect(status).toBe(401);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("passes the caller's own token upstream", async () => {
      // So contractservice applies its normal rules: someone who cannot read
      // this contract cannot get a signed URL for its escrow either.
      mockFetch.mockResolvedValueOnce(contractResponse());

      await call({ contractId: 'contract-123' });

      const [, init] = mockFetch.mock.calls[0];
      expect((init as any).headers.Authorization).toBe('Bearer test-token');
    });

    it('surfaces a contract the caller cannot see as 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as Response);

      const { status } = await call({ contractId: 'nope' });

      expect(status).toBe(404);
    });
  });

  describe('the feature flag', () => {
    it('refuses when MOONPAY_API_KEY is unset, like the button being hidden', async () => {
      delete process.env.MOONPAY_API_KEY;

      const { status } = await call({ contractId: 'contract-123' });

      expect(status).toBe(503);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('refuses in production when the signing key is missing', async () => {
      // Degrading silently in production would take real money from a buyer,
      // deliver it to their own wallet, and leave the seller unpaid — with
      // every screen reporting success.
      delete process.env.MOONPAY_API_SECRET_KEY;
      process.env.MOONPAY_ENVIRONMENT = 'production';

      const { status } = await call({ contractId: 'contract-123' });

      expect(status).toBe(500);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('preview mode, for seeing the widget before the secret exists', () => {
    beforeEach(() => {
      delete process.env.MOONPAY_API_SECRET_KEY;
    });

    it('drops the destination, which is what lets it open unsigned', async () => {
      // MoonPay reject an unsigned URL carrying walletAddress outright, so the
      // address has to go for the widget to load at all.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { status, body } = await call({ contractId: 'contract-123' });

      expect(status).toBe(200);
      expect(body.params).not.toHaveProperty('walletAddress');
      expect(body.preview).toBe(true);
      expect(body.escrowAddress).toBeNull();
    });

    it('refuses to sign anything, since there is no destination to vouch for', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { status } = await call({ contractId: 'contract-123', url: sdkUrl() });

      expect(status).toBe(409);
    });

    it('is never what the real flow looks like', async () => {
      process.env.MOONPAY_API_SECRET_KEY = 'sk_test_secret';
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { body } = await call({ contractId: 'contract-123' });

      expect(body.preview).toBe(false);
      expect(body.params.walletAddress).toBe(ESCROW);
    });
  });

  describe('escrow readiness', () => {
    it('refuses when the escrow is not deployed', async () => {
      // Signing a URL pointing at nothing would send a payer's money nowhere.
      mockFetch.mockResolvedValueOnce(contractResponse({ chainAddress: undefined }));

      const { status } = await call({ contractId: 'contract-123' });

      expect(status).toBe(409);
    });

    it('refuses a contract with no payable amount', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse({ amount: 0 }));

      const { status } = await call({ contractId: 'contract-123' });

      expect(status).toBe(422);
    });
  });

  it('rejects anything but POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it('requires a contract id', async () => {
    const { status } = await call({});

    expect(status).toBe(400);
  });
});
