/**
 * Shared SIWE message statement shown in wallet signature prompts.
 *
 * EIP-4361 puts this between the `<domain> wants you to sign in...` header
 * and the URI/Version/Chain ID/Nonce/Issued At fields. Keep it short and
 * reassuring — many users see "signature request" and think funds will move.
 *
 * Name neither the app nor the chain here. The header line above it already
 * renders window.location.host, which is whatever domain served the app —
 * a merchant embed, a preview deploy, localhost — so a hardcoded product name
 * would contradict it. The chain likewise varies (mainnet, Base, Sepolia,
 * Base Sepolia) and is already stated in the Chain ID field.
 *
 * Kept to one line on purpose: wallets truncate long statements, and this one
 * has to survive that intact.
 */
export const SIWE_STATEMENT = 'Signing proves you own this wallet. It cannot move funds or approve payments.';

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
