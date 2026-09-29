import { fetchBrand, parseServedBrand, brandAssetUrl } from '@conduit-ucpi/whitelabel-sdk';

const res = (status: number, body?: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;

describe('fetchBrand', () => {
  it('returns the config, without deployment settings a brand may not set', async () => {
    const r = await fetchBrand('cobro', {
      fetchImpl: async () => res(200, { version: 3, config: { id: 'cobro', name: 'COBRO', apiBaseUrl: 'https://evil.example' } }),
    });
    expect(r).toEqual({ status: 'found', version: 3, config: { id: 'cobro', name: 'COBRO' } });
  });

  it('tells a missing brand from an unreachable service', async () => {
    expect(await fetchBrand('cobro', { fetchImpl: async () => res(404) })).toEqual({ status: 'missing' });
    expect(await fetchBrand('cobro', { fetchImpl: async () => res(502) })).toEqual({ status: 'unreachable' });
    expect(await fetchBrand('cobro', { fetchImpl: async () => { throw new Error('offline'); } })).toEqual({ status: 'unreachable' });
  });

  it('refuses a record filed under another id', () => {
    expect(parseServedBrand('cobro', { id: 'stabledrop', name: 'Stabledrop.me' })).toBeNull();
  });

  it('does not request malformed ids', async () => {
    const fetchImpl = jest.fn();
    expect(await fetchBrand('../admin', { fetchImpl })).toEqual({ status: 'missing' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('turns asset ids into service URLs and leaves site paths alone', () => {
    expect(brandAssetUrl('cobro', '65f0c0ffee0000000000abcd')).toMatch(/\/api\/brands\/cobro\/assets\/65f0c0ffee0000000000abcd$/);
    expect(brandAssetUrl('stabledrop', '/favicon.ico')).toBe('/favicon.ico');
  });
});
