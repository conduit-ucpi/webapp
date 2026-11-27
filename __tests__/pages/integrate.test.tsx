/**
 * /integrate: a white-label partner's merchants copy their samples from the partner's framed page,
 * so the partner's brand goes into them — and the server-side route is documented.
 */
import { fireEvent, render, screen } from '@testing-library/react';
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
import { API_DOCS_PATH } from '@/lib/apiDocs';
// The API host in this environment: in jsdom, with no API_BASE, the page's own origin.
const API_DOCS_URL = `${window.location.origin}${API_DOCS_PATH}`;

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
    expect(API_DOCS_URL).not.toContain('stabledrop.me');
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
      expect(openapi?.parentElement?.textContent).toMatch(/^El esquema completo .*documento OpenAPI: https?:\/\/\S+\/resultservice\/v3\/api-docs\. Apunta/);
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

describe('checkout snippets', () => {
  const { runCheckoutSnippet } = require('../../test-utils/checkoutSnippet');
  const origin = window.location.origin;
  const code = (id: string) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`no #${id} code block`);
    return el.textContent || '';
  };
  // The quick start's three steps, pasted together as the page tells the merchant to.
  const quickStart = () => [code('step1'), code('step2'), code('step3')].join('\n');

  it('the quick start loads our SDK, initialises, and its button opens the checkout', () => {
    render(<IntegratePage />);
    const run = runCheckoutSnippet(quickStart(), { allowedOrigins: [origin] });
    expect(run.scriptSrcs).toEqual([`${origin}/conduit-checkout.js`]);
    expect(run.initOptions).toMatchObject({ sellerAddress: expect.any(String), baseUrl: origin });
    expect(run.opened).toHaveLength(1);
    expect(run.opened[0].pathname).toBe('/contract-create');
    expect(run.opened[0].searchParams.get('amount')).toBe('50.00');
  });

  it.each([
    ['Basic Payment', 'ex-basic', {}, { amount: '29.99', order_id: 'ORDER-12345', tokenSymbol: 'USDC' }],
    ['Extended Protection', 'ex-extended', {}, { amount: '99.00', email: 'customer@example.com' }],
    ['Custom Amount', 'ex-custom', { amount: '12.50' }, { amount: '12.50', description: 'Support our project' }],
    ['USDT Payment', 'ex-usdt', {}, { amount: '500.00', tokenSymbol: 'USDT' }],
  ])('the "%s" example opens the checkout for what it says', (tab, id, inputs, expected) => {
    render(<IntegratePage />);
    fireEvent.click(screen.getAllByRole('button', { name: tab })[0]);
    const pasted = [code('step1'), code('step2'), code(id)].join('\n');
    const run = runCheckoutSnippet(pasted, { allowedOrigins: [origin], inputs });
    expect(run.opened).toHaveLength(1);
    for (const [k, v] of Object.entries(expected)) expect(run.opened[0].searchParams.get(k)).toBe(v);
  });

  it('the webhook setup is valid in place of the quick start init', () => {
    render(<IntegratePage />);
    const pasted = `${code('step1')}\n<script>${code('webhook-init')}</script>\n${code('step3')}`;
    const run = runCheckoutSnippet(pasted, { allowedOrigins: [origin] });
    expect(run.initOptions).toMatchObject({ webhookUrl: expect.stringMatching(/^https:/), baseUrl: origin });
    expect(run.opened).toHaveLength(1);
  });

  it("a partner's samples carry their brand into the checkout", () => {
    mockPartner = { id: 'cobro', name: 'COBRO', links: {} };
    render(<IntegratePage />);
    const run = runCheckoutSnippet(quickStart(), { allowedOrigins: [origin] });
    expect(run.opened[0].searchParams.get('b')).toBe('cobro');
  });
});
