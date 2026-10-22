import { fireEvent, render, screen, within } from '@testing-library/react';
import Home from '../../pages/index';
import {
  AGENT_POINTS,
  BENEFITS,
  BUYER_POINTS,
  ESCROW_COMPARISON,
  HOW_IT_WORKS,
  MAKE_PAYMENT_HREF,
  MCP_PATH,
  API_PLACEHOLDER,
  MERCHANT_POINTS,
  NAV_GROUPS,
  PRICING_ROWS,
  PROOF_POINTS,
  SOURCE_URL,
  VIDEO_ID,
} from '@/components/landing-test/content';

/*
 * The homepage's functional inventory, drawn from the content module it renders. It was
 * chosen from the landing experiments; this holds it to every button they all had to carry.
 */

// The homepage carries the site-wide nav, which reads the router, auth and config.
jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/', push: jest.fn(), events: { on: jest.fn(), off: jest.fn() } }),
}));
jest.mock('@/components/auth', () => ({
  useAuth: () => ({ user: null, isConnected: false, disconnect: jest.fn(), switchWallet: jest.fn(), state: {} }),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: () => ({ config: { projectsLive: true } }) }));
// The fee is the escrow factory's answer (useFeeQuote → /api/fee-quote → chainservice), never a
// rule in the page. These are the figures the factory gives for the amounts the tests type.
const FACTORY_FEES: Record<number, number> = { 2500: 25, 100: 1, 10: 0.3, 1200: 12 };
jest.mock('@/hooks/useFeeQuote', () => ({
  useFeeQuote: (amount: number | null) =>
    amount === null ? { state: 'idle' } : amount in FACTORY_FEES ? { state: 'quoted', fee: FACTORY_FEES[amount] } : { state: 'loading' },
}));
jest.mock('@/components/navigation/NavigationProvider', () => ({
  useNavigation: () => ({ canGoBack: false, goBack: jest.fn() }),
}));

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


function hrefs(): string[] {
  return screen.getAllByRole('link').map((a) => a.getAttribute('href') || '');
}

describe('homepage', () => {
  const Page = Home;
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
        // The API reference's host is this environment's, filled in at render.
        const href = item.href.split(API_PLACEHOLDER).join(window.location.origin);
        expect(matches.some((a) => a.getAttribute('href') === href)).toBe(true);
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
    // The Products menu holds the make-payment entry; open it so its links count.
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Products' }));
    const links = hrefs();
    expect(links).toContain('/create');
    expect(links).toContain('/dashboard');
    expect(links).toContain(SOURCE_URL);
    // "Make payment" is offered at least in the nav.
    expect(links).toContain(MAKE_PAYMENT_HREF);
    for (const p of PROOF_POINTS) expect(screen.getAllByText(new RegExp(p)).length).toBeGreaterThan(0);
  });

  it('F3: the estimator computes fee, net and the early-sale figure from its inputs', () => {
    render(<Page />);
    const est = screen.getByTestId('escrow-estimator');
    // Default $2,500, and the factory's fee on it, → $2,475.00 to the seller.
    expect(within(est).getByTestId('estimator-net')).toHaveTextContent('2,475.00');
    fireEvent.change(within(est).getByLabelText('Amount the buyer pays'), { target: { value: '100' } });
    expect(within(est).getByTestId('estimator-net')).toHaveTextContent('99.00');
    // Whatever the factory says on a small amount is what is shown — its minimum included.
    fireEvent.change(within(est).getByLabelText('Amount the buyer pays'), { target: { value: '10' } });
    expect(within(est).getByTestId('estimator-net')).toHaveTextContent('9.70');
    expect(within(est).getByText(/0\.30 USDC/)).toBeInTheDocument();
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
    // No opener: Privy would treat the checkout as its sign-in popup and never finish a Google login.
    expect(openSpy.mock.calls[0][2]).toBe('noopener');
    // The video plays in place: the thumbnail swaps for the embedded player on click.
    fireEvent.click(screen.getByRole('button', { name: 'Play the walkthrough video' }));
    expect(screen.getByTitle('Walkthrough video')).toHaveAttribute('src', expect.stringContaining(`/embed/${VIDEO_ID}`));
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
    expect(screen.getByRole('link', { name: 'API reference' })).toHaveAttribute('href', `${window.location.origin}/api/ap2/settle/doc`);
  });

  it('F10: embed examples switch between surfaces and carry this environment\'s MCP URL', () => {
    render(<Page />);
    const embed = screen.getByTestId('embed-examples');
    expect(within(embed).getByText(/ConduitCheckout.init/)).toBeInTheDocument();
    fireEvent.click(within(embed).getByRole('tab', { name: 'AI agents (MCP)' }));
    const mcpUrl = `${window.location.origin}${MCP_PATH}`;
    expect(within(embed).getByText(new RegExp(mcpUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(within(embed).queryByText(/\{api\}/)).not.toBeInTheDocument();
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
    expect(within(pricing as HTMLElement).getByText('Card payments vs. Stabledrop.')).toBeInTheDocument();
    // The pill switches the table, and the heading beside it, to traditional escrow.
    const tabs = within(pricing as HTMLElement).getByTestId('pricing-tabs');
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Traditional escrow' }));
    for (const r of ESCROW_COMPARISON) {
      expect(within(tabs).getByText(r.item)).toBeInTheDocument();
      expect(within(tabs).getByText(r.traditional)).toBeInTheDocument();
    }
    expect(within(pricing as HTMLElement).getByText('Traditional escrow vs. Stabledrop.')).toBeInTheDocument();
    // The calculator compares against card processors only, so it goes with that tab.
    expect(within(tabs).queryByRole('link')).toBeNull();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Card payments' }));
    expect(within(tabs).getByText('Processing fee')).toBeInTheDocument();
  });

  it('F12–F13: benefit quotes, the plugins CTA and the footer links', () => {
    render(<Page />);
    for (const b of BENEFITS) {
      expect(screen.getByText(new RegExp(b.title))).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Explore plugins/i })).toHaveAttribute('href', '/plugins');
    const links = hrefs();
    for (const h of ['/how-it-works', '/faq', '/plugins', '/plugins#mcp', '/terms-of-service', '/privacy-policy', 'mailto:info@stabledrop.me', SOURCE_URL]) {
      expect(links).toContain(h);
    }
  });
});
