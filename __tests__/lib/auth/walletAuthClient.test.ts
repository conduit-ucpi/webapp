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
      issuedAt: '2026-09-18T10:00:00.000Z'
    });

    expect(message).toBe(
      `localhost wants you to sign in with your Ethereum account:
0xc9D0602A87E55116F633b1A1F95D083Eb115f942

No funds move and no payments are approved. Signing only proves you own this wallet on Base.

URI: http://localhost
Version: 1
Chain ID: 8453
Nonce: abc123
Issued At: 2026-09-18T10:00:00.000Z`
    );
  });

  it('names no chain it does not recognise', () => {
    const message = buildSiweMessage({ address: '0xabc', chainId: 12345, nonce: 'n' });

    expect(message).toContain('Signing only proves you own this wallet.\n');
    expect(message).toContain('Chain ID: 12345');
  });
});
