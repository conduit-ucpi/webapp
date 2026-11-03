import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FeedbackButton from '@/components/feedback/FeedbackButton';
import { useAuth } from '@/components/auth';

jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const fetchMock = jest.fn();
const signedIn = (user: unknown) =>
  mockUseAuth.mockReturnValue({ user, authenticatedFetch: fetchMock } as unknown as ReturnType<typeof useAuth>);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sent: true }) });
  signedIn(null);
});

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Send us feedback' }));

it('opens a form and sends the email, message and page, with no account fields', async () => {
  render(<FeedbackButton />);
  open();
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: '  It broke  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));

  await screen.findByText(/your message is on its way/);
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe('/api/in-app-feedback');
  expect(JSON.parse(init.body)).toEqual({ contactEmail: 'ana@example.com', message: 'It broke', pageUrl: window.location.href });
});

it('starts from the signed-in account email', () => {
  signedIn({ email: 'ana.account@example.com', walletAddress: '0xabc' });
  render(<FeedbackButton />);
  open();
  expect(screen.getByLabelText('Your email')).toHaveValue('ana.account@example.com');
});

it('sends nothing until there is an email and a message', () => {
  render(<FeedbackButton />);
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(screen.getByText('Enter your email address, so we can reply.')).toBeInTheDocument();
  expect(screen.getByText('Write a message.')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows the server's reason when sending fails", async () => {
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Too many messages from here. Try again in an hour.' }) });
  render(<FeedbackButton />);
  open();
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many messages'));
});
