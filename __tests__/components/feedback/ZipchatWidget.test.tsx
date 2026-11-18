import { render, waitFor } from '@testing-library/react';
import { usePartnerBrand } from '@conduit-ucpi/whitelabel-sdk';
import ZipchatWidget, { CLEARANCE_VAR, ZIPCHAT_SCRIPT_URL, clearanceFor } from '@/components/feedback/ZipchatWidget';

jest.mock('@conduit-ucpi/whitelabel-sdk', () => ({ usePartnerBrand: jest.fn() }));
const mockPartnerBrand = usePartnerBrand as jest.MockedFunction<typeof usePartnerBrand>;

const zipchatScripts = () => document.querySelectorAll(`script[src="${ZIPCHAT_SCRIPT_URL}"]`);

beforeEach(() => {
  document.body.innerHTML = '';
  mockPartnerBrand.mockReturnValue(null);
});

it('loads the widget once on our own pages', () => {
  render(<ZipchatWidget />);
  render(<ZipchatWidget />);
  expect(zipchatScripts()).toHaveLength(1);
});

it('does not load on a partner page', () => {
  mockPartnerBrand.mockReturnValue({ name: 'Partner' } as ReturnType<typeof usePartnerBrand>);
  render(<ZipchatWidget />);
  expect(zipchatScripts()).toHaveLength(0);
});

it('does not load inside another site\'s frame', () => {
  const self = jest.spyOn(window, 'self', 'get').mockReturnValue({} as Window & typeof globalThis);
  render(<ZipchatWidget />);
  expect(zipchatScripts()).toHaveLength(0);
  self.mockRestore();
});

describe('clearance above the chat launcher', () => {
  // jsdom's window is 1024 x 768.
  const launcherAt = (rect: Partial<DOMRect>) => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ width: 68, height: 68, ...rect } as DOMRect);
    return el;
  };

  it('lifts our buttons above a launcher in the bottom right, with a gap', () => {
    expect(clearanceFor(launcherAt({ top: 680, bottom: 748, right: 1004 }))).toBe(768 - 680 + 12);
  });

  it('needs none for a launcher on the left, at the top, hidden or absent', () => {
    expect(clearanceFor(launcherAt({ top: 680, bottom: 748, right: 88 }))).toBe(0);
    expect(clearanceFor(launcherAt({ top: 20, bottom: 88, right: 1004 }))).toBe(0);
    expect(clearanceFor(launcherAt({ width: 0, height: 0, top: 680, bottom: 748, right: 1004 }))).toBe(0);
    expect(clearanceFor(null)).toBe(0);
  });

  it('publishes the clearance once the launcher appears, and clears it on unmount', async () => {
    const { unmount } = render(<ZipchatWidget />);
    const host = document.createElement('div');
    host.id = 'zipchat-shadow-host';
    const shadow = host.attachShadow({ mode: 'open' });
    const container = launcherAt({ top: 680, bottom: 748, right: 1004 });
    container.id = 'widget-chat-container';
    shadow.appendChild(container);
    document.body.appendChild(host);

    await waitFor(() => expect(document.documentElement.style.getPropertyValue(CLEARANCE_VAR)).toBe('100px'));
    unmount();
    expect(document.documentElement.style.getPropertyValue(CLEARANCE_VAR)).toBe('');
  });
});
