/**
 * Carrying the brand across in-app links.
 *
 * The brand lives in the URL and nothing persists it, so any link that drops
 * `?b=` drops the branding. The case that matters: a COBRO seller creates a
 * request on /create?b=cobro and shares the payment link. If that link is bare,
 * their buyer opens a Stabledrop page — a white-label failing in front of the
 * one person who was never told our name.
 */

import { shareableUrl, withBrandParam } from '@conduit-ucpi/whitelabel-sdk';

describe('withBrandParam', () => {
  it('appends the brand to a link that already has a query', () => {
    expect(withBrandParam('/contract-pay?contractId=6aa4f29b', 'cobro')).toBe(
      '/contract-pay?contractId=6aa4f29b&b=cobro'
    );
  });

  it('starts a query on a link that has none', () => {
    expect(withBrandParam('/dashboard', 'cobro')).toBe('/dashboard?b=cobro');
  });

  it('keeps every existing parameter', () => {
    const out = withBrandParam('/contract-pay?contractId=abc&method=qr', 'cobro');
    expect(out).toContain('contractId=abc');
    expect(out).toContain('method=qr');
    expect(out).toContain('b=cobro');
  });

  describe('when there is no brand to carry', () => {
    // Our own default is what a bare URL already means, so the hook passes null
    // rather than stamping ?b=stabledrop onto every link in the app.
    it('leaves the path exactly as it was', () => {
      expect(withBrandParam('/contract-pay?contractId=abc', null)).toBe(
        '/contract-pay?contractId=abc'
      );
      expect(withBrandParam('/dashboard', undefined)).toBe('/dashboard');
    });
  });

  describe('when the link already names a brand', () => {
    // A caller that has already decided — a payment page reading the partner
    // off the contract — outranks the ambient brand.
    it('does not override an explicit ?b=', () => {
      expect(withBrandParam('/contract-pay?b=acme&contractId=abc', 'cobro')).toBe(
        '/contract-pay?b=acme&contractId=abc'
      );
    });

    it('respects the long ?brand= spelling too', () => {
      expect(withBrandParam('/pay?brand=acme', 'cobro')).toBe('/pay?brand=acme');
    });

    // An empty value is not a decision, so it should still be filled.
    it('fills in an empty brand parameter', () => {
      expect(withBrandParam('/pay?b=', 'cobro')).toContain('b=cobro');
    });
  });

  describe('fragments', () => {
    // A parameter appended after '#' lands in the fragment and does nothing at
    // all — the branding would silently vanish rather than fail loudly.
    it('inserts before the fragment, not after it', () => {
      expect(withBrandParam('/create#how-it-works', 'cobro')).toBe(
        '/create?b=cobro#how-it-works'
      );
    });

    it('handles a fragment alongside an existing query', () => {
      expect(withBrandParam('/create?amount=40#terms', 'cobro')).toBe(
        '/create?amount=40&b=cobro#terms'
      );
    });
  });
});

describe('shareableUrl', () => {
  const OWN = 'https://stabledrop.me';

  it("puts a handed-out link on the partner's site, path and query whole", () => {
    expect(shareableUrl('/contract-pay?contractId=6ada&b=cobro', 'https://cobro.com', OWN)).toBe(
      'https://cobro.com/contract-pay?contractId=6ada&b=cobro'
    );
  });

  it('keeps a path prefix on the base, without doubling slashes', () => {
    expect(shareableUrl('/pay?resume=x', 'https://cobro.com/pagos/', OWN)).toBe('https://cobro.com/pagos/pay?resume=x');
  });

  it('stays on our own site without a base', () => {
    expect(shareableUrl('/contract-pay?contractId=6ada', undefined, OWN)).toBe(`${OWN}/contract-pay?contractId=6ada`);
  });

  it('ignores a base that is not a plain https address', () => {
    for (const bad of ['http://cobro.com', 'javascript:alert(1)//', 'https://cobro.com/?x=1', 'https://cobro.com/#f', '//cobro.com']) {
      expect(shareableUrl('/pay', bad, OWN)).toBe(`${OWN}/pay`);
    }
  });
});
