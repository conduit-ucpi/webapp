import { fireEvent, render, screen, within } from '@testing-library/react';
import LandingTest01 from '@/pages/landing-test-01';
import LandingTest02 from '@/pages/landing-test-02';
import LandingTest03 from '@/pages/landing-test-03';
import LandingTest04 from '@/pages/landing-test-04';
import LandingTest05 from '@/pages/landing-test-05';
import LandingTest06 from '@/pages/landing-test-06';
import LandingTest07 from '@/pages/landing-test-07';
import LandingTest08 from '@/pages/landing-test-08';
import LandingTest09 from '@/pages/landing-test-09';
import LandingTest10 from '@/pages/landing-test-10';
import LandingTest11 from '@/pages/landing-test-11';
import LandingTest12 from '@/pages/landing-test-12';
import LandingTest13 from '@/pages/landing-test-13';
import LandingTest14 from '@/pages/landing-test-14';
import LandingTest15 from '@/pages/landing-test-15';
import LandingTest16 from '@/pages/landing-test-16';
import {
  AGENT_POINTS,
  API_DOC_URL,
  BENEFITS,
  BUYER_POINTS,
  HOW_IT_WORKS,
  MAKE_PAYMENT_HREF,
  MCP_URL,
  MERCHANT_POINTS,
  NAV_GROUPS,
  PRICING_ROWS,
  PROOF_POINTS,
  SOURCE_URL,
  VIDEO_URL,
} from '@/components/landing-test/content';

/*
 * The landing tests are an experiment in presentation only. If one of them dropped
 * a button, the experiment would be measuring the missing button rather than the design.
 * So every page is held to the same functional inventory, drawn from the content module
 * they all share.
 */

