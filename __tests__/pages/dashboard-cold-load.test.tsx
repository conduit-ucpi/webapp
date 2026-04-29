/**
 * Dashboard rendering regression guards.
 *
 * The cold-load bug ("refreshing the dashboard appears to log the user out")
 * is fixed at the AuthProvider layer — see
 * __tests__/lib/auth/react/AuthProvider-cold-load.test.tsx — because the
 * dashboard's existing "lazy auth" contract is intentional: when the wallet
 * is connected but `user` is null (lazy auth, no API call yet), it renders
 * the content branch and lets downstream calls trigger a 401 → re-auth.
 *
 * These tests pin that contract so any future fix at the dashboard layer
 * can't silently change it.
 */

import { render, screen } from '@testing-library/react';
import Dashboard from '@/pages/dashboard';

const mockUseAuth = jest.fn();
jest.mock('@/components/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/hooks/useWalletAddress', () => ({
  useWalletAddress: () => {
    const { user, isLoading } = mockUseAuth();
    return {
      walletAddress: user?.walletAddress || null,
      isLoading,
    };
  },
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ query: {}, push: jest.fn() }),
}));

jest.mock('@/components/dashboard/EnhancedDashboard', () => {
  return function MockEnhancedDashboard() {
    return <div data-testid="enhanced-dashboard" />;
  };
});

jest.mock('@/components/auth/ConnectWalletEmbedded', () => {
  return function MockConnectWalletEmbedded() {
    return <div data-testid="connect-wallet-embedded" />;
  };
});

jest.mock('@/components/onboarding/DashboardTour', () => {
  return function MockDashboardTour() {
    return null;
  };
});

jest.mock('@/components/ui/ExpandableHash', () => {
  return function MockExpandableHash({ hash }: { hash: string }) {
    return <span data-testid="expandable-hash">{hash}</span>;
  };
});

function setAuthState(state: {
  user: any;
  isLoading: boolean;
  isConnected: boolean;
}) {
  mockUseAuth.mockReturnValue(state);
}

const SKELETON_PULSE_CLASS = 'animate-pulse';

function rendersLoadingSkeleton(container: HTMLElement) {
  return container.querySelectorAll(`.${SKELETON_PULSE_CLASS}`).length > 0;
}

function rendersConnectPrompt() {
  return screen.queryByTestId('connect-wallet-embedded') !== null;
}

function rendersDashboardContent() {
  return screen.queryByTestId('enhanced-dashboard') !== null;
}

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('Dashboard regression guards', () => {
  it('renders the loading skeleton while auth is initializing (isLoading=true)', () => {
    setAuthState({ user: null, isLoading: true, isConnected: false });
    const { container } = render(<Dashboard />);
    expect(rendersLoadingSkeleton(container)).toBe(true);
    expect(rendersConnectPrompt()).toBe(false);
    expect(rendersDashboardContent()).toBe(false);
  });

  it('renders the connect prompt when not loading and not connected', () => {
    setAuthState({ user: null, isLoading: false, isConnected: false });
    render(<Dashboard />);
    expect(rendersConnectPrompt()).toBe(true);
    expect(rendersDashboardContent()).toBe(false);
    expect(
      screen.getByText(/Connect your wallet to continue/i)
    ).toBeInTheDocument();
  });

  it('renders dashboard content when connected with a populated user', () => {
    setAuthState({
      user: {
        email: 'alice@example.com',
        walletAddress: '0xabcdef0123456789',
      },
      isLoading: false,
      isConnected: true,
    });
    render(<Dashboard />);
    expect(rendersDashboardContent()).toBe(true);
    expect(rendersConnectPrompt()).toBe(false);
  });

  it('renders dashboard content with @username when user has one', () => {
    setAuthState({
      user: {
        email: 'alice@example.com',
        username: 'alice',
        walletAddress: '0xabcdef0123456789',
      },
      isLoading: false,
      isConnected: true,
    });
    render(<Dashboard />);
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('keeps the lazy-auth contract: renders content when wallet connected but user is null', () => {
    // Lazy auth: don't block rendering on user data. The first protected API
    // call will 401 and trigger re-auth via fetchWithAuth. This is the
    // existing intentional contract — see AuthProvider's "LAZY AUTH" comment.
    setAuthState({ user: null, isLoading: false, isConnected: true });
    render(<Dashboard />);
    expect(rendersDashboardContent()).toBe(true);
    expect(rendersConnectPrompt()).toBe(false);
  });

  it('still renders the loading skeleton when isLoading is true even if user is populated', () => {
    setAuthState({
      user: {
        email: 'alice@example.com',
        walletAddress: '0xabcdef0123456789',
      },
      isLoading: true,
      isConnected: true,
    });
    const { container } = render(<Dashboard />);
    expect(rendersLoadingSkeleton(container)).toBe(true);
    expect(rendersDashboardContent()).toBe(false);
    expect(rendersConnectPrompt()).toBe(false);
  });
});
