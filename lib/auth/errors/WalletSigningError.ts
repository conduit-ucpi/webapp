/**
 * Error thrown when the connected wallet failed to produce a SIWE signature.
 *
 * Most commonly this happens when an embedded social-login wallet (Reown +
 * Magic) can't reach `tee.express.magiclabs.com` — e.g. ISP/DNS-level filtering
 * (BT Web Protect), Pi-hole/NextDNS, ad-blocker extensions, or a Magic outage.
 *
 * The user-facing message should explain that wallet signing failed and
 * suggest trying a different network or DNS, since the underlying console
 * error (`Magic RPC Error: -32603 Error signing`) is opaque to end users.
 */
export class WalletSigningError extends Error {
  readonly cause?: unknown;

  constructor(message: string = 'Could not sign with wallet', cause?: unknown) {
    super(message);
    this.name = 'WalletSigningError';
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalletSigningError);
    }
  }
}
