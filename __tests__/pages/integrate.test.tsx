/**
 * /integrate: a white-label partner's merchants copy their samples from the partner's framed page,
 * so the partner's brand goes into them — and the server-side route is documented.
 */
import { render } from '@testing-library/react';

// What the white-label service holds for the brand the page resolved; null on our own sites.
let mockPartner: { id: string; name: string; links: { support?: string } } | null = null;
jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({
  ...jest.requireActual('@conduit-ucpi/whitelabel-sdk'),
  usePartnerBrand: () => mockPartner,
  useOptionalBrand: () => mockPartner,
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { supportedTokens: [{ symbol: 'USDC' }] } }),
}));
jest.mock('@/components/ui/WalletRegistrationPrereq', () => () => null);
// framer-motion's in-view animation needs IntersectionObserver, which jsdom lacks.
jest.mock('@/components/ui/Fade', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: '/integrate', query: {}, asPath: '/integrate' }) }));

import IntegratePage from '@/pages/integrate';
import { API_DOCS_URL } from '@/lib/apiDocs';

const text = () => document.body.textContent || '';

describe('/integrate', () => {
  afterEach(() => {
    mockPartner = null;
  });

  it("puts a partner's brand into the checkout samples and the server-side request", () => {
    mockPartner = { id: 'cobro', name: 'COBRO', links: { support: 'mailto:soporte@cobro.example' } };
    const { container } = render(<IntegratePage />);
    expect(text()).toContain("brand: 'cobro'");
    expect(text()).toContain('"brand": "cobro"');
    // The rest of the page comes from the same record: the partner's support contact, not ours.
    expect(container.querySelector('a[href="mailto:soporte@cobro.example"]')?.textContent).toBe('soporte@cobro.example');
    expect(text()).not.toContain('info@stabledrop.me');
  });

  it('adds no brand on our own site', () => {
    render(<IntegratePage />);
    expect(text()).not.toContain("brand: '");
    expect(text()).not.toContain('"brand":');
    expect(text()).toContain('info@stabledrop.me');
  });

  it('documents the server-side route: prepare, fund, settle, with a link to the reference', () => {
    const { container } = render(<IntegratePage />);
    expect(text()).toContain('/api/ap2/prepare');
    expect(text()).toContain('POST /api/ap2/settle');
    // Linked from the hero, the server-side section and the resource links — all to the one reference.
    const references = Array.from(container.querySelectorAll('a')).filter((a) => a.textContent === 'API reference');
    expect(references.length).toBe(3);
    references.forEach((a) => expect(a.getAttribute('href')).toBe(API_DOCS_URL));
    expect(API_DOCS_URL).toMatch(/^https:\/\/[^/]+\/api\/ap2\/settle\/doc$/);
  });
});
