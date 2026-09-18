import { apiFetch } from '@/lib/apiFetch';
import { siweStatement } from '@/lib/auth/siwe-statement';

/**
 * Proving wallet ownership to our backend: nonce → message → (the provider signs) → verify.
 *
 * ⚠️ THIS IS THE WHOLE AUTH CONTRACT, AND IT IS NOT REOWN-SHAPED. The backend takes
 *    `{ message, signature }`, recovers the address from the signature, and issues a session.
 *    It has no idea which library produced either, and it does not need one — any holder of a
 *    private key can satisfy it.
 *
 *    The one thing a provider brings is the signature. Everything else — where the nonce comes
 *    from, what the message must look like, where it goes — is here, so a second provider reads
 *    this file and nothing else.
 *
 * ⚠️ WHAT THIS IS NOT: AppKit's SIWX. `EmbeddedOnlySIWX` runs Reown's OWN authentication for
 *    embedded wallets, so that Reown records how the user connected and hands us a verified
 *    email. It does not create our session. Our session is created here, by the provider's
 *    `requestAuthentication()`. A first version of this estate had a second SIWX config that
 *    tried to route AppKit's session lifecycle through these calls; it was never wired in and
 *    has been deleted.
 */

/** A nonce the backend will accept once, binding a signature to this login attempt. */
export async function requestAuthNonce(): Promise<string> {
  const response = await apiFetch('/api/auth/siwe/nonce');
  if (!response.ok) {
    throw new Error(`Failed to get nonce: ${response.status}`);
  }
  const { nonce } = await response.json();
  return nonce;
}

/**
 * The EIP-4361 message the wallet is asked to sign.
 *
 * ⚠️ USER-SERVICE PARSES THIS, AND WALLETS RENDER THEIR FRIENDLY SIGN-IN VIEW ONLY WHILE IT
 *    PARSES. The header line, the field names and their order are fixed by the spec; the
 *    statement is the one line that is ours (see siwe-statement.ts). Every provider must
 *    produce exactly this, which is why it is built here and not in an adapter.
 *
 * `chainId` is the app's configured chain, never the wallet's current network: the session is
 * for the chain the app runs on, whatever the wallet happens to be pointed at.
 */
export function buildSiweMessage(params: {
  address: string;
  chainId: number;
  nonce: string;
  issuedAt?: string;
}): string {
  const domain = window.location.host;
  const uri = window.location.origin;
  const issuedAt = params.issuedAt ?? new Date().toISOString();

  return `${domain} wants you to sign in with your Ethereum account:
${params.address}

${siweStatement(params.chainId)}

URI: ${uri}
Version: 1
Chain ID: ${params.chainId}
Nonce: ${params.nonce}
Issued At: ${issuedAt}`;
}

/**
 * Hand a signed message to the backend, which recovers the signer and opens a session.
 *
 * Returns whether it was accepted rather than throwing: a refused signature is an ordinary
 * outcome of asking somebody to sign, not an exceptional one, and every caller has to branch
 * on it anyway.
 */
export async function verifyAuthSignature(message: string, signature: string): Promise<boolean> {
  const response = await apiFetch('/api/auth/siwe/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature })
  });
  return response.ok;
}

/**
 * Clear the session cookie.
 *
 * ⚠️ THROWS RATHER THAN SWALLOWING, because its callers already decide what a failed sign-out
 *    means and they do not agree: one rethrows so AppKit sees it, another carries on having
 *    cleared local state. Deciding here would silently change one of them, and a refactor that
 *    alters behaviour while claiming to move code is the worst kind.
 *
 * `credentials: 'include'` is not passed: apiFetch defaults to it, because the session cookie
 * has to travel.
 */
export async function signOutOfBackend(): Promise<void> {
  await apiFetch('/api/auth/siwe/signout', { method: 'POST' });
}
