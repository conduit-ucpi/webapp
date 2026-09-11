/**
 * Classify a sign-in / SIWX error into a user-actionable category and message.
 *
 * The most important case it catches is the silent Magic SDK failure when
 * Reown's embedded social-login wallet can't reach `tee.express.magiclabs.com`
 * — typically because the user's DNS, ad-blocker, ISP, or corporate firewall
 * is filtering magiclabs.com. Without classification this surfaces as a
 * generic "Authentication failed" with no hint that the user can fix it.
 *
 * Lives in its own tiny module (no Reown imports) so it can be unit-tested
 * without spinning up jsdom + the full AppKit / WalletConnect stack.
 */

export type AuthFailureKind = 'wallet-signing' | 'network' | 'unknown'

export interface AuthFailure {
  kind: AuthFailureKind
  message: string
  cause?: unknown
}

export function classifyAuthError(error: unknown): AuthFailure {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const lower = raw.toLowerCase()

  // Magic SDK signing failures (Reown embedded social-login wallets delegate
  // signing to tee.express.magiclabs.com — DNS/ad-blockers commonly break this)
  if (
    lower.includes('magic rpc error') ||
    lower.includes('error signing') ||
    lower.includes('magiclabs.com') ||
    lower.includes('-32603')
  ) {
    return {
      kind: 'wallet-signing',
      message:
        "Couldn't sign in with your wallet. Your network may be blocking " +
        'magiclabs.com (used by social-login wallets). Try a different ' +
        'network, disable ad blockers, or switch your DNS to 1.1.1.1.',
      cause: error,
    }
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('err_connection')
  ) {
    return {
      kind: 'network',
      message:
        'Network error while signing in. Check your connection and try again.',
      cause: error,
    }
  }

  return {
    kind: 'unknown',
    message: raw || 'Sign-in failed for an unknown reason.',
    cause: error,
  }
}
