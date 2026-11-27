import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MyApiAccessCodePage from '@/pages/myAPIAccessCode';
import { useAuth } from '@/components/auth';
import { I18nProvider } from '@conduit-ucpi/whitelabel-sdk';

jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/auth/WalletChoiceCards', () => function WalletChoiceCards() {
  return <div data-testid="wallet-choice-cards" />;
});
jest.mock('@/lib/apiFetch', () => ({ apiFetch: jest.fn(), API_BASE: 'https://api.example.test' }));
jest.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const respond = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const CURRENT = { prefix: 'sd_access_Ab3x', termsVersion: '972353c6d417', createdAt: 1790000000, expiresAt: 1797776000 };
const CREATED = { ...CURRENT, prefix: 'sd_access_Zz9q', key: 'sd_access_Zz9qTHE_FULL_SECRET' };

let authenticatedFetch: jest.Mock;

function signedIn() {
  authenticatedFetch = jest.fn();
  mockUseAuth.mockReturnValue({ isLoading: false, isConnected: true, user: { walletAddress: '0xabc' }, authenticatedFetch } as any);
}

beforeEach(signedIn);

describe('/myAPIAccessCode', () => {
  it('signs a signed-out visitor in first, as /dashboard does', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isConnected: false, user: null, authenticatedFetch: jest.fn() } as any);

    render(<MyApiAccessCodePage />);

    expect(screen.getByTestId('wallet-choice-cards')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Get your free access code');
  });

  it('offers a first code to someone who has none', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: null }));

    render(<MyApiAccessCodePage />);

    expect(await screen.findByText("You don't have a code yet.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get my access code' })).toBeInTheDocument();
  });

  it('gets a code, shows it once, and puts it in the commands to copy', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: null }));
    render(<MyApiAccessCodePage />);
    await screen.findByText("You don't have a code yet.");

    authenticatedFetch.mockResolvedValueOnce(respond(201, CREATED));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Get my access code' }));
    });

    expect(authenticatedFetch).toHaveBeenLastCalledWith('/api/user/api-access-key', { method: 'POST', body: '{}' });
    const shown = screen.getByTestId('new-access-code');
    expect(shown).toHaveTextContent('sd_access_Zz9qTHE_FULL_SECRET');
    expect(screen.getByText(/claude mcp add --transport http stabledrop https:\/\/api\.example\.test\/api\/ap2\/mcp/)).toHaveTextContent(
      'Authorization: Bearer sd_access_Zz9qTHE_FULL_SECRET'
    );

    // Claude.ai and ChatGPT connectors only take an address, so the code goes in it.
    expect(screen.getByText('https://api.example.test/api/ap2/mcp?code=sd_access_Zz9qTHE_FULL_SECRET')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "I've copied it" }));
    expect(screen.queryByTestId('new-access-code')).not.toBeInTheDocument();
    expect(screen.queryByText(/THE_FULL_SECRET/)).not.toBeInTheDocument();
  });

  it('shows the current code without its secret, and that a new one replaces it', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: CURRENT }));

    render(<MyApiAccessCodePage />);

    expect(await screen.findByText(/Starts sd_access_Ab3x…/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get a new code' })).toBeInTheDocument();
    expect(screen.getByText('Getting a new code stops your current one working.')).toBeInTheDocument();
  });

  it('links the step-by-step guide to the reference section on access codes', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: null }));
    render(<MyApiAccessCodePage />);
    await screen.findByText("You don't have a code yet.");

    expect(screen.getByRole('link', { name: 'Step-by-step guide' })).toHaveAttribute(
      'href',
      'https://api.example.test/api/ap2/settle/doc?redoc#section/Get-your-free-access-code'
    );
  });

  /** authenticatedFetch signs them in again on the route's 401; still refused, it throws. */
  it('says to sign in again when the terms changed and signing in did not fix it', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: CURRENT }));
    render(<MyApiAccessCodePage />);
    await screen.findByText(/Starts sd_access_Ab3x…/);

    const expired = Object.assign(new Error('Backend JWT expired'), { name: 'AuthenticationExpiredError' });
    authenticatedFetch.mockRejectedValueOnce(expired);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Get a new code' }));
    });

    expect(screen.getByTestId('access-code-error')).toHaveTextContent('Our terms have been updated');
  });

  it('says to finish setting up the account when there is no wallet', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: null }));
    render(<MyApiAccessCodePage />);
    await screen.findByText("You don't have a code yet.");

    authenticatedFetch.mockResolvedValueOnce(respond(400, { error: 'Your account has no wallet yet' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Get my access code' }));
    });

    expect(screen.getByTestId('access-code-error')).toHaveTextContent('needs a wallet');
  });

  it('stops the current code working after a confirmation', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: CURRENT }));
    render(<MyApiAccessCodePage />);
    await screen.findByText(/Starts sd_access_Ab3x…/);

    fireEvent.click(screen.getByRole('button', { name: 'Stop this code working' }));
    authenticatedFetch.mockResolvedValueOnce(respond(204));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, stop it' }));
    });

    expect(authenticatedFetch).toHaveBeenLastCalledWith('/api/user/api-access-key', { method: 'DELETE' });
    await waitFor(() => expect(screen.getByText("You don't have a code yet.")).toBeInTheDocument());
  });

  it('renders in Spanish for a Spanish locale', async () => {
    authenticatedFetch.mockResolvedValueOnce(respond(200, { current: null }));
    render(
      <I18nProvider brandLocale="es">
        <MyApiAccessCodePage />
      </I18nProvider>
    );

    expect(await screen.findByText('Todavía no tienes un código.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu código de acceso gratis');
    expect(screen.getByRole('button', { name: 'Obtener mi código de acceso' })).toBeInTheDocument();
  });
});
