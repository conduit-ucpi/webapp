import { render, screen } from '@testing-library/react';
import DisputePolicy from '@/pages/dispute-policy';

jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({ useBrand: () => ({ name: 'COBRO' }) }));
jest.mock('@/components/SEO', () => ({ __esModule: true, default: ({ title }: { title: string }) => <span data-testid="seo-title">{title}</span> }));
jest.mock('@/components/dispute-rules/DisputeRules', () => ({ __esModule: true, default: () => <div data-testid="dispute-rules" /> }));

/** The Dispute Resolution Rules page: fourteen sections, named from the visitor's brand. */
describe('dispute policy page', () => {
  it('has the fourteen sections, with 6 and 7 served by disputeservice', () => {
    render(<DisputePolicy dateModified="2026-10-03" />);
    const sections = Array.from(document.querySelectorAll('section'));
    expect(sections.map(s => s.querySelector('h2')?.textContent)).toEqual([
      '1. Definitions',
      '2. About these rules',
      "3. COBRO's role",
      '4. How each Smart Contract treats a Dispute',
      '5. How the Third Voter is appointed and changed',
      "6. How COBRO's default Third Voter votes",
      '7. Deadlines and notices',
      '8. Independent review',
      '9. Evidence and fair play',
      '10. Fees and costs',
      '11. Your consents and rights',
      '12. Liability',
      '13. Changes to these rules',
      '14. Governing law and language',
    ]);
    expect(sections[5].querySelector('[data-testid="dispute-rules"]')).not.toBeNull();
    expect(sections[6].querySelector('[data-testid="dispute-rules"]')).not.toBeNull();
  });

  it('states what the contract does about the seat', () => {
    const { container } = render(<DisputePolicy dateModified="2026-10-03" />);
    expect(container.textContent).toContain('remove the Third Voter if it has not voted for 30 days');
    expect(container.textContent).toContain('A Seller moving their payout directly to another wallet does not empty the seat.');
    expect(container.textContent).toContain("The Seller can move their payout to another wallet unless there's a live dispute.");
  });

  it('does not wrap itself in Layout: the app shell already does, and a second one doubles the header and footer', () => {
    const source = require('fs').readFileSync(require('path').join(process.cwd(), 'pages/dispute-policy.tsx'), 'utf8');
    expect(source).not.toMatch(/components\/layout\/Layout|<Layout\b/);
  });

  it('takes every name from the brand, except where 2.1 says whose trading name Stabledrop is', () => {
    const { container } = render(<DisputePolicy dateModified="2026-10-03" />);
    expect(screen.getByTestId('seo-title').textContent).toBe('Dispute Resolution Rules | COBRO');
    expect(container.textContent).toContain("On COBRO it is COBRO's default Third Voter");
    expect(container.textContent).toContain('Stabledrop is the trading name of Conduit-UCPI Ltd');
    const without21 = (container.textContent ?? '').replace('Stabledrop is the trading name of Conduit-UCPI Ltd', '');
    expect(without21).not.toMatch(/StableDrop|Stabledrop|Conduit/);
    expect(container.textContent).toContain('The Smart Contract cannot be changed once it is created, by anyone, including COBRO. It has no owner,');
  });
});
