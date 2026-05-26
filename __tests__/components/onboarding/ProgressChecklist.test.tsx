import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import ProgressChecklist from '@/components/onboarding/ProgressChecklist';
import { useAuth } from '@/components/auth';
import { useRouter } from 'next/router';

// Characterization tests for ProgressChecklist's contracts-existence check.
// Written BEFORE extracting the /api/combined-contracts call into a hook.
// ProgressChecklist's use of the endpoint is DIFFERENT from ContractList's:
// it does NOT transform the payload, it only checks Array.isArray && length>0
// to drive the "create-contract" checklist item. This test locks that down so
// a shared hook cannot regress it.

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/utils/siteName', () => ({
  getSiteNameFromDomain: () => 'TestSite',
}));

jest.mock('@/components/onboarding/TransactionWalkthrough', () => {
  return function MockWalkthrough() {
    return <div data-testid="walkthrough" />;
  };
});

global.fetch = jest.fn();

describe('ProgressChecklist — combined-contracts existence check', () => {
  const mockUser = { walletAddress: '0xabc', email: 'test@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    // Ensure the checklist renders (not previously dismissed).
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('fetches /api/combined-contracts on mount when a user is present', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<ProgressChecklist />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/combined-contracts');
    });
  });

  it('does not fetch when there is no authenticated user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<ProgressChecklist />);

    await new Promise((r) => setTimeout(r, 100));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('marks "create-contract" complete when the endpoint returns a non-empty array', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ contract: { id: '1' } }],
    });

    render(<ProgressChecklist />);

    // Expand the (collapsed) checklist to reveal item titles.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const expandBtn = screen.getByLabelText('Expand');
    expandBtn.click();

    await waitFor(() => {
      const item = screen.getByText('Create Your First Payment Request');
      // When contracts exist, the item is treated as completed (line-through).
      const heading = item.closest('h4');
      expect(heading?.className).toContain('line-through');
    });
  });

  it('does not throw and leaves create-contract incomplete when the fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<ProgressChecklist />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const expandBtn = screen.getByLabelText('Expand');
    expandBtn.click();

    await waitFor(() => {
      const item = screen.getByText('Create Your First Payment Request');
      const heading = item.closest('h4');
      expect(heading?.className).not.toContain('line-through');
    });
  });

  it('treats a non-array response as "no contracts"', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'shape' }),
    });

    render(<ProgressChecklist />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const expandBtn = screen.getByLabelText('Expand');
    expandBtn.click();

    await waitFor(() => {
      const item = screen.getByText('Create Your First Payment Request');
      const heading = item.closest('h4');
      expect(heading?.className).not.toContain('line-through');
    });
  });
});
