/**
 * An email another account holds is refused, and asking again on every page load cannot change that.
 */
import { render, waitFor } from '@testing-library/react';
import EmailPromptManager from '@/components/auth/EmailPromptManager';
import { useAuth } from '@/components/auth/SimpleAuthProvider';
import { apiFetch } from '@/lib/apiFetch';

jest.mock('@/components/auth/SimpleAuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/apiFetch', () => ({ apiFetch: jest.fn() }));

const signedIn = (email = 'someone@example.com') =>
  (useAuth as jest.Mock).mockReturnValue({
    user: { userId: 'user-1', walletAddress: '0xabc' },
    isLoading: false,
    refreshUserData: jest.fn(),
    getProviderUserInfo: () => ({ email, authProvider: 'google' }),
  });
const answers = (status: number) => (apiFetch as jest.Mock).mockResolvedValue({ ok: status < 400, status });

describe('EmailPromptManager when the email is taken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  const loadPage = async () => {
    const { unmount } = render(<EmailPromptManager><div /></EmailPromptManager>);
    await waitFor(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    unmount();
  };

  it('stops asking after a 409', async () => {
    signedIn();
    answers(409);
    await loadPage();
    await loadPage();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('asks again for a different address', async () => {
    signedIn();
    answers(409);
    await loadPage();
    signedIn('other@example.com');
    await loadPage();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps trying after any other failure, which may pass', async () => {
    signedIn();
    answers(500);
    await loadPage();
    await loadPage();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
