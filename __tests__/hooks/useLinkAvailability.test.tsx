/**
 * Link sells in the United States only. A known country elsewhere greys it out, and can be
 * overruled; an unknown country never does.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLinkAvailability } from '@/hooks/useLinkAvailability';
import { visitorCountry } from '@/lib/visitorCountry';

jest.mock('@/lib/visitorCountry');

describe('useLinkAvailability', () => {
  it('is available in the United States', async () => {
    (visitorCountry as jest.Mock).mockResolvedValue('US');
    const { result } = renderHook(() => useLinkAvailability());
    await act(async () => {});
    expect(result.current.unavailable).toBe(false);
  });

  it('is unavailable in a known country elsewhere, named for the buyer, until overruled', async () => {
    (visitorCountry as jest.Mock).mockResolvedValue('GB');
    const { result } = renderHook(() => useLinkAvailability());
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.countryName).toMatch(/United Kingdom|GB/);
    act(() => result.current.overrule());
    expect(result.current.unavailable).toBe(false);
  });

  it('stays available when the country is unknown', async () => {
    (visitorCountry as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useLinkAvailability());
    await act(async () => {});
    expect(result.current.unavailable).toBe(false);
  });
});
