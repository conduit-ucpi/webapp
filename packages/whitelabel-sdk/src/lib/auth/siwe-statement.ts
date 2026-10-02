/**
 * This deployment's Terms of Service: `<site>/terms-of-service/`, where the site is the
 * `serviceLink` /api/config serves — the same site user-service expects (its APP_BASE_URL), so
 * test signs test's terms and production signs production's.
 *
 * Only the origin is used: test's serviceLink has carried a `/dashboard` path. With no usable
 * link, the page the app is running on is the best guess at its own site.
 */
export function termsUrl(serviceLink?: string | null): string {
  let origin: string | null = null;
  try {
    if (serviceLink) origin = new URL(serviceLink).origin;
  } catch {
    origin = null;
  }
  if (!origin) origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return `${origin}/terms-of-service/`;
}

/**
 * The site the fallback signature message names, set once config is known (AuthManager does).
 * The SIWE path does not use this: it is handed the site explicitly, because user-service
 * refuses a sign-in that names the wrong one.
 */
let configuredServiceLink: string | null = null;

export function setTermsServiceLink(serviceLink: string | null | undefined): void {
  configuredServiceLink = serviceLink || null;
}

/**
 * The SIWE message statement shown in wallet signature prompts.
 *
 * EIP-4361 puts this between the `<domain> wants you to sign in...` header
 * and the URI/Version/Chain ID/Nonce/Issued At fields.
 *
 * ⚠️ THE SIGNATURE IS THE ACCEPTANCE OF THE TERMS. user-service refuses a sign-in whose
 *    statement does not carry its own site's termsUrl(), and records the signed message as
 *    the proof. Change the wording freely; drop the URL and every sign-in fails.
 *
 * `version` is the terms version from /api/config: the commit that last changed the terms page,
 * which the page also shows. user-service reads it back out of the signed statement and keeps
 * the first and latest acceptance of each version, so it must stay `version <hex>` exactly.
 * Absent (a build without git), the statement names none and user-service records it unversioned.
 *
 * Kept to one line on purpose: EIP-4361 forbids a newline in the statement, and wallets
 * truncate long ones — the URL has to survive that intact.
 */
export function siweStatement(terms: string, version?: string | null): string {
  return version
    ? `Sign to accept the Stabledrop Terms of Service (${terms}, version ${version}).`
    : `Sign to accept the Stabledrop Terms of Service (${terms}).`;
}

/**
 * Message signed to mint a `signature_auth` token (the fallback auth path used
 * when the SIWE route isn't taken — batched-connect failure, the Web3Service
 * path, Farcaster).
 *
 * Not EIP-4361: the user-service recovers the signer from this string exactly
 * as sent and never parses it, so the shape is ours to choose. It is kept
 * legible rather than machine-shaped because this is the prompt most likely to
 * be mistaken for a blind-signing attack.
 *
 * The address, timestamp and nonce stay in the signed text on purpose. The
 * backend currently checks the token's separate `timestamp` field, which the
 * signature does not cover — keeping them here is what would let it
 * cross-check the two later.
 */
export function buildAuthTokenMessage(params: {
  address: string;
  timestamp: number;
  nonce: string;
}): string {
  const domain = typeof window !== 'undefined' ? window.location.host : 'localhost';

  return `${domain}

${siweStatement(termsUrl(configuredServiceLink))}

Wallet: ${params.address}
Issued: ${params.timestamp}
Nonce: ${params.nonce}`;
}