jest.mock('framer-motion', () => {
  const React = require('react');
  const STRIP = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileInView', 'viewport', 'whileHover', 'whileTap', 'layout']);
  const plain = (tag: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const rest: Record<string, unknown> = {};
      for (const k of Object.keys(props)) if (!STRIP.has(k)) rest[k] = props[k];
      return React.createElement(tag, { ...rest, ref });
    });
    C.displayName = `motion.${tag}`;
    return C;
  };
  const cache: Record<string, unknown> = {};
  const motion = new Proxy({}, { get: (_t, tag: string) => (cache[tag] ??= plain(tag)) });
  return {
    motion,
    useInView: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const PAGES = [
  ['landing-test-01', LandingTest01],
  ['landing-test-02', LandingTest02],
  ['landing-test-03', LandingTest03],
  ['landing-test-04', LandingTest04],
  ['landing-test-05', LandingTest05],
  ['landing-test-06', LandingTest06],
  ['landing-test-07', LandingTest07],
  ['landing-test-08', LandingTest08],
  ['landing-test-09', LandingTest09],
  ['landing-test-10', LandingTest10],
  ['landing-test-11', LandingTest11],
  ['landing-test-12', LandingTest12],
  ['landing-test-13', LandingTest13],
  ['landing-test-14', LandingTest14],
  ['landing-test-15', LandingTest15],
  ['landing-test-16', LandingTest16],
] as const;

function hrefs(): string[] {
  return screen.getAllByRole('link').map((a) => a.getAttribute('href') || '');
}

describe.each(PAGES)('%s', (_name, Page) => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => openSpy.mockRestore());

  it('F1: has the Stripe-style top bar with every group, pricing, sign-in and a request CTA', () => {
    render(<Page />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const g of NAV_GROUPS) {
      const btn = within(nav).getByRole('button', { name: g.label });
      fireEvent.click(btn);
      for (const item of g.items) {
        // Name and target together: "Request payment" is also the bar's own button.
        const matches = within(nav).getAllByRole('link', { name: new RegExp(item.label) });
        expect(matches.some((a) => a.getAttribute('href') === item.href)).toBe(true);
      }
      fireEvent.click(btn);
    }
    expect(within(nav).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing');
    // "Sign in" or "My dashboard": the label varies, the target does not.
    expect(within(nav).getAllByRole('link').some((a) => a.getAttribute('href') === '/dashboard')).toBe(true);
    const primary = within(nav).getAllByRole('link').filter((a) => a.getAttribute('href') === '/create');
    expect(primary.length).toBeGreaterThan(0);
    // Mobile menu opens and lists the same groups.
    fireEvent.click(within(nav).getByRole('button', { name: 'Open menu' }));
    expect(within(nav).getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('F2: hero links to create and to the dashboard, and cites the proof points', () => {
    render(<Page />);
    // The Products menu holds the make-payment entry on every page; open it so its links count.
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Products' }));
    const links = hrefs();
    expect(links).toContain('/create');
    expect(links).toContain('/dashboard');
    expect(links).toContain(SOURCE_URL);
    // Every page offers "make payment" somewhere (the nav at least; the scrolly heroes as a button).
    expect(links).toContain(MAKE_PAYMENT_HREF);
    for (const p of PROOF_POINTS) expect(screen.getAllByText(new RegExp(p)).length).toBeGreaterThan(0);
  });

  it('F3: the estimator computes fee, net and the early-sale figure from its inputs', () => {
    render(<Page />);
    const est = screen.getByTestId('escrow-estimator');
    // Default $2,500 at 1% → $2,475.00 to the seller.
    expect(within(est).getByTestId('estimator-net')).toHaveTextContent('2,475.00');
    fireEvent.change(within(est).getByLabelText('Amount the buyer pays'), { target: { value: '100' } });
    expect(within(est).getByTestId('estimator-net')).toHaveTextContent('99.00');
    // Below $30 the $0.30 floor binds.
    fireEvent.change(within(est).getByLabelText('Amount the buyer pays'), { target: { value: '10' } });
    expect(within(est).getByTestId('estimator-net')).toHaveTextContent('9.70');
    expect(within(est).getByText(/0\.30 minimum/)).toBeInTheDocument();
    // Card comparison and early sale are present and the CTA goes to /create.
    expect(within(est).getByTestId('estimator-saving')).toBeInTheDocument();
    expect(within(est).getByTestId('estimator-early')).toBeInTheDocument();
    fireEvent.change(within(est).getByLabelText('Days until payout'), { target: { value: '30' } });
    expect(within(est).getByText(/30 days after funding/)).toBeInTheDocument();
    expect(within(est).getByRole('link')).toHaveAttribute('href', '/create');
  });

  it('F4: the Personal / Business / Platform switch changes the use cases', () => {
    render(<Page />);
    const tabs = screen.getByTestId('audience-tabs');
    expect(within(tabs).getByText('Online stores')).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Personal' }));
    expect(within(tabs).getByText('Friends and family across borders')).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Platform' }));
    expect(within(tabs).getByText('AI agents')).toBeInTheDocument();
    expect(within(tabs).getByText(/Countries where the local currency/)).toBeInTheDocument();
  });

  it('F5: explains create, fund, release', () => {
    render(<Page />);
    for (const s of HOW_IT_WORKS) {
      expect(screen.getAllByText(s.title).length).toBeGreaterThan(0);
      // At least once: a titles-only chapter also shows the active block's text on the left.
      expect(screen.getAllByText(s.desc).length).toBeGreaterThan(0);
    }
  });

  it('F6: the live demo opens the real checkout and offers the video and the calculator', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'See what your customers see' }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = String(openSpy.mock.calls[0][0]);
    expect(url).toContain('/contract-create?seller=0x4f118f99a4e8bb384061bcfe081e3bbdec28482d');
    expect(url).toContain('amount=0.001');
    expect(openSpy.mock.calls[0][1]).toBe('_blank');
    expect(screen.getByRole('link', { name: 'Watch video instead' })).toHaveAttribute('href', VIDEO_URL);
    expect(hrefs()).toContain('/merchant-savings-calculator');
    expect(screen.getByText(/Pay \$0\.001 USDC/)).toBeInTheDocument();
  });

  it('F7–F9: merchant, buyer and agent points, each with its actions', () => {
    render(<Page />);
    for (const p of [...MERCHANT_POINTS, ...BUYER_POINTS, ...AGENT_POINTS]) {
      expect(screen.getAllByText(p.text).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('link', { name: 'View integrations' })).toHaveAttribute('href', '/plugins');
    expect(screen.getByRole('link', { name: 'Connect your agent' })).toHaveAttribute('href', '/plugins#mcp');
    expect(screen.getByRole('link', { name: 'API reference' })).toHaveAttribute('href', API_DOC_URL);
  });

  it('F10: embed examples switch between surfaces and carry the real MCP URL', () => {
    render(<Page />);
    const embed = screen.getByTestId('embed-examples');
    expect(within(embed).getByText(/ConduitCheckout.init/)).toBeInTheDocument();
    fireEvent.click(within(embed).getByRole('tab', { name: 'AI agents (MCP)' }));
    expect(within(embed).getByText(new RegExp(MCP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    fireEvent.click(within(embed).getByRole('tab', { name: 'WordPress' }));
    expect(within(embed).getByRole('link', { name: /Get the plugin/ })).toHaveAttribute('href', expect.stringContaining('wordpress.org'));
  });

  it('F11: pricing is anchored, says 1% and lists every "None"', () => {
    const { container } = render(<Page />);
    const pricing = container.querySelector('#pricing');
    expect(pricing).not.toBeNull();
    for (const [k] of PRICING_ROWS) {
      expect(within(pricing as HTMLElement).getByText(k)).toBeInTheDocument();
    }
    expect(within(pricing as HTMLElement).getByRole('link')).toHaveAttribute('href', '/merchant-savings-calculator');
  });

  it('F12–F13: benefit quotes, the plugins CTA and the footer links', () => {
    render(<Page />);
    for (const b of BENEFITS) {
      expect(screen.getByText(new RegExp(b.title))).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Explore plugins/i })).toHaveAttribute('href', '/plugins');
    const links = hrefs();
    for (const h of ['/how-it-works', '/faq', '/plugins', '/plugins#mcp', '/terms-of-service', '/privacy-policy', 'mailto:info@conduit-ucpi.com', SOURCE_URL]) {
      expect(links).toContain(h);
    }
  });
});
