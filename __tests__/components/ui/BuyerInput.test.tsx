import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import BuyerInput from '@/components/ui/BuyerInput';
import { useConfig } from '@/components/auth/ConfigProvider';

// Characterization tests for BuyerInput's user-search fetch behavior.
// Written BEFORE extracting the /api/users/search call into a hook, to lock
// down the current observable behavior (endpoint, query encoding, response
// parsing, error handling) so the refactor cannot silently change it.

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

global.fetch = jest.fn();

describe('BuyerInput — Farcaster user search fetch behavior', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: Neynar key present so Farcaster search is enabled.
    (useConfig as jest.Mock).mockReturnValue({ config: { neynarApiKey: 'test-key' } });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls /api/users/search with the URL-encoded query for a Farcaster-style input', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ users: [] }),
    });

    render(<BuyerInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search Farcaster user or enter email');

    // A Farcaster handle starting with "@": treated as a username search (not an
    // email), and the "@" must be URL-encoded in the query string. Note that a
    // value containing a space would NOT trigger a search (isFarcasterSearch
    // only matches /^[a-zA-Z0-9_-]+$/ or strings containing "@" that aren't
    // emails), so we use "@alice" to exercise both search-triggering and encoding.
    await userEvent.type(input, '@alice');

    // Debounce is 300ms; wait for the fetch.
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/users/search?q=${encodeURIComponent('@alice')}`
        );
      },
      { timeout: 2000 }
    );
  });

  it('renders search results from the response data.users array', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [
          {
            fid: 1,
            username: 'alice',
            displayName: 'Alice Example',
            pfpUrl: '',
            followerCount: 100,
            verified: true,
          },
        ],
      }),
    });

    render(<BuyerInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search Farcaster user or enter email');
    await userEvent.type(input, 'alice');

    await waitFor(
      () => {
        expect(screen.getByText('Alice Example')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('does not call the search endpoint when the input is an email', async () => {
    render(<BuyerInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search Farcaster user or enter email');
    await userEvent.type(input, 'buyer@example.com');

    // Give the debounce time to (not) fire.
    await new Promise((r) => setTimeout(r, 500));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not call the search endpoint when no Neynar key is configured', async () => {
    (useConfig as jest.Mock).mockReturnValue({ config: { neynarApiKey: undefined } });

    render(<BuyerInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search Farcaster user or enter email');
    await userEvent.type(input, 'alice');

    await new Promise((r) => setTimeout(r, 500));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('clears results without throwing when the search request fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<BuyerInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search Farcaster user or enter email');
    await userEvent.type(input, 'alice');

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
    // No dropdown options should render after a failed fetch.
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('treats a non-ok response as empty results', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ users: [{ fid: 9, username: 'ghost', displayName: 'Ghost' }] }),
    });

    render(<BuyerInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search Farcaster user or enter email');
    await userEvent.type(input, 'ghost');

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
    expect(screen.queryByText('Ghost')).not.toBeInTheDocument();
  });
});
