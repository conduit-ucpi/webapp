/**
 * Where the consent cookie may be kept. A page framed by a partner's site is a third party there:
 * a `SameSite=Lax` cookie is refused, the visitor's Accept is forgotten, and the purchase made in
 * that frame reaches GA with no client id — which is to say, not at all.
 */

process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST000000';
const { cookieScope, writeConsent } = require('@/lib/consent');

export {};

describe('lib/consent cookieScope', () => {
  it('is partitioned and SameSite=None inside a frame over https', () => {
    expect(cookieScope(true, true)).toBe('; SameSite=None; Secure; Partitioned');
  });

  it('stays Lax on our own site, so returning visitors keep the one cookie they have', () => {
    expect(cookieScope(false, true)).toBe('; SameSite=Lax; Secure');
    expect(cookieScope(false, false)).toBe('; SameSite=Lax');
  });

  it('never asks for Secure over plain http, framed or not', () => {
    expect(cookieScope(true, false)).toBe('; SameSite=Lax');
  });

  it('writes the consent cookie with the scope of the page it is on', () => {
    const written: string[] = [];
    const spy = jest.spyOn(document, 'cookie', 'set').mockImplementation((v) => void written.push(v));
    try {
      writeConsent('granted');
    } finally {
      spy.mockRestore();
    }
    // jsdom is unframed, over http.
    expect(written).toEqual([`cookie_consent=granted; Max-Age=${60 * 60 * 24 * 182}; Path=/; SameSite=Lax`]);
  });
});
