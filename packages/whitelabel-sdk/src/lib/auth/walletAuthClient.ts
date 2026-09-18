import { apiFetch } from '@/lib/apiFetch';

/**
 * Proving wallet ownership to our backend. Three calls, and nothing provider-specific.
 *
 * ⚠️ THIS IS THE WHOLE AUTH CONTRACT, AND IT IS NOT REOWN-SHAPED. The backend takes
 *    `{ message, signature }`, recovers the address from the signature, and issues a session.
 *    It has no idea which library produced either, and it does not need one — any holder of a
 *    private key can satisfy it.
 *
 *    That matters because AppKit's SIWX classes look like the auth system and are not. They are
 *    adapters: AppKit insists on driving the session lifecycle, so `BackendSIWXVerifier`,
 *    `BackendSIWXMessenger` and `BackendSIWXStorage` exist to let it call these three functions.
 *    A second provider does not need any of them — it signs, and calls these directly.
 *
 * Keeping the calls here rather than inside those adapters is what makes that true in practice
 * rather than in principle. Before, swapping providers meant reading three AppKit subclasses to
 * find out what the backend actually wanted.
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
