import { termsUrl } from '@/lib/auth/siwe-statement';
import { buildSiweMessage } from '@/lib/auth/walletAuthClient';

/**
 * ⚠️ USER-SERVICE PARSES THIS MESSAGE, and wallets show their friendly "sign in" view only
 *    while it parses. The literal below is the exact text the Reown adapter built inline before
 *    the construction moved into the contract — pinned here so a provider swap, or a well-meant
 *    tidy, cannot change a byte of it without this saying so.
 */
describe('buildSiweMessage', () => {
  it('produces the EIP-4361 message user-service parses, byte for byte', () => {
    // jsdom serves the test at http://localhost, which is what the header and URI lines carry.
    const message = buildSiweMessage({
      address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
      chainId: 8453,
      nonce: 'abc123',
      serviceLink: 'https://stabledrop.me',
      issuedAt: '2026-09-18T10:00:00.000Z'
    });

    expect(message).toBe(
      `localhost wants you to sign in with your Ethereum account:
0xc9D0602A87E55116F633b1A1F95D083Eb115f942

Sign to accept the Stabledrop Terms of Service (https://stabledrop.me/terms-of-service/).

URI: http://localhost
Version: 1
Chain ID: 8453
Nonce: abc123
Issued At: 2026-09-18T10:00:00.000Z`
    );
  });

  it("names this deployment's own terms, from the site config serves, path and all ignored", () => {
    // Test's serviceLink has carried /dashboard; the terms are at the site root regardless.
    const message = buildSiweMessage({
      address: '0xabc',
      chainId: 84532,
      nonce: 'n',
      serviceLink: 'https://test.conduit-ucpi.com/dashboard'
    });

    expect(message.split('\n')[3]).toBe(
      'Sign to accept the Stabledrop Terms of Service (https://test.conduit-ucpi.com/terms-of-service/).'
    );
  });

  it('names the terms version config serves, in the exact form user-service reads back', () => {
    const message = buildSiweMessage({
      address: '0xabc',
      chainId: 8453,
      nonce: 'n',
      serviceLink: 'https://stabledrop.me',
      termsVersion: '1988a9f34b7a'
    });

    expect(message.split('\n')[3]).toBe(
      'Sign to accept the Stabledrop Terms of Service (https://stabledrop.me/terms-of-service/, version 1988a9f34b7a).'
    );
  });

  it('falls back to the site the app is running on when config names none', () => {
    // jsdom runs at http://localhost.
    expect(termsUrl(undefined)).toBe('http://localhost/terms-of-service/');
    expect(termsUrl('not a url')).toBe('http://localhost/terms-of-service/');
  });
});
