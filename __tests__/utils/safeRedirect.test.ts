/**
 * TDD spec for safeRedirectUrl — a guard for client-side redirect targets
 * (window.location.href / window.opener.location.href) that are derived from
 * user-controlled input (the `return` query param flowing through
 * buildWordPressStatusUrl). Closes the CodeQL js/xss findings in
 * contract-create.tsx by rejecting dangerous URL schemes.
 *
 * Rule: return the candidate ONLY if it is a safe navigation target —
 *   - an absolute http:// or https:// URL, or
 *   - a same-origin relative path (starts with "/")
 * Otherwise return the fallback. Dangerous schemes (javascript:, data:,
 * vbscript:, file:, etc.) and unparseable values fall back.
 */

import { safeRedirectUrl } from '@/utils/safeRedirect';

describe('safeRedirectUrl', () => {
  describe('allows safe targets', () => {
    it('allows an https URL', () => {
      expect(safeRedirectUrl('https://shop.example.com/usdc-payment-status/1/?key=x')).toBe(
        'https://shop.example.com/usdc-payment-status/1/?key=x'
      );
    });

    it('allows an http URL', () => {
      expect(safeRedirectUrl('http://localhost:3000/dashboard')).toBe('http://localhost:3000/dashboard');
    });

    it('allows a same-origin relative path', () => {
      expect(safeRedirectUrl('/dashboard')).toBe('/dashboard');
    });

    it('allows a relative path with query/params', () => {
      expect(safeRedirectUrl('/usdc-payment-status/42/?payment_status=completed')).toBe(
        '/usdc-payment-status/42/?payment_status=completed'
      );
    });
  });

  describe('rejects dangerous schemes (the XSS vector)', () => {
    it('rejects a javascript: URL', () => {
      expect(safeRedirectUrl('javascript:alert(document.cookie)')).toBe('/dashboard');
    });

    it('rejects a javascript: URL regardless of casing/whitespace', () => {
      expect(safeRedirectUrl('  JaVaScRiPt:alert(1)')).toBe('/dashboard');
    });

    it('rejects a data: URL', () => {
      expect(safeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
    });

    it('rejects a vbscript: URL', () => {
      expect(safeRedirectUrl('vbscript:msgbox(1)')).toBe('/dashboard');
    });

    it('rejects a file: URL', () => {
      expect(safeRedirectUrl('file:///etc/passwd')).toBe('/dashboard');
    });
  });

  describe('fallback handling', () => {
    it('falls back on empty / nullish input', () => {
      expect(safeRedirectUrl('')).toBe('/dashboard');
      expect(safeRedirectUrl(undefined)).toBe('/dashboard');
      expect(safeRedirectUrl(null)).toBe('/dashboard');
    });

    it('falls back on a non-string', () => {
      // Guards against array query params (router.query can yield string[]).
      expect(safeRedirectUrl(['javascript:alert(1)'] as any)).toBe('/dashboard');
    });

    it('uses a custom fallback when provided', () => {
      expect(safeRedirectUrl('javascript:alert(1)', '/safe')).toBe('/safe');
    });

    it('falls back on a scheme-relative URL (avoids protocol ambiguity)', () => {
      // "//evil.com" inherits the page protocol — treat as unsafe (not clearly relative).
      expect(safeRedirectUrl('//evil.com/phish')).toBe('/dashboard');
    });
  });
});
