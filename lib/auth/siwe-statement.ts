/**
 * Shared SIWE message statement shown in wallet signature prompts.
 *
 * EIP-4361 puts this between the `<domain> wants you to sign in...` header
 * and the URI/Version/Chain ID/Nonce/Issued At fields. Keep it short and
 * reassuring — many users see "signature request" and think funds will move.
 */
export const SIWE_STATEMENT = 'Sign this message to prove you own this wallet. Signing does NOT transfer funds';
