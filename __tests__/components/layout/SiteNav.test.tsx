import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SiteNav from '@/components/layout/SiteNav';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { NAV_GROUPS } from '@/components/landing-test/content';

const push = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ push, pathname: '/dashboard', events: { on: jest.fn(), off: jest.fn() } }),
}));
jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: jest.fn() }));
jest.mock('@/components/navigation/NavigationProvider', () => ({
  useNavigation: () => ({ canGoBack: false, goBack: jest.fn() }),
}));
jest.mock('@/components/theme/ThemeToggle', () => () => <button type="button">theme</button>);
jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({
  useOptionalBrand: () => null,
  usePartnerBrand: () => null,
}));
jest.mock('@/lib/buildVersion', () => ({
  CLIENT_GIT_TAG: 'v9.9.9',
  CLIENT_GIT_SHA: 'abc1234',
  formatVersion: (tag?: string, sha?: string) => [tag, sha].filter(Boolean).join(' '),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseConfig = useConfig as jest.Mock;
const disconnect = jest.fn().mockResolvedValue(undefined);

function signIn(user: Record<string, unknown> = { email: 'sam@example.com', username: 'sam' }, providerName = 'web3auth') {
  mockUseAuth.mockReturnValue({ user, disconnect, switchWallet: jest.fn(), isConnected: true, state: { providerName } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, disconnect, switchWallet: jest.fn(), isConnected: false, state: {} });
  mockUseConfig.mockReturnValue({ config: { gitTag: 'v1.2.3', gitSha: 'def5678', projectsLive: false, emailVerificationLive: false } });
});

describe('SiteNav', () => {
  it('shows the landing page groups, each opening its own menu', () => {
    render(<SiteNav />);
    for (const group of NAV_GROUPS) {
      expect(screen.getByRole('button', { name: group.label })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Resources' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('How a payment works').closest('a')).toHaveAttribute('href', '/stabledrop-payment-flow.html');
    expect(screen.getAllByRole('link', { name: 'Pricing' })[0]).toHaveAttribute('href', '/#pricing');
  });

  it('hides Projects until the flag is on', () => {
    const { unmount } = render(<SiteNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    expect(within(screen.getByRole('menu')).queryByText('Projects')).toBeNull();
    unmount();

    mockUseConfig.mockReturnValue({ config: { projectsLive: true } });
    render(<SiteNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    expect(within(screen.getByRole('menu')).getByText('Projects')).toBeInTheDocument();
  });

  it('offers Dashboard (not "Sign in") when signed out', () => {
    render(<SiteNav />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByText('Sign in')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull();
  });

  it('names the signed-in user and opens their account menu with versions and logout', async () => {
    signIn();
    render(<SiteNav />);
    const account = screen.getByRole('button', { name: 'Account menu' });
    expect(account).toHaveTextContent('@sam');
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();

    fireEvent.click(account);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('v9.9.9 abc1234')).toBeInTheDocument();
    expect(within(menu).getByText('v1.2.3 def5678')).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Switch wallet' })).toBeInTheDocument();
    expect(within(menu).queryByText('Admin panel')).toBeNull();

    fireEvent.click(within(menu).getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(disconnect).toHaveBeenCalled();
  });

  it('falls back to the email, and shows Admin panel only to admins', () => {
    signIn({ email: 'boss@example.com', isAdmin: true }, 'metamask');
    render(<SiteNav />);
    const account = screen.getByRole('button', { name: 'Account menu' });
    expect(account).toHaveTextContent('boss@example.com');
    fireEvent.click(account);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Admin panel').closest('a')).toHaveAttribute('href', '/admin');
    expect(within(menu).queryByRole('button', { name: 'Switch wallet' })).toBeNull();
  });

  it('collapses to a menu button that carries the groups and the account section', () => {
    signIn();
    render(<SiteNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    // Account section (not the desktop dropdown, which is closed) plus every group heading.
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.getByText('v1.2.3 def5678')).toBeInTheDocument();
    for (const group of NAV_GROUPS) {
      expect(screen.getAllByText(group.label).length).toBeGreaterThan(1);
    }
  });

  it('can be forced dark for a page that is dark by design', () => {
    const { container } = render(<SiteNav forceDark />);
    expect(container.firstChild).toHaveClass('dark');
  });
});
