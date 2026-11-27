/**
 * /plugins links to the escrow API's reference where everyone can see it, not only inside the
 * collapsed AI-agents panel.
 */
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/lib/tracking', () => ({ initRedditPixel: jest.fn(), trackConversion: jest.fn() }));
jest.mock('@/hooks/usePageTracking', () => ({ useScrollTracking: jest.fn(), useTimeTracking: jest.fn() }));
// framer-motion's in-view animation needs IntersectionObserver, which jsdom lacks.
jest.mock('@/components/ui/Fade', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: '/plugins', query: {}, asPath: '/plugins' }) }));

import PluginsPage from '@/pages/plugins';
import { API_DOCS_PATH } from '@/lib/apiDocs';
// The API host in this environment: in jsdom, with no API_BASE, the page's own origin.
const API_DOCS_URL = `${window.location.origin}${API_DOCS_PATH}`;

it('links to the API reference in plain sight, from the hero, without opening any panel', () => {
  const { container } = render(<PluginsPage />);
  const hero = container.querySelector('section[aria-label="Hero"]');
  const heroLink = Array.from(hero!.querySelectorAll('a')).find((a) => /API reference/i.test(a.textContent || ''));
  expect(heroLink?.getAttribute('href')).toBe(API_DOCS_URL);

  // And every other visible link to it (the footer) points at the same reference.
  const links = Array.from(container.querySelectorAll('a')).filter((a) => /API reference/i.test(a.textContent || ''));
  expect(links.length).toBeGreaterThanOrEqual(2);
  links.forEach((a) => expect(a.getAttribute('href')).toBe(API_DOCS_URL));
});

describe('the "Any website" checkout snippet', () => {
  // Required lazily so the page's mocks above are already in place.
  const { runCheckoutSnippet } = require('../../test-utils/checkoutSnippet');
  const checkoutSnippet = (container: HTMLElement) => {
    const blocks = Array.from(container.querySelectorAll('pre code')).map((c) => c.textContent || '');
    const snippet = blocks.find((b) => b.includes('ConduitCheckout'));
    if (!snippet) throw new Error('no checkout snippet on /plugins');
    return snippet;
  };

  it('loads the SDK from stabledrop.me and opens the checkout for its button', () => {
    const { container } = render(<PluginsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Any website/ }));
    const snippet = checkoutSnippet(container);
    expect(snippet).not.toContain('conduit-ucpi.com');

    const run = runCheckoutSnippet(snippet, { allowedOrigins: ['https://stabledrop.me'] });
    expect(run.scriptSrcs).toEqual(['https://stabledrop.me/conduit-checkout.js']);
    expect(run.initOptions).toMatchObject({ sellerAddress: expect.any(String), baseUrl: 'https://stabledrop.me' });
    expect(run.opened).toHaveLength(1);
    expect(run.opened[0].href).toMatch(/^https:\/\/stabledrop\.me\/contract-create\?/);
    expect(run.opened[0].searchParams.get('amount')).toBe('99.99');
  });
});
