import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ApiKeysPage from '@/pages/api-keys';
import { useAuth } from '@/components/auth';
import { apiFetch } from '@/lib/apiFetch';
import { I18nProvider, useBrand } from '@conduit-ucpi/whitelabel-sdk';

jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/auth/WalletChoiceCards', () => function WalletChoiceCards() {
  return <div data-testid="wallet-choice-cards" />;
});
jest.mock('@/lib/apiFetch', () => ({ apiFetch: jest.fn(), API_BASE: '' }));
jest.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
// The page is rendered without BrandProvider, where the real useBrand() throws.
jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({
  ...jest.requireActual('@conduit-ucpi/whitelabel-sdk'),
  useBrand: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseBrand = useBrand as jest.MockedFunction<typeof useBrand>;
const onBrand = (id: string) => mockUseBrand.mockReturnValue({ id } as ReturnType<typeof useBrand>);
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const respond = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const EXISTING = { id: 'k1', label: 'Shop backend', prefix: 'sd_live_Ab3x', createdAt: 1759276800, lastUsedAt: null, brandId: null };
const CREATED = { id: 'k2', label: 'WhatsApp bot', prefix: 'sd_live_Zz9q', createdAt: 1759363200, lastUsedAt: null, brandId: null, key: 'sd_live_Zz9qTHE_FULL_SECRET' };

beforeEach(() => {
  mockApiFetch.mockReset();
  onBrand('stabledrop');
  mockUseAuth.mockReturnValue({ isLoading: false, isConnected: true, user: { walletAddress: '0xabc' } } as any);
});

async function renderWithKeys(keys: unknown[] = [EXISTING]) {
  mockApiFetch.mockResolvedValueOnce(respond(200, keys));
  render(<ApiKeysPage />);
  await screen.findByText(keys.length ? 'Shop backend' : 'You have no API keys yet.');
}

describe('/api-keys', () => {
  it('renders in Spanish for a Spanish locale', async () => {
    mockApiFetch.mockResolvedValueOnce(respond(200, [EXISTING]));
    render(
      <I18nProvider brandLocale="es">
        <ApiKeysPage />
      </I18nProvider>
    );

    await screen.findByText('Shop backend');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Claves de API');
    expect(screen.getByText('Adónde van tus pagos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /retirar tus tokens/i })).toHaveAttribute('href', '/wallet');
    expect(screen.getByRole('button', { name: 'Crear clave' })).toBeInTheDocument();
    expect(screen.getByText(/Último uso nunca/)).toBeInTheDocument();
  });

  it('shows the wallet payments go to, copies it, and links to the wallet page', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await renderWithKeys();

    const panel = screen.getByTestId('payout-wallet');
    expect(within(panel).getByText('0xabc')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Copy address' }));
    });
    expect(writeText).toHaveBeenCalledWith('0xabc');
    expect(within(panel).getByRole('link', { name: /withdraw your tokens/i })).toHaveAttribute('href', '/wallet');
  });

  it('says to finish setting up the account when there is no wallet yet', async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isConnected: true, user: { walletAddress: null } } as any);
    await renderWithKeys();

    const panel = screen.getByTestId('payout-wallet');
    expect(within(panel).getByText(/no wallet yet/i)).toBeInTheDocument();
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in and loads nothing', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isConnected: false, user: null } as any);
    render(<ApiKeysPage />);
    expect(screen.getByTestId('wallet-choice-cards')).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('lists keys with their prefix, and "never" for a key not yet used', async () => {
    await renderWithKeys();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/user/api-keys');
    const row = screen.getByTestId('api-key-row');
    expect(within(row).getByText('sd_live_Ab3x…')).toBeInTheDocument();
    expect(row).toHaveTextContent('Last used never');
  });

  it('reads createdAt and lastUsedAt as Unix seconds', async () => {
    const used = 1759363200;
    await renderWithKeys([{ ...EXISTING, lastUsedAt: used }]);
    const fmt = (s: number) => new Date(s * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const row = screen.getByTestId('api-key-row');
    expect(row).toHaveTextContent(`Created ${fmt(EXISTING.createdAt)}`);
    expect(row).toHaveTextContent(`Last used ${fmt(used)}`);
    // Seconds, not millis: a 1970 date would mean the value was taken as milliseconds.
    expect(row).not.toHaveTextContent('1970');
  });

  it('shows the full key once after creating it, and drops it on dismiss', async () => {
    await renderWithKeys();
    mockApiFetch.mockResolvedValueOnce(respond(201, CREATED));

    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: '  WhatsApp bot ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    const box = await screen.findByTestId('new-api-key');
    expect(within(box).getByText(CREATED.key)).toBeInTheDocument();
    expect(box).toHaveTextContent("Copy this key now. You won't be able to see it again.");
    expect(mockApiFetch).toHaveBeenLastCalledWith('/api/user/api-keys', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ label: 'WhatsApp bot' }),
    }));
    // Listed alongside the others, by prefix only.
    expect(screen.getAllByTestId('api-key-row')).toHaveLength(2);
    expect(screen.getByText('sd_live_Zz9q…')).toBeInTheDocument();

    fireEvent.click(within(box).getByRole('button', { name: /hide the key/i }));

    expect(screen.queryByTestId('new-api-key')).toBeNull();
    expect(screen.queryByText(CREATED.key)).toBeNull();
  });

  it('records the partner brand the key is made under, and lists it on the key', async () => {
    onBrand('cobro');
    await renderWithKeys();
    expect(screen.getByTestId('create-brand-note')).toHaveTextContent('carry the COBRO branding');
    mockApiFetch.mockResolvedValueOnce(respond(201, { ...CREATED, brandId: 'cobro' }));

    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: 'WhatsApp bot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    await screen.findByTestId('new-api-key');

    expect(mockApiFetch).toHaveBeenLastCalledWith('/api/user/api-keys', expect.objectContaining({
      body: JSON.stringify({ label: 'WhatsApp bot', brand: 'cobro' }),
    }));
    const [created, existing] = screen.getAllByTestId('api-key-row');
    expect(within(created).getByTestId('api-key-brand')).toHaveTextContent('COBRO');
    expect(within(existing).queryByTestId('api-key-brand')).toBeNull();
  });

  it.each(['stabledrop', 'conduit-ucpi', 'usdcbay'])('sends no brand on our own site (%s)', async (id) => {
    onBrand(id);
    await renderWithKeys();
    expect(screen.queryByTestId('create-brand-note')).toBeNull();
    mockApiFetch.mockResolvedValueOnce(respond(201, CREATED));

    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: 'WhatsApp bot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    await screen.findByTestId('new-api-key');

    expect(mockApiFetch).toHaveBeenLastCalledWith('/api/user/api-keys', expect.objectContaining({
      body: JSON.stringify({ label: 'WhatsApp bot' }),
    }));
  });

  it('badges a listed key with its brand, by the id when the brand is not bundled', async () => {
    await renderWithKeys([
      { ...EXISTING, id: 'k1', brandId: 'escrow-me' },
      { ...EXISTING, id: 'k3', label: 'Other', brandId: 'new-partner' },
    ]);
    const badges = screen.getAllByTestId('api-key-brand');
    expect(badges.map((b) => b.textContent)).toEqual(['Escrow Me', 'new-partner']);
    expect(badges[0]).toHaveAttribute('title', 'Payment links made with this key carry the Escrow Me branding');
  });

  it('copies the new key to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await renderWithKeys();
    mockApiFetch.mockResolvedValueOnce(respond(201, CREATED));
    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: 'WhatsApp bot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    const box = await screen.findByTestId('new-api-key');

    await act(async () => {
      fireEvent.click(within(box).getByRole('button', { name: 'Copy key' }));
    });

    expect(writeText).toHaveBeenCalledWith(CREATED.key);
  });

  it.each([
    [409, { error: 'Too many keys' }, 'You already have 10 keys. Revoke one first.'],
    [400, { error: 'User has no wallet yet' }, 'Finish setting up your account first'],
    [400, { error: 'Label must be 1-60 characters' }, 'Label must be 1-60 characters (400)'],
  ])('explains a %s from userservice', async (status, body, message) => {
    await renderWithKeys();
    mockApiFetch.mockResolvedValueOnce(respond(status, body));
    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: 'One more' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    expect(await screen.findByText(new RegExp(message.replace(/[.()]/g, '\\$&')))).toBeInTheDocument();
    expect(screen.queryByTestId('new-api-key')).toBeNull();
  });

  it('revokes only after confirming, with DELETE on that key', async () => {
    await renderWithKeys();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(mockApiFetch).toHaveBeenCalledTimes(1); // just the list
    expect(screen.getByText('Revoke this key?')).toBeInTheDocument();

    mockApiFetch.mockResolvedValueOnce(respond(204));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, revoke' }));

    await waitFor(() => expect(screen.queryByText('Shop backend')).toBeNull());
    expect(mockApiFetch).toHaveBeenLastCalledWith('/api/user/api-keys/k1', { method: 'DELETE' });
  });

  it('cancelling the confirm step revokes nothing', async () => {
    await renderWithKeys();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('shows how to use a key against the API host, runnable as copied', async () => {
    await renderWithKeys([]);
    const sample = screen.getByText(/curl -X POST http:\/\/localhost\/api\/ap2\/request/);
    expect(sample.textContent).toContain('Authorization: Bearer $STABLEDROP_API_KEY');
    expect(sample.textContent).not.toContain('...');
    const body = sample.textContent!.match(/-d '(.*)'$/)![1];
    expect(JSON.parse(body)).toEqual({ amount: 20000000, expiry_timestamp: 0, description: 'Order #123' });
    expect(screen.getByText('STABLEDROP_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('pay_link')).toBeInTheDocument();
  });

  it('links to the full API reference, carrying a partner brand and Spanish', async () => {
    const reference = () => screen.getByRole('link', { name: /Full API reference|Referencia completa de la API/ });

    await renderWithKeys([]);
    expect(reference()).toHaveAttribute('href', `${window.location.origin}/api/ap2/settle/doc`);
    expect(reference()).toHaveAttribute('target', '_blank');
    expect(reference()).toHaveAttribute('rel', 'noopener');
    cleanup();

    onBrand('cobro');
    await renderWithKeys([]);
    expect(reference()).toHaveAttribute('href', `${window.location.origin}/api/ap2/settle/doc?b=cobro`);
    cleanup();

    mockApiFetch.mockResolvedValueOnce(respond(200, []));
    render(
      <I18nProvider brandLocale="es">
        <ApiKeysPage />
      </I18nProvider>
    );
    await screen.findByText('Aún no tienes claves de API.');
    expect(reference()).toHaveTextContent('Referencia completa de la API');
    expect(reference()).toHaveAttribute('href', `${window.location.origin}/api/ap2/settle/doc?b=cobro&lang=es`);
  });

  it('puts a just-created key into the example, and takes it out again when the key is hidden', async () => {
    await renderWithKeys([]);
    mockApiFetch.mockResolvedValueOnce(respond(201, CREATED));
    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: 'WhatsApp bot' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    });

    const sample = () => screen.getByText(/curl -X POST/).textContent!;
    expect(sample()).toContain(`Authorization: Bearer ${CREATED.key}`);
    expect(screen.getByTestId('example-key-note')).toHaveTextContent(/contains your new key/);

    fireEvent.click(screen.getByRole('button', { name: /hide the key/ }));
    expect(sample()).not.toContain(CREATED.key);
    expect(sample()).toContain('$STABLEDROP_API_KEY');
  });
});
