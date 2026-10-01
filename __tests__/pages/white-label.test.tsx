/**
 * /white-label: the partner guide. Under a partner's brand its snippets carry that brand id;
 * on our own site, a placeholder — no partner is named on the public page.
 */
import { render } from '@testing-library/react';

let mockPartner: { id: string } | null = null;
jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({
  ...jest.requireActual('@conduit-ucpi/whitelabel-sdk'),
  usePartnerBrand: () => mockPartner,
}));
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: '/white-label', query: {}, asPath: '/white-label' }) }));
const mockApiFetch = jest.fn();
jest.mock('@/lib/apiFetch', () => ({
  ...jest.requireActual('@/lib/apiFetch'),
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import WhiteLabelGuide from '@/pages/white-label';
import { API_DOCS_URL } from '@/lib/apiDocs';

const text = () => document.body.textContent || '';

afterEach(() => {
  mockPartner = null;
});

it('lays out all seven steps and who does each', () => {
  const { container } = render(<WhiteLabelGuide />);
  for (const id of ['brand-pack', 'create-brand', 'domains', 'pages', 'payments', 'confirm', 'test', 'limits']) {
    expect(container.querySelector(`section#${id}`)).not.toBeNull();
  }
  expect(text()).toContain('Host the framed pages');
  expect(text()).toContain('ALLOWED_FRAME_ANCESTORS');
});

it('says who does every step, in words', () => {
  const { container } = render(<WhiteLabelGuide />);
  const who = (id: string) => container.querySelector(`section#${id} .who`)?.textContent ?? '';
  expect(who('brand-pack')).toMatch(/Who does this:.*You \(the partner\).*fill in the form/);
  expect(who('create-brand')).toMatch(/Stabledrop \(us\).*Nothing for you to do here/);
  expect(who('domains')).toMatch(/Stabledrop \(us\).*Nothing for you to do here/);
  expect(who('pages')).toMatch(/You \(the partner\).*your own website/);
  expect(who('payments')).toMatch(/Your merchants/);
  expect(who('confirm')).toMatch(/Your merchants.*You \(the partner\)/);
  expect(who('test')).toMatch(/You \(the partner\).*Stabledrop \(us\)/);
});

it('uses a placeholder brand on our own site', () => {
  render(<WhiteLabelGuide />);
  expect(text()).toContain("var BRAND = 'your-brand'");
  expect(text()).toContain('/create?b=your-brand');
});

it("fills the snippets with a partner's brand id when viewed under it", () => {
  mockPartner = { id: 'escrow-me' };
  render(<WhiteLabelGuide />);
  expect(text()).toContain("var BRAND = 'escrow-me'");
  expect(text()).toContain("brand: 'escrow-me'");
  expect(text()).toContain('"brandId": "escrow-me"');
  expect(text()).not.toContain('your-brand\'');
});

it('links to the API reference', () => {
  const { container } = render(<WhiteLabelGuide />);
  const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'API reference');
  expect(link?.getAttribute('href')).toBe(API_DOCS_URL);
});

describe('the request form', () => {
  const { fireEvent, screen, waitFor } = jest.requireActual('@testing-library/react');

  const fillIn = () => {
    fireEvent.change(screen.getByLabelText('Your email address'), { target: { value: 'ana@cobro.example' } });
    fireEvent.change(screen.getByLabelText('Production domains'), { target: { value: 'cobro.example' } });
    fireEvent.change(screen.getByLabelText('Brand config'), { target: { value: '{"id":"cobro","name":"COBRO"}' } });
  };

  beforeEach(() => mockApiFetch.mockReset());

  it("will not send without the partner's own email address", () => {
    render(<WhiteLabelGuide />);
    fillIn();
    fireEvent.change(screen.getByLabelText('Your email address'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(screen.getByText('Enter your email address, so we can reply.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Fix the highlighted fields first.');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('says what is wrong with a config that cannot be used', () => {
    render(<WhiteLabelGuide />);
    fireEvent.change(screen.getByLabelText('Brand config'), { target: { value: '{not json' } });
    fireEvent.blur(screen.getByLabelText('Brand config'));
    expect(screen.getByText('The brand config is not valid JSON.')).toBeInTheDocument();
  });

  it('sends it to our route, with no recipient in it, and says it went', async () => {
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => ({ sent: true }) });
    render(<WhiteLabelGuide />);
    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('We will reply to ana@cobro.example'));
    const [path, init] = mockApiFetch.mock.calls[0];
    expect(path).toBe('/api/white-label-request');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ contactEmail: 'ana@cobro.example', productionDomains: ['cobro.example'], config: '{"id":"cobro","name":"COBRO"}' });
    expect(body).not.toHaveProperty('to');
  });

  it('says why it could not send, and points to copying the email instead', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Too many requests from here.' }) });
    render(<WhiteLabelGuide />);
    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many requests from here.'));
    expect(screen.getByRole('alert')).toHaveTextContent('Use Copy email');
  });
});
