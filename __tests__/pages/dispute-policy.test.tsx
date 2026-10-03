import { render, screen } from '@testing-library/react';
import DisputePolicy from '@/pages/dispute-policy';

jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({ useBrand: () => ({ name: 'COBRO' }) }));
jest.mock('@/components/SEO', () => ({ __esModule: true, default: ({ title }: { title: string }) => <span data-testid="seo-title">{title}</span> }));
jest.mock('@/components/dispute-rules/DisputeRules', () => ({ __esModule: true, default: () => <div data-testid="dispute-rules" /> }));

/** The dispute policy page: three parts, named from the visitor's brand, with nothing hard-coded. */
describe('dispute policy page', () => {
  it('has exactly the three parts, the third served by disputeservice', () => {
    render(<DisputePolicy dateModified="2026-10-03" />);
    const parts = Array.from(document.querySelectorAll('section[id^="part-"] h2')).map(h => h.textContent);
    expect(parts).toEqual([
      'Part 1. How a dispute works in the escrow contract',
      'Part 2. How the tiebreaker is appointed and changed',
      "Part 3. How COBRO's default tiebreaker votes",
    ]);
    expect(document.querySelector('#part-3 [data-testid="dispute-rules"]')).not.toBeNull();
  });

  it('starts and ends with the same statement of the three votes', () => {
    render(<DisputePolicy dateModified="2026-10-03" />);
    const sections = Array.from(document.querySelectorAll('section'));
    const last = sections[sections.length - 1];
    expect(last.id).toBe('one-vote');
    expect(last.querySelector('h2')?.textContent).toBe('Remember: the tiebreaker has one vote of three');
    const phrase = "The contract has three votes of equal standing: the buyer's, the seller's, and the tiebreaker's (a party you nominate, or COBRO's default). Funds are released when any two of the three agree.";
    expect(last.querySelector('p')?.textContent).toBe(phrase);
    expect(document.getElementById('three-votes-intro')?.textContent).toBe(phrase);
  });

  it('does not wrap itself in Layout: the app shell already does, and a second one doubles the header and footer', () => {
    const source = require('fs').readFileSync(require('path').join(process.cwd(), 'pages/dispute-policy.tsx'), 'utf8');
    expect(source).not.toMatch(/components\/layout\/Layout|<Layout\b/);
  });

  it('takes every name from the brand', () => {
    const { container } = render(<DisputePolicy dateModified="2026-10-03" />);
    expect(screen.getByTestId('seo-title').textContent).toBe('Dispute Policy | COBRO');
    expect(container.textContent).toContain('On COBRO it is COBRO’s default tiebreaker'.replace('’', "'"));
    expect(container.textContent).not.toMatch(/StableDrop|Stabledrop|Conduit/);
    expect(container.textContent).toContain('The contract cannot be changed once it is created, by anyone, including COBRO. It has no owner, no admin key and no way to be upgraded. Its rules are fixed in its code.');
  });
});
