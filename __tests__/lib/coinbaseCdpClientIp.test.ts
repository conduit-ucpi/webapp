// The module under test pulls in the CDP SDK, which ships as ESM that jest will not parse. We
// only need the pure address reader out of it, so the SDK is stubbed away.
jest.mock('@coinbase/cdp-sdk/auth', () => ({ generateJwt: jest.fn() }));

import { extractClientIp } from '@/lib/server/coinbaseCdp';
import type { NextApiRequest } from 'next';

/**
 * The client-address reader, tested where it lives rather than through whichever route happens
 * to use it. The onramp no longer sends one (Coinbase's own example omits it, and a
 * second-hand address that disagrees with what Coinbase observes is worse than none); the
 * offramp still does, so the logic stays and stays pinned.
 *
 * Behind Caddy the socket address is the proxy, so the forwarded headers have to come first —
 * a detail that is invisible in development and wrong only in production.
 */
const req = (headers: Record<string, string | string[]>, socket?: string) =>
  ({ headers, socket: socket ? { remoteAddress: socket } : undefined } as unknown as NextApiRequest);

describe('extractClientIp', () => {
  it('takes the first entry of x-forwarded-for, which is the originating client', () => {
    // Caddy appends as it forwards, so the chain reads "client, proxy".
    expect(extractClientIp(req({ 'x-forwarded-for': '203.0.113.42, 10.0.0.1' }))).toBe('203.0.113.42');
  });

  it('falls back to x-real-ip', () => {
    expect(extractClientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('falls back to the socket address last', () => {
    expect(extractClientIp(req({}, '192.0.2.5'))).toBe('192.0.2.5');
  });

  it('strips the IPv4-mapped IPv6 prefix, which Coinbase would not recognise', () => {
    expect(extractClientIp(req({}, '::ffff:192.0.2.5'))).toBe('192.0.2.5');
  });

  it('trims whitespace around a forwarded address', () => {
    expect(extractClientIp(req({ 'x-forwarded-for': '  203.0.113.42  , 10.0.0.1' }))).toBe('203.0.113.42');
  });

  it('returns null when there is nothing to read', () => {
    expect(extractClientIp(req({}))).toBeNull();
  });
});
