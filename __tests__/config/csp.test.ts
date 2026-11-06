/**
 * The policy reaches the live site only through public/_headers, so the file has to match the source,
 * and has to be one Cloudflare will accept.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CSP_HEADER, THEME_INIT_SCRIPT, boxCsp, cloudflareHeadersFile } from '@/config/csp';

const root = process.cwd();
const headersFile = readFileSync(join(root, 'public', '_headers'), 'utf8');

describe('Content-Security-Policy', () => {
  it('public/_headers is what config/csp.js generates (run scripts/write-csp-headers.js)', () => {
    expect(headersFile).toBe(cloudflareHeadersFile());
  });

  it('fits Cloudflare Pages\' 2,000 character limit on a header value', () => {
    const value = headersFile.split('\n').find((line) => line.includes(CSP_HEADER))!.split(': ')[1];
    expect(value.length).toBeLessThanOrEqual(2000);
  });

  it('allows the theme script by its hash', () => {
    const hash = createHash('sha256').update(THEME_INIT_SCRIPT).digest('base64');
    expect(boxCsp()).toContain(`'sha256-${hash}'`);
    expect(headersFile).toContain(`'sha256-${hash}'`);
  });

  it('never allows arbitrary script', () => {
    const scriptSrc = headersFile.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(scriptSrc).not.toMatch(/'unsafe-inline'|'unsafe-eval'|https:( |$)|\*/);
  });

  it('includes everything Privy lists as required', () => {
    [
      'https://auth.privy.io',
      'https://verify.walletconnect.com',
      'https://verify.walletconnect.org',
      'wss://relay.walletconnect.com',
      'wss://relay.walletconnect.org',
      'wss://www.walletlink.org',
      'https://*.rpc.privy.systems',
      'https://explorer-api.walletconnect.com',
      'https://challenges.cloudflare.com',
    ].forEach((source) => expect(headersFile).toContain(source));
  });

  it('lets the merchants that embed us frame the live site', () => {
    const frameAncestors = headersFile.split('; ').find((d) => d.startsWith('frame-ancestors'))!;
    [
      'https://escrow-me.com',
      'https://www.escrow-me.com',
      'https://pay.co.ve',
      'https://payment.co.ve',
      'https://payments.co.ve',
      'https://payment.com.ve',
      'https://payments.com.ve',
      'https://cobro.co.ve',
      'https://cobro.com.ve',
    ].forEach((origin) =>
      expect(frameAncestors.split(' ')).toContain(origin)
    );
  });

  it('leaves frame-ancestors on the box to next.config.js', () => {
    expect(boxCsp()).not.toContain('frame-ancestors');
    expect(headersFile).toContain('frame-ancestors');
  });
});
