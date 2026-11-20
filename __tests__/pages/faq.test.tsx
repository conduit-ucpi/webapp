import { render, screen, fireEvent } from '@testing-library/react';
import FAQ from '@/pages/faq';
import { useLocale } from '@conduit-ucpi/whitelabel-sdk';
import { faqEn } from '@/config/faq/en';
import { faqEs } from '@/config/faq/es';

jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({ ...jest.requireActual('@conduit-ucpi/whitelabel-sdk'), useLocale: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: () => ({ config: { contractAddress: '0xC0FFEE' } }) }));
jest.mock('@/components/SEO', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/Fade', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const mockLocale = useLocale as jest.Mock;

it.each([['en', faqEn], ['es', faqEs]])('renders the %s FAQ when that is the locale', (locale, content) => {
  mockLocale.mockReturnValue(locale);
  render(<FAQ />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(content.hero.heading);
  const all = content.sections.flatMap((s) => s.items);
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(all.length);
  expect(screen.getByText(all[0].q)).toBeInTheDocument();
});

it.each([['en', faqEn], ['es', faqEs]])('has every %s answer in the page before anything is clicked', (locale, content) => {
  // The published HTML is this markup: an answer that only exists after a click is an answer
  // no search engine, assistant or find-in-page ever sees.
  mockLocale.mockReturnValue(locale);
  const { container } = render(<FAQ />);
  const all = content.sections.flatMap((s) => s.items);
  const answers = container.querySelectorAll('details');

  expect(answers).toHaveLength(all.length);
  const text = (container.textContent || '').replace(/\s+/g, ' ');
  all.forEach((item, i) => {
    expect(answers[i].querySelector('summary')).toHaveTextContent(item.q);
    // The first few words of the answer as written, before any Markdown in it.
    const opening = item.a.replace(/^[-\d.\s]+/, '').split(/[*`\[\n(:]/)[0].trim().split(/\s+/).slice(0, 4).join(' ');
    if (opening) expect(text).toContain(opening);
    expect((answers[i].textContent || '').length).toBeGreaterThan(item.q.length + 20);
  });
});

it('opens an answer with its links and the contract address', () => {
  mockLocale.mockReturnValue('es');
  render(<FAQ />);
  const item = faqEs.sections.flatMap((s) => s.items).find((i) => i.showContractAddress)!;
  fireEvent.click(screen.getByText(item.q));
  expect(screen.getByText('0xC0FFEE')).toBeInTheDocument();
  expect(screen.getByText(faqEs.contractAddress.label)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'SolidityScan' })).toHaveAttribute('href', 'https://solidityscan.com/quickscan');
});

it('falls back to English for a locale without a FAQ', () => {
  mockLocale.mockReturnValue('fr');
  render(<FAQ />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(faqEn.hero.heading);
});

describe('the FAQ tab on /plugin', () => {
  it('shows the same FAQ as /faq, in the visitor language', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PluginPage = require('@/pages/plugin').default;
    mockLocale.mockReturnValue('es');
    render(<PluginPage termsUpdated="1 November 2026" termsVersion="abc123def456" privacyUpdated="1 November 2026" />);
    const all = faqEs.sections.flatMap((s) => s.items);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(all.length);
    expect(screen.getByText(all[0].q)).toBeInTheDocument();
    expect(screen.queryByText(/instantescrow/)).toBeNull();
  });
});
