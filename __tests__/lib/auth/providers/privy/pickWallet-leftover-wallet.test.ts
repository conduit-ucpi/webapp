/**
 * THE BUG THIS PINS (dev, 11 Nov 2026): "the approval always hangs on the first attempt".
 *
 *   1. Someone signs in with a browser wallet (0xc9D0…), then logs out. Privy's logout ends the
 *      session but leaves that wallet connected to the page.
 *   2. Someone signs in as a different account, whose wallet is Privy's embedded one (0x78A6…).
 *   3. On the next page load Privy lists the leftover browser wallet at once and the embedded
 *      wallet a moment later. pickWallet fell back to "whatever is first", so the page took the
 *      leftover as the user's: its balance, its nonce (460), its gas estimate.
 *   4. The embedded wallet then signed that transaction. A transaction from 0x78A6 with nonce 460
 *      is accepted and never confirms. Privy waited three minutes for a receipt; the page hung.
 *
 * Fixed in three places, each pinned below or beside this file:
 *   - pickWallet only ever names a wallet that belongs to the account signed in (here);
 *   - logout lets go of browser wallets (here);
 *   - AuthManager follows a provider whose address changes (AuthManager-async-provider-restore);
 *   - a transaction built for one address is never signed by another (withTransactionPrompt).
 */
jest.mock('@privy-io/react-auth', () => ({}));

import { logoutAndDisconnect, pickWallet } from '@/lib/auth/providers/privy/PrivyHost';

const LEFTOVER = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
const EMBEDDED = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
const OTHER = '0xD36698991EF328275c8F9598A33B2378D7ecE183';

const wallet = (address: string, walletClientType = 'metamask') =>
  ({ address, walletClientType, disconnect: jest.fn() }) as any;
const account = (primary: string | undefined, linked: string[] = primary ? [primary] : []) =>
  ({
    wallet: primary ? { address: primary } : undefined,
    linkedAccounts: [
      { type: 'email', address: 'someone@example.com' },
      ...linked.map((address) => ({ type: 'wallet', address })),
    ],
  }) as any;

describe('pickWallet', () => {
  describe("a browser wallet left over from someone else's session", () => {
    const user = account(EMBEDDED);

    it('is not the user\'s wallet while their own has not loaded yet: there is no wallet, and the page waits', () => {
      expect(pickWallet(user, [wallet(LEFTOVER)])).toBeNull();
    });

    it("is passed over for the user's own wallet once that has loaded, wherever it sits in the list", () => {
      const own = wallet(EMBEDDED, 'privy');
      expect(pickWallet(user, [wallet(LEFTOVER), own])).toBe(own);
      expect(pickWallet(user, [own, wallet(LEFTOVER)])).toBe(own);
    });

    it('never becomes the answer at any point of a page load', () => {
      const own = wallet(EMBEDDED, 'privy');
      const asPrivyLoads = [[], [wallet(LEFTOVER)], [wallet(LEFTOVER), own]];
      const picked = asPrivyLoads.map((wallets) => pickWallet(user, wallets)?.address ?? null);
      expect(picked).toEqual([null, null, EMBEDDED]);
      expect(picked).not.toContain(LEFTOVER);
    });
  });

  it('takes the account\'s primary wallet, matching addresses whatever their case', () => {
    const own = wallet(EMBEDDED.toLowerCase(), 'privy');
    expect(pickWallet(account(EMBEDDED.toUpperCase().replace('0X', '0x')), [own])).toBe(own);
  });

  it('takes the browser wallet of someone who signed in with it', () => {
    const own = wallet(LEFTOVER);
    expect(pickWallet(account(LEFTOVER), [own])).toBe(own);
  });

  it("falls back among the account's own wallets only: embedded first, then any other of theirs", () => {
    const embedded = wallet(EMBEDDED, 'privy');
    const linked = wallet(OTHER);
    // The primary is not connected; both of these are the account's, and the leftover is not.
    const user = account('0x1111111111111111111111111111111111111111', [EMBEDDED, OTHER]);
    expect(pickWallet(user, [wallet(LEFTOVER), linked, embedded])).toBe(embedded);
    expect(pickWallet(user, [wallet(LEFTOVER), linked])).toBe(linked);
  });

  it('names no wallet for nobody, or for an account with none connected', () => {
    expect(pickWallet(null, [wallet(LEFTOVER)])).toBeNull();
    expect(pickWallet(account(EMBEDDED), [])).toBeNull();
    expect(pickWallet(account(undefined, []), [wallet(LEFTOVER)])).toBeNull();
  });
});

describe('logging out', () => {
  it('lets go of every browser wallet, then ends the session', async () => {
    const browser = wallet(LEFTOVER);
    const another = wallet(OTHER, 'coinbase_wallet');
    const order: string[] = [];
    browser.disconnect.mockImplementation(() => order.push('browser wallet'));
    another.disconnect.mockImplementation(() => order.push('another wallet'));
    const logout = jest.fn(async () => {
      order.push('logout');
    });

    await logoutAndDisconnect([browser, another], logout);

    expect(order).toEqual(['browser wallet', 'another wallet', 'logout']);
  });

  it("leaves Privy's own embedded wallet to Privy", async () => {
    const embedded = wallet(EMBEDDED, 'privy');
    await logoutAndDisconnect([embedded], jest.fn(async () => {}));
    expect(embedded.disconnect).not.toHaveBeenCalled();
  });

  it('still signs out when a wallet refuses to be disconnected', async () => {
    const stubborn = wallet(LEFTOVER);
    stubborn.disconnect.mockImplementation(() => {
      throw new Error('not supported');
    });
    const logout = jest.fn(async () => {});

    await expect(logoutAndDisconnect([stubborn], logout)).resolves.toBeUndefined();
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
