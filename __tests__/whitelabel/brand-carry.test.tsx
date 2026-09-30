/**
 * A partner's brand carried across in-app navigation.
 *
 * The brand lives in the URL, but not every in-app link remembers `?b=`. So once
 * a partner is showing, a client-side move to a page that names no brand keeps
 * that partner and writes it into the new URL — the whole app stays theirs, and a
 * refresh does too. A fresh load of a clean URL is still ours.
 */
import { act, render, screen } from '@testing-library/react';
import { BrandProvider, useBrand, useBrandSource, BrandRegistry } from '@conduit-ucpi/whitelabel-sdk';

const mockHandlers = new Set<() => void>();
const mockReplace = jest.fn();
jest.mock('next/router', () => ({
  __esModule: true,
  default: {
    events: {
      on: (_: string, h: () => void) => mockHandlers.add(h),
      off: (_: string, h: () => void) => mockHandlers.delete(h),
    },
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

const REGISTRY: BrandRegistry = {
  stabledrop: { id: 'stabledrop', name: 'Stabledrop.me' },
  cobro: { id: 'cobro', name: 'COBRO' },
  'escrow-me': { id: 'escrow-me', name: 'Escrow Me' },
};

function Probe() {
  return <span data-testid="brand">{useBrand().name}|{useBrandSource()}</span>;
}
const text = () => screen.getByTestId('brand').textContent;

/** Load a page, as a fresh visit would. */
function loadAt(url: string) {
  window.history.replaceState({}, '', url);
  return render(
    <BrandProvider brands={REGISTRY} defaultBrandId="stabledrop">
      <Probe />
    </BrandProvider>
  );
}

/** A client-side navigation: the URL changes, then Next reports the route change. */
function navigate(url: string) {
  window.history.pushState({}, '', url);
  act(() => mockHandlers.forEach((h) => h()));
}

beforeEach(() => {
  mockReplace.mockClear();
  mockHandlers.clear();
});
afterEach(() => window.history.replaceState({}, '', '/'));

describe('carrying a partner brand across in-app navigation', () => {
  it('keeps the partner on a page whose link dropped ?b=, and puts it back in the URL', () => {
    loadAt('/dashboard?b=cobro');
    expect(text()).toBe('COBRO|query');

    navigate('/wallet#funds');

    expect(text()).toBe('COBRO|query'); // no flash of ours
    expect(mockReplace).toHaveBeenCalledWith('/wallet?b=cobro#funds', undefined, { shallow: true, scroll: false });

    navigate('/wallet?b=cobro#funds'); // the replace landing
    expect(text()).toBe('COBRO|query');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('keeps existing query parameters when it adds the brand', () => {
    loadAt('/dashboard?b=cobro');
    navigate('/contract-pay?contractId=42');
    expect(mockReplace).toHaveBeenCalledWith('/contract-pay?contractId=42&b=cobro', undefined, { shallow: true, scroll: false });
  });

  it('switches when a link names another brand', () => {
    loadAt('/dashboard?b=cobro');
    navigate('/create?b=escrow-me');
    expect(text()).toBe('Escrow Me|query');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('carries nothing from our own brand', () => {
    loadAt('/dashboard');
    navigate('/create');
    expect(text()).toBe('Stabledrop.me|default');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('is not sticky: a fresh load of a clean URL is ours', () => {
    const first = loadAt('/dashboard?b=cobro');
    first.unmount();
    loadAt('/dashboard');
    expect(text()).toBe('Stabledrop.me|default');
  });
});
