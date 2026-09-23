/**
 * useBrandedHref against a real provider.
 *
 * withBrandParam's own tests cover the string rules. What they cannot cover is
 * the decision of *whether* to carry a brand, which reads the resolution source
 * — and that is the half that would regress silently: a link stamped with
 * ?b=stabledrop everywhere looks harmless, and a link missing ?b=cobro only
 * shows up when a partner's buyer opens it.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrandProvider, useBrandedHref } from '@conduit-ucpi/whitelabel-sdk';
import { BRANDS, DEFAULT_BRAND_ID } from '@/config/brands';

function Link() {
  const brandedHref = useBrandedHref();
  return <span data-testid="href">{brandedHref('/contract-pay?contractId=6aa4f29b')}</span>;
}

const renderAt = (url: string, props: Record<string, unknown> = {}) => {
  window.history.replaceState({}, '', url);
  return render(
    <BrandProvider brands={BRANDS} defaultBrandId={DEFAULT_BRAND_ID} {...props}>
      <Link />
    </BrandProvider>
  );
};

const href = () => screen.getByTestId('href').textContent;

describe('useBrandedHref', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('carries a partner brand onto the payment link', async () => {
    renderAt('/create?b=cobro');

    // Resolution runs in an effect, so the first paint is still the default.
    await waitFor(() =>
      expect(href()).toBe('/contract-pay?contractId=6aa4f29b&b=cobro')
    );
  });

  it('leaves our own links clean on the default brand', async () => {
    renderAt('/create');

    await waitFor(() => expect(href()).toBe('/contract-pay?contractId=6aa4f29b'));
    // Not merely absent from the default — explicitly never stamped.
    expect(href()).not.toContain('b=');
  });

  it('does not carry a brand the registry does not hold', async () => {
    renderAt('/create?b=not-a-partner');

    await waitFor(() => expect(href()).toBe('/contract-pay?contractId=6aa4f29b'));
  });

  it('carries the brand a pinned route fixes, with no parameter present', async () => {
    renderAt('/create-cobro', { routeBrandId: 'cobro' });

    await waitFor(() =>
      expect(href()).toBe('/contract-pay?contractId=6aa4f29b&b=cobro')
    );
  });
});
