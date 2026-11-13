import { setTermsPartnerName, termsUrl } from '@/lib/auth/siwe-statement';
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

  describe("on a partner's page", () => {
    afterEach(() => setTermsPartnerName(null));

    const statement = () =>
      buildSiweMessage({
        address: '0xabc',
        chainId: 8453,
        nonce: 'n',
        serviceLink: 'https://stabledrop.me',
        termsVersion: '1988a9f34b7a'
      }).split('\n')[3];

    it('names the terms as the partner\'s, provided by Stabledrop, with the address and version untouched', () => {
      setTermsPartnerName('COBRO');

      expect(statement()).toBe(
        'Sign to accept the COBRO Terms of Service, provided by Stabledrop (https://stabledrop.me/terms-of-service/, version 1988a9f34b7a).'
      );
      // What user-service looks for: the terms address, then the version, exactly as before.
      expect(statement()).toContain('(https://stabledrop.me/terms-of-service/, version 1988a9f34b7a)');
    });

    it('goes back to our own wording when the partner is cleared', () => {
      setTermsPartnerName('COBRO');
      setTermsPartnerName(null);

      expect(statement()).toBe(
        'Sign to accept the Stabledrop Terms of Service (https://stabledrop.me/terms-of-service/, version 1988a9f34b7a).'
      );
    });

    it('cleans a name before it goes into signed text', () => {
      // A line break would make the message invalid, and brackets could fake a second version.
      setTermsPartnerName('Pagos\n(https://evil.example/terms-of-service/, version deadbeef)');

      const line = statement();
      expect(line).toBe(
        'Sign to accept the Pagos httpsevil.exampleterms-of-service Terms of Service, provided by Stabledrop ' +
          '(https://stabledrop.me/terms-of-service/, version 1988a9f34b7a).'
      );
      expect(line.match(/\(/g)).toHaveLength(1);
      expect(line).toContain('(https://stabledrop.me/terms-of-service/, version 1988a9f34b7a).');
    });

    it('treats a blank name as no partner', () => {
      setTermsPartnerName('   ');
      expect(statement()).toContain('the Stabledrop Terms of Service (');
    });
  });

  it('falls back to the site the app is running on when config names none', () => {
    // jsdom runs at http://localhost.
    expect(termsUrl(undefined)).toBe('http://localhost/terms-of-service/');
    expect(termsUrl('not a url')).toBe('http://localhost/terms-of-service/');
  });
});
