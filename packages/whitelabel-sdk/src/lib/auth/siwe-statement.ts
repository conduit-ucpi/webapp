/**
 * Where the Terms of Service are published. Absolute, because the app is also served from
 * merchant embeds and partner domains, and the terms are Stabledrop's wherever it runs.
 */
export const TERMS_URL = 'https://stabledrop.me/terms-of-service/';

/**
 * Shared SIWE message statement shown in wallet signature prompts.
 *
 * EIP-4361 puts this between the `<domain> wants you to sign in...` header
 * and the URI/Version/Chain ID/Nonce/Issued At fields.
 *
 * ⚠️ THE SIGNATURE IS THE ACCEPTANCE OF THE TERMS. user-service refuses a sign-in whose
 *    statement does not carry TERMS_URL, and records the signed message as the proof. Change
 *    the wording freely; drop the URL and every sign-in fails.
 *
 * Kept to one line on purpose: EIP-4361 forbids a newline in the statement, and wallets
 * truncate long ones — the URL has to survive that intact.
 */
export const SIWE_STATEMENT = `Sign to accept the Stabledrop Terms of Service (${TERMS_URL}).`;

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

${SIWE_STATEMENT}

Wallet: ${params.address}
Issued: ${params.timestamp}
Nonce: ${params.nonce}`;
}
