/**
 * TDD spec for buildWordPressStatusUrl — extracted verbatim from
 * contract-create.tsx, now a pure function parameterised by the embed context
 * (returnUrl, orderId, wordpressSource) instead of closing over them.
 *
 * Behavior being locked (exactly the prior inline logic):
 *  - NOT a WordPress integration (no returnUrl / no orderId / wordpressSource
 *    !== 'true') → return the returnUrl as-is, or '/dashboard' if it isn't a
 *    usable string.
 *  - WordPress integration → build `${origin}/usdc-payment-status/${orderId}/`
 *    carrying the original `key` (if present), `payment_status=<status>`, and
 *    any truthy additionalParams. Falsy additional params are skipped.
 *  - Malformed returnUrl → fall back to returnUrl-or-'/dashboard'.
 */

import { buildWordPressStatusUrl } from '@/utils/wordpressStatusUrl';

describe('buildWordPressStatusUrl', () => {
  describe('non-WordPress (passthrough/fallback)', () => {
    it('returns the returnUrl unchanged when wordpressSource is not "true"', () => {
      const url = buildWordPressStatusUrl('completed', {
        returnUrl: 'https://shop.example.com/thanks',
        orderId: '123',
        wordpressSource: undefined,
      });
      expect(url).toBe('https://shop.example.com/thanks');
    });

    it('returns "/dashboard" when there is no usable returnUrl', () => {
      const url = buildWordPressStatusUrl('completed', {
        returnUrl: undefined,
        orderId: '123',
        wordpressSource: 'true',
      });
      expect(url).toBe('/dashboard');
    });

    it('returns the returnUrl unchanged when orderId is missing (not full WP integration)', () => {
      const url = buildWordPressStatusUrl('cancelled', {
        returnUrl: 'https://shop.example.com/back',
        orderId: undefined,
        wordpressSource: 'true',
      });
      expect(url).toBe('https://shop.example.com/back');
    });
  });

  describe('WordPress integration', () => {
    const wpCtx = {
      returnUrl: 'https://shop.example.com/checkout?key=ORDERKEY123',
      orderId: '456',
      wordpressSource: 'true',
    };

    it('builds the /usdc-payment-status/<orderId>/ path on the returnUrl origin', () => {
      const result = new URL(buildWordPressStatusUrl('completed', wpCtx));
      expect(result.origin).toBe('https://shop.example.com');
      expect(result.pathname).toBe('/usdc-payment-status/456/');
    });

    it('carries the original order key and sets payment_status', () => {
      const result = new URL(buildWordPressStatusUrl('completed', wpCtx));
      expect(result.searchParams.get('key')).toBe('ORDERKEY123');
      expect(result.searchParams.get('payment_status')).toBe('completed');
    });

    it('adds truthy additional params and skips falsy ones', () => {
      const result = new URL(
        buildWordPressStatusUrl('completed', wpCtx, {
          contract_id: 'c1',
          contract_hash: '0xabc',
          tx_hash: '', // falsy → skipped
        })
      );
      expect(result.searchParams.get('contract_id')).toBe('c1');
      expect(result.searchParams.get('contract_hash')).toBe('0xabc');
      expect(result.searchParams.has('tx_hash')).toBe(false);
    });

    it('omits key when the returnUrl has none', () => {
      const result = new URL(
        buildWordPressStatusUrl('error', {
          returnUrl: 'https://shop.example.com/checkout',
          orderId: '789',
          wordpressSource: 'true',
        })
      );
      expect(result.searchParams.has('key')).toBe(false);
      expect(result.searchParams.get('payment_status')).toBe('error');
    });

    it('reflects the status argument (completed/cancelled/error)', () => {
      const cancelled = new URL(buildWordPressStatusUrl('cancelled', wpCtx));
      expect(cancelled.searchParams.get('payment_status')).toBe('cancelled');
    });
  });

  describe('malformed input', () => {
    it('falls back to the returnUrl when it cannot be parsed as a URL', () => {
      const url = buildWordPressStatusUrl('completed', {
        returnUrl: 'not a url',
        orderId: '999',
        wordpressSource: 'true',
      });
      expect(url).toBe('not a url');
    });
  });
});
