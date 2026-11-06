/**
 * The pixel must load without an inline script, which the Content-Security-Policy does not allow, and
 * must keep the calls made before Reddit's script arrives.
 */
import { initRedditPixel } from '@/lib/tracking';

describe('initRedditPixel', () => {
  afterEach(() => {
    delete (window as any).rdt;
    document.head.innerHTML = '';
  });

  it('loads Reddit\'s script by URL, with no inline script', () => {
    initRedditPixel('a2_test');
    const scripts = Array.from(document.head.querySelectorAll('script'));
    expect(scripts.map((s) => s.src)).toEqual(['https://www.redditstatic.com/ads/pixel.js']);
    expect(scripts[0].textContent).toBe('');
  });

  it('queues init and the page visit until the script takes over', () => {
    initRedditPixel('a2_test');
    const rdt = (window as any).rdt;
    expect(rdt.callQueue).toEqual([
      ['init', 'a2_test', { optOut: false, useDecimalCurrencyValues: true }],
      ['track', 'PageVisit'],
    ]);

    rdt.sendEvent = jest.fn();
    rdt('track', 'SignUp');
    expect(rdt.sendEvent).toHaveBeenCalledWith('track', 'SignUp');
    expect(rdt.callQueue).toHaveLength(2);
  });
});
