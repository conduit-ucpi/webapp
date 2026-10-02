import { render, screen, fireEvent, act } from '@testing-library/react';
import CookieConsent from '@/components/consent/CookieConsent';
import { CONSENT_COOKIE, GA_MEASUREMENT_ID, openConsentSettings, readConsent } from '@/lib/consent';

jest.mock('next/link', () => ({ children, href }: any) => <a href={href}>{children}</a>);

const gaScripts = () => document.querySelectorAll('script[src*="googletagmanager.com"]');

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

describe('CookieConsent', () => {
  beforeEach(() => {
    clearCookies();
    document.head.innerHTML = '';
  });

  it('shows the banner and loads no analytics before a choice is made', () => {
    render(<CookieConsent />);
    expect(screen.getByRole('dialog', { name: 'Cookie consent' })).toBeInTheDocument();
    expect(gaScripts()).toHaveLength(0);
  });

  it('remembers a rejection and does not load analytics or ask again', () => {
    const { unmount } = render(<CookieConsent />);
    fireEvent.click(screen.getByText('Reject'));
    expect(readConsent()).toBe('denied');
    expect(gaScripts()).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();

    unmount();
    render(<CookieConsent />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('loads analytics on accept and does not ask again', () => {
    const { unmount } = render(<CookieConsent />);
    fireEvent.click(screen.getByText('Accept'));
    expect(readConsent()).toBe('granted');
    expect(gaScripts()).toHaveLength(1);

    unmount();
    render(<CookieConsent />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reopens from Cookie settings, and withdrawing consent disables GA and deletes its cookies', () => {
    document.cookie = `${CONSENT_COOKIE}=granted; Path=/`;
    document.cookie = '_ga=GA1.1.123; Path=/';
    render(<CookieConsent />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => openConsentSettings());
    fireEvent.click(screen.getByText('Reject'));

    expect(readConsent()).toBe('denied');
    expect(window[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
    expect(document.cookie).not.toContain('_ga=');
  });
});
