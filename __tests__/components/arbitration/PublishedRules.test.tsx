import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import PublishedRules from '@/components/arbitration/PublishedRules';
import RulesMarkdown, { parseBlocks } from '@/components/arbitration/RulesMarkdown';

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body } as Response);
const SHA = '2b8b926f4c20e08f03593209460f05a7d4941545';
const rules = (over: Record<string, unknown> = {}) => ({
  policySha: SHA,
  policyCommittedAt: 1790361496,
  policyModified: false,
  buildSha: 'f'.repeat(40),
  sections: [
    { number: '3', title: 'Jurisdiction — checked before anything else', markdown: 'Answer `OUT_OF_SCOPE` immediately.\n\n### 3a. Unreadable\n\nText.' },
    { number: '4', title: 'The rule, and the cases under it', markdown: '**The last substantive filing that nobody answered carries.**' },
  ],
  ...over,
});

describe('RulesMarkdown', () => {
  it('reads the shapes the policy is written in', () => {
    const blocks = parseBlocks([
      '### 5a. Reasonable steps',
      '',
      'A paragraph that',
      'wraps.',
      '',
      '1. **Email**, where the party has a verified address',
      '   (the user service answers this).',
      '3a. The escrow is above the ceiling.',
      '',
      '- one',
      '- two',
      '',
      '> We intend to release',
      '> this escrow.',
    ].join('\n'));
    expect(blocks).toEqual([
      { kind: 'heading', text: '5a. Reasonable steps' },
      { kind: 'paragraph', text: 'A paragraph that wraps.' },
      { kind: 'list', ordered: true, items: [
        { label: '1', text: '**Email**, where the party has a verified address (the user service answers this).' },
        { label: '3a', text: 'The escrow is above the ceiling.' },
      ] },
      { kind: 'list', ordered: false, items: [{ text: 'one' }, { text: 'two' }] },
      { kind: 'quote', text: 'We intend to release this escrow.' },
    ]);
  });

  it('renders emphasis as elements and markup as plain text, never as HTML', () => {
    const { container } = render(<RulesMarkdown markdown={'**Bold with `code`** and *italic*. <img src=x onerror="alert(1)"> [link](javascript:alert(1))'} />);
    expect(container.querySelector('strong code')?.textContent).toBe('code');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});

describe('PublishedRules', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
  });

  it('shows the sections disputeservice serves, under the commit that last changed them', async () => {
    fetchMock.mockResolvedValueOnce(json(200, rules()));
    render(<PublishedRules />);
    await waitFor(() => expect(screen.getByTestId('rules-section-3')).toBeTruthy());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/arbitration/rules');
    expect(screen.getByText('§3 Jurisdiction — checked before anything else')).toBeTruthy();
    expect(screen.getByText('The last substantive filing that nobody answered carries.').tagName).toBe('STRONG');
    const version = screen.getByTestId('rules-version');
    expect(version.textContent).toBe(SHA.slice(0, 12));
    expect(version.getAttribute('title')).toBe(SHA);
    expect(version.parentElement?.textContent).toBe(`Rules version ${SHA.slice(0, 12)}, last changed 25 September 2026.`);
  });

  it('says so when the text is not exactly what the version names', async () => {
    fetchMock.mockResolvedValueOnce(json(200, rules({ policyModified: true })));
    render(<PublishedRules />);
    await waitFor(() => expect(screen.getByTestId('rules-version').parentElement?.textContent).toContain('uncommitted changes'));
  });

  it('says the version is unknown rather than inventing one', async () => {
    fetchMock.mockResolvedValueOnce(json(200, rules({ policySha: null, policyCommittedAt: null })));
    render(<PublishedRules />);
    await waitFor(() => expect(screen.getByText('Rules version: unknown.')).toBeTruthy());
  });

  it('shows a plain failure, and no rules, when the service cannot be reached', async () => {
    fetchMock.mockResolvedValueOnce(json(503, { error: 'unavailable' }));
    render(<PublishedRules />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('rules-section-3')).toBeNull();
  });
});
