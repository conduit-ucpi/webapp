/**
 * The MoonPay signing endpoint.
 *
 * This endpoint holds the secret key, so the property that matters is not
 * "does it produce a URL" but "whose address does it sign". A signing endpoint
 * that signs a caller-supplied wallet address issues our valid signatures for
 * anybody's payout — the secret never leaks, and it does not need to. Most of
 * what is below exists to pin that.
 */

import crypto from 'crypto';
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/moonpay/sign';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const ESCROW = '0x1111111111111111111111111111111111111111';
const ATTACKER = '0x2222222222222222222222222222222222222222';

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

const post = (body: unknown, headers: Record<string, string> = { cookie: 'AUTH-TOKEN=test-token' }) =>
  createMocks({ method: 'POST', headers, body });

const paramsOf = (url: string) => new URL(url).searchParams;

describe('/api/moonpay/sign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTRACT_SERVICE_URL = 'http://localhost:8976';
    process.env.MOONPAY_API_KEY = 'pk_test_key';
    process.env.MOONPAY_SECRET_KEY = 'sk_test_secret';
    delete process.env.MOONPAY_ENVIRONMENT;
    delete process.env.MOONPAY_CURRENCY_CODE;
  });

  describe('what it signs', () => {
    it('takes the destination from the contract, never from the body', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse());

      // The attack: name someone else's address and hope it is signed.
      const { req, res } = post({
        contractId: 'contract-123',
        walletAddress: ATTACKER,
        quoteCurrencyAmount: '9999',
      });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(200);
      const params = paramsOf(JSON.parse(res._getData()).url);
      expect(params.get('walletAddress')).toBe(ESCROW);
      expect(params.get('quoteCurrencyAmount')).toBe('1.5');
    });

    it('sends the crypto amount, not a fiat amount', async () => {
      // EscrowContract.deposit reverts unless exactly AMOUNT arrives, so the
      // crypto side has to be the fixed one. A baseCurrencyAmount here would
      // mean fees come out of the delivered USDC and the escrow underfunds.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      const params = paramsOf(JSON.parse(res._getData()).url);
      expect(params.get('quoteCurrencyAmount')).toBe('1.5');
      expect(params.has('baseCurrencyAmount')).toBe(false);
    });

    it('leaves the fiat currency for MoonPay to geo-detect', async () => {
      // Guessing from a browser locale is worse than their detection, and wrong
      // exactly where it matters — a Venezuelan payer on an en-US profile.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(paramsOf(JSON.parse(res._getData()).url).has('baseCurrencyCode')).toBe(false);
    });

    it('names USDC on Base, not bare usdc', async () => {
      // A bare code can deliver on the wrong chain, and those funds are gone.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(paramsOf(JSON.parse(res._getData()).url).get('currencyCode')).toBe('usdc_base');
    });

    it('rounds the amount up, never down', async () => {
      // 1.234567 USDC must not be sent as 1.23 — short of AMOUNT is a revert.
      mockFetch.mockResolvedValueOnce(contractResponse({ amount: 1_234_567 }));

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(paramsOf(JSON.parse(res._getData()).url).get('quoteCurrencyAmount')).toBe('1.24');
    });
  });

  describe('the signature itself', () => {
    it('is an HMAC of the query string with the secret key', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      const { url } = JSON.parse(res._getData());
      const signature = new URL(url).searchParams.get('signature');
      // Everything before &signature=, which is what was signed.
      const signed = url.slice(url.indexOf('?'), url.indexOf('&signature='));

      const expected = crypto
        .createHmac('sha256', 'sk_test_secret')
        .update(signed)
        .digest('base64');

      expect(signature).toBe(expected);
    });

    it('does not verify against a different address', async () => {
      // The point of signing: swapping the destination invalidates it.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      const { url } = JSON.parse(res._getData());
      const signature = new URL(url).searchParams.get('signature');
      const tampered = url
        .slice(url.indexOf('?'), url.indexOf('&signature='))
        .replace(ESCROW, ATTACKER);

      const recomputed = crypto
        .createHmac('sha256', 'sk_test_secret')
        .update(tampered)
        .digest('base64');

      expect(recomputed).not.toBe(signature);
    });

    it('never returns the secret key', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getData()).not.toContain('sk_test_secret');
    });
  });

  describe('access', () => {
    it('requires authentication', async () => {
      const { req, res } = post({ contractId: 'contract-123' }, {});
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(401);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('passes the caller\'s own token upstream', async () => {
      // So contractservice applies its normal rules: someone who cannot read
      // this contract cannot get a signed URL for its escrow either.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      const [, init] = mockFetch.mock.calls[0];
      expect((init as any).headers.Authorization).toBe('Bearer test-token');
    });

    it('surfaces a contract the caller cannot see as 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as Response);

      const { req, res } = post({ contractId: 'nope' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(404);
    });
  });

  describe('the feature flag', () => {
    it('refuses when MOONPAY_API_KEY is unset, like the button being hidden', async () => {
      delete process.env.MOONPAY_API_KEY;

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(503);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('refuses in production when the signing key is missing', async () => {
      // Degrading silently in production would take real money from a buyer,
      // deliver it to their own wallet, and leave the escrow unfunded — the
      // payment looks successful and the seller is never paid.
      delete process.env.MOONPAY_SECRET_KEY;
      process.env.MOONPAY_ENVIRONMENT = 'production';

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(500);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('preview mode, for seeing the widget before the secret exists', () => {
    beforeEach(() => {
      delete process.env.MOONPAY_SECRET_KEY;
    });

    it('opens unsigned, which means dropping the destination', async () => {
      // MoonPay reject an unsigned URL carrying walletAddress outright, so the
      // address has to go for the widget to load at all. Both must be absent
      // together — an unsigned URL that still named the escrow would just 400.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      const params = paramsOf(data.url);
      expect(params.has('walletAddress')).toBe(false);
      expect(params.has('signature')).toBe(false);
      expect(data.preview).toBe(true);
    });

    it('says plainly that it is not a payment route', async () => {
      // The caller cannot tell from the URL, and the two flows look identical
      // to the buyer right up until the money lands somewhere else.
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      const data = JSON.parse(res._getData());
      expect(data.preview).toBe(true);
      expect(data.escrowAddress).toBeNull();
    });

    it('is never what the real flow looks like', async () => {
      // Guards the inverse: with a secret present, preview must be false and
      // the destination must be back.
      process.env.MOONPAY_SECRET_KEY = 'sk_test_secret';
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      const data = JSON.parse(res._getData());
      expect(data.preview).toBe(false);
      expect(paramsOf(data.url).get('walletAddress')).toBe(ESCROW);
    });
  });

  describe('escrow readiness', () => {
    // The bug this pins: the endpoint originally read `contractAddress`, which
    // is chainservice's spelling. contractservice's PendingContract holds
    // `chainAddress`, so every real request 409'd while the tests passed —
    // because the fixture had the same wrong field as the code. A fixture that
    // mirrors the implementation's mistake proves nothing, so these assert the
    // two shapes explicitly.
    it('reads chainAddress, which is what contractservice actually returns', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse());

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(200);
      expect(paramsOf(JSON.parse(res._getData()).url).get('walletAddress')).toBe(ESCROW);
    });

    it('also accepts a chainservice-shaped contractAddress', async () => {
      mockFetch.mockResolvedValueOnce(
        contractResponse({ chainAddress: undefined, contractAddress: ESCROW })
      );

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(200);
      expect(paramsOf(JSON.parse(res._getData()).url).get('walletAddress')).toBe(ESCROW);
    });

    it('refuses to sign for an escrow that is not deployed', async () => {
      // Signing a URL pointing at nothing would send a payer's money nowhere.
      mockFetch.mockResolvedValueOnce(contractResponse({ chainAddress: undefined }));

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(409);
    });

    it('refuses a contract with no payable amount', async () => {
      mockFetch.mockResolvedValueOnce(contractResponse({ amount: 0 }));

      const { req, res } = post({ contractId: 'contract-123' });
      await handler(req as any, res);

      expect(res._getStatusCode()).toBe(422);
    });
  });

  it('rejects anything but POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it('requires a contract id', async () => {
    const { req, res } = post({});
    await handler(req as any, res);

    expect(res._getStatusCode()).toBe(400);
  });
});
