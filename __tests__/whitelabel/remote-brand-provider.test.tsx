/**
 * BrandProvider reading brands from the white-label service.
 *
 * The bundled registry is only a snapshot. What these pin is what a visitor
 * sees in each state the service can be in — and, above all, that a partner's
 * payer is never shown our brand while theirs is on its way, and that the tree
 * below (auth, wallet) is hidden rather than remounted while it is.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { BrandProvider, useBrand, useBrandSource, BrandRegistry, BrandFetchResult } from '@conduit-ucpi/whitelabel-sdk';

const SNAPSHOT: BrandRegistry = {
  stabledrop: { id: 'stabledrop', name: 'Stabledrop.me' },
  cobro: { id: 'cobro', name: 'COBRO (snapshot)' },
};

let mounts = 0;
function Probe() {
  const brand = useBrand();
  const source = useBrandSource();
  useEffect(() => {
    mounts++;
  }, []);
  return (
    <span data-testid="brand">
      {brand.name}|{source}|{brand.assets.logo ?? ''}
    </span>
  );
}

function renderAt(url: string, fetchBrandImpl: (id: string) => Promise<BrandFetchResult>) {
  window.history.replaceState({}, '', url);
  return render(
    <BrandProvider brands={SNAPSHOT} defaultBrandId="stabledrop" remote fetchBrandImpl={fetchBrandImpl}>
      <Probe />
    </BrandProvider>
  );
}

const text = () => screen.getByTestId('brand').textContent;
const wrapper = () => screen.getByTestId('brand').closest('[data-wl-brand]') as HTMLElement;
const found = (id: string, name: string, extra = {}): BrandFetchResult => ({
  status: 'found',
  version: 1,
  config: { id, name, ...extra },
});

describe('BrandProvider (remote)', () => {
  beforeEach(() => {
    mounts = 0;
  });
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('replaces the snapshot with the live record', async () => {
    renderAt('/create?b=cobro', async (id) => found(id, 'COBRO (live)'));
    await waitFor(() => expect(text()).toBe('COBRO (live)|query|'));
  });

  it('fetches a partner the snapshot does not hold, hiding the page until it arrives', async () => {
    let resolve!: (r: BrandFetchResult) => void;
    renderAt('/create?b=newpartner', (id) =>
      id === 'newpartner' ? new Promise((r) => (resolve = r)) : Promise.resolve(found(id, 'Stabledrop.me'))
    );

    await waitFor(() => expect(wrapper().style.visibility).toBe('hidden'));
    expect(wrapper().getAttribute('aria-busy')).toBe('true');

    resolve(found('newpartner', 'New Partner', { assets: { logo: '65f0c0ffee0000000000abcd' } }));
    await waitFor(() => expect(text()).toMatch(/^New Partner\|query\|.*\/api\/brands\/newpartner\/assets\/65f0c0ffee0000000000abcd$/));
    expect(wrapper().style.visibility).toBe('');
    // Hidden, never unmounted: providers below keep their state.
    expect(mounts).toBe(1);
  });

  it('falls back to our brand when the service does not know the id', async () => {
    const calls: string[] = [];
    renderAt('/create?b=forged', async (id) => {
      calls.push(id);
      return id === 'forged' ? { status: 'missing' } : found(id, 'Stabledrop.me');
    });
    // Our brand is also what shows before the fetch, so wait for the answer to have come back.
    await waitFor(() => expect(calls).toContain('forged'));
    await waitFor(() => {
      expect(text()).toBe('Stabledrop.me|default|');
      expect(wrapper().style.visibility).toBe('');
    });
  });

  it('keeps a shipped brand when the service answers 404 (not deployed, or mis-routed)', async () => {
    const calls: string[] = [];
    renderAt('/create?b=cobro', async (id) => {
      calls.push(id);
      return { status: 'missing' };
    });
    await waitFor(() => expect(calls).toContain('cobro'));
    await waitFor(() => expect(text()).toBe('COBRO (snapshot)|query|'));
  });

  it('keeps the snapshot when the service is unreachable', async () => {
    renderAt('/create?b=cobro', async () => ({ status: 'unreachable' }));
    await waitFor(() => expect(text()).toBe('COBRO (snapshot)|query|'));
  });

  it('shows our brand, not a blank page, for an unknown id while the service is down', async () => {
    const calls: string[] = [];
    renderAt('/create?b=newpartner', async (id) => {
      calls.push(id);
      return { status: 'unreachable' };
    });
    await waitFor(() => expect(calls).toContain('newpartner'));
    await waitFor(() => {
      expect(text()).toBe('Stabledrop.me|default|');
      expect(wrapper().style.visibility).toBe('');
    });
  });

  it("asks only for the partner's record on a partner's page", async () => {
    const calls: string[] = [];
    renderAt('/create?b=cobro', async (id) => {
      calls.push(id);
      return found(id, 'COBRO (live)');
    });
    await waitFor(() => expect(text()).toBe('COBRO (live)|query|'));
    expect(calls).toEqual(['cobro']);
  });

  it('never requests an id that is not a well-formed slug', async () => {
    const calls: string[] = [];
    renderAt('/create?b=../../admin', async (id) => {
      calls.push(id);
      return found(id, 'Stabledrop.me');
    });
    await waitFor(() => expect(text()).toBe('Stabledrop.me|default|'));
    expect(calls).toEqual(['stabledrop']);
  });
});
