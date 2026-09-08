/**
 * The RPC endpoint escrow verification reads through — fixed at build time.
 *
 * This closes the last circular path. Verification reads bytecode and terms
 * from the chain rather than asking the API, but Web3Service builds its RPC
 * client from `config.rpcUrl`, which /api/config supplies. A compromised API
 * could therefore hand back an RPC endpoint it controls, have that endpoint
 * report whatever bytecode and terms it liked, and both checks would pass. The
 * verification would be reading the attacker's answer through the attacker's
 * pipe.
 *
 * So verification does NOT use the application's RPC client. It builds its own
 * from NEXT_PUBLIC_RPC_URL, inlined at build time and unreachable by the API.
 *
 * Everything else in the app may keep using the runtime-configured RPC: a
 * malicious endpoint there degrades or misleads the UI, which is bad, but it
 * cannot forge the check that gates a signature.
 */
import { RpcClient } from '@/lib/rpc/RpcClient';
import type { EscrowReader } from './verifyEscrow';

/** Build-time RPC URL. Empty means verification cannot run and must refuse. */
export function verificationRpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL || '';
}

let cached: { url: string; client: RpcClient } | null = null;

/**
 * Reader for verification, or null when no build-time RPC is configured.
 * Callers must treat null as a refusal, never as permission to fall back to the
 * application's RPC — that fallback would reintroduce exactly the hole this
 * exists to close.
 */
export function getVerificationReader(): EscrowReader | null {
  const url = verificationRpcUrl();
  if (!url) return null;
  if (!cached || cached.url !== url) {
    cached = { url, client: new RpcClient(url) };
  }
  return cached.client;
}

/** Test seam. */
export function __resetVerificationReader(): void {
  cached = null;
}
