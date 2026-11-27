import { render, screen } from '@testing-library/react';
import SdReportingPage from '@/pages/sd-reporting';
import { useAuth } from '@/components/auth';

jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/auth/ConnectWalletEmbedded', () => () => <div data-testid="connect-wallet-embedded" />);
jest.mock('@/components/ui/LoadingSpinner', () => () => <div data-testid="loading-spinner" />);
jest.mock('@/components/admin/AdminDatabaseList', () => (props: { endpoint?: string; onContractSelect?: unknown }) => (
  <div data-testid="database-list" data-endpoint={props.endpoint} data-selectable={String(Boolean(props.onContractSelect))} />
));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const as = (user: unknown, isLoading = false) => mockUseAuth.mockReturnValue({ user, isLoading } as any);

describe('/sd-reporting', () => {
  it.each(['sd-reporting', 'admin'])('shows %s users the database list, read through its own route, and nothing to click into', (userType) => {
    as({ email: 'reports@example.com', userType });
    render(<SdReportingPage />);
    const list = screen.getByTestId('database-list');
    expect(list).toHaveAttribute('data-endpoint', '/api/sd-reporting/contracts');
    expect(list).toHaveAttribute('data-selectable', 'false');
  });

  it.each(['normal', 'user'])('denies a %s user', (userType) => {
    as({ email: 'someone@example.com', userType });
    render(<SdReportingPage />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByTestId('database-list')).toBeNull();
  });

  it('asks a signed-out visitor to sign in', () => {
    as(null);
    render(<SdReportingPage />);
    expect(screen.getByTestId('connect-wallet-embedded')).toBeInTheDocument();
    expect(screen.queryByTestId('database-list')).toBeNull();
  });

  it('waits while the session loads', () => {
    as(null, true);
    render(<SdReportingPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
