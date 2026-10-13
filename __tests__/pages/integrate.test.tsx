/**
 * /integrate: a white-label partner's merchants copy their samples from the partner's framed page,
 * so the partner's brand goes into them — and the server-side route is documented.
 */
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@conduit-ucpi/whitelabel-sdk';

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

  /*
   * A Spanish-language partner (e.g. cobro) gets the prose in Spanish; the samples a merchant copies
   * stay exactly as written, because translating code or field names would break them.
   */
  describe('under a Spanish locale', () => {
    const inLocale = (locale: 'es' | 'en') =>
      render(
        <I18nProvider brandLocale={locale}>
          <IntegratePage />
        </I18nProvider>
      );
    const codeOf = (container: HTMLElement, id: string) => container.querySelector(`code#${id}`)?.textContent;

    it('renders the headings in Spanish', async () => {
      inLocale('es');
      expect(await screen.findByText('Agrega un checkout con stablecoins a tu sitio web.')).toBeInTheDocument();
      expect(screen.getByText('Tres pasos para empezar a aceptar pagos.')).toBeInTheDocument();
      expect(screen.getByText('Verifica un pago tú mismo')).toBeInTheDocument();
      expect(screen.getByText('Preguntas frecuentes.')).toBeInTheDocument();
      expect(text()).not.toContain('Add stablecoin checkout to your website.');
    });

    it('keeps placeholders and inline code inside a translated sentence', async () => {
      const { container } = inLocale('es');
      await screen.findByText('Verifica un pago tú mismo');
      expect(text()).toContain('dale un contractid y te dice qué se pagó y a quién');
      const openapi = Array.from(container.querySelectorAll('a')).find((a) =>
        a.getAttribute('href')?.endsWith('/resultservice/v3/api-docs')
      );
      expect(openapi?.parentElement?.textContent).toMatch(/^El esquema completo .*documento OpenAPI: https:\/\/\S+\/resultservice\/v3\/api-docs\. Apunta/);
    });

    it('leaves the code samples exactly as they are in English', async () => {
      const english = inLocale('en');
      await screen.findByText('Add stablecoin checkout to your website.');
      const ids = ['step1', 'step2', 'step3', 'server-prepare', 'webhook-handler', 'results-query-curl', 'results-query-response', 'webhook-payload'];
      const samples = ids.map((id) => codeOf(english.container, id));
      english.unmount();

      const spanish = inLocale('es');
      await screen.findByText('Agrega un checkout con stablecoins a tu sitio web.');
      expect(ids.map((id) => codeOf(spanish.container, id))).toEqual(samples);
      samples.forEach((sample) => expect(sample).toBeTruthy());
      expect(codeOf(spanish.container, 'results-query-curl')).toContain('"contractid"');
    });

    it('still renders English under an English locale', async () => {
      inLocale('en');
      expect(await screen.findByText('Add stablecoin checkout to your website.')).toBeInTheDocument();
      expect(screen.getByText('Check a payment yourself')).toBeInTheDocument();
      expect(text()).not.toContain('Verifica un pago');
    });
  });
});
