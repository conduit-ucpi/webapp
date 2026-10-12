/**
 * The single check to run before letting a user sign against an API-supplied
 * escrow address. All three parts are required, and none is sufficient alone:
 *
 *   1. bytecode — is this our contract?          (verifyEscrowClone)
 *   2. factory  — did OUR factory create it?     (verifyEscrowFactory)
 *   3. terms    — is it our deal?                (verifyEscrowTerms)
 *
 * A compromised API defeats any one on its own. Pass only the bytecode check
 * and it can deploy a genuine clone with the seller swapped for its own address.
 * Pass only the terms check and it can point at a contract with the right terms
 * but arbitrary logic. Pass bytecode and terms but not factory, and it can have
 * its own factory initialize a genuine clone with the right buyer, seller and
 * amount but a partner and fee our signer never approved. Order matters too:
 * bytecode first, because reading anything from a contract we have not
 * established is ours is meaningless.
 *
 * Fails closed throughout — a read error is a refusal, never a pass.
 */
import { verifyEscrowAddress, CloneVerdict, CodeReader } from './verifyEscrowClone';
import { expectedEscrowFactory, verifyFactory } from './verifyEscrowFactory';
import { getVerificationReader } from './verificationRpc';
import {
  verifyEscrowTerms,
  ExpectedTerms,
  OnChainTerms,
  TermsVerdict,
} from './verifyEscrowTerms';

export interface EscrowReader extends CodeReader {
  getEscrowFactory(address: string): Promise<string>;
  getEscrowTerms(address: string): Promise<OnChainTerms>;
}

export type EscrowVerdict =
  | { ok: true }
  | { ok: false; stage: 'bytecode' | 'factory' | 'terms'; detail: string };

/**
 * `reader` defaults to the build-time verification RPC. Pass one only in tests —
 * handing in the application's RPC client would reintroduce the circularity
 * described in verificationRpc.ts, since the API chooses that endpoint.
 */
export async function verifyEscrow(
  address: string,
  expected: ExpectedTerms,
  reader?: EscrowReader
): Promise<EscrowVerdict> {
  const rpc = reader ?? getVerificationReader();
  if (!rpc) {
    return {
      ok: false,
      stage: 'bytecode',
      detail:
        'No build-time RPC endpoint is configured (NEXT_PUBLIC_RPC_URL), so the ' +
        'contract cannot be independently verified. Refusing to proceed.',
    };
  }

  const code: CloneVerdict = await verifyEscrowAddress(address, rpc);
  if (!code.ok) return { ok: false, stage: 'bytecode', detail: code.detail };

  let createdBy: string | null = null;
  try {
    createdBy = await rpc.getEscrowFactory(address);
  } catch {
    createdBy = null;
  }
  const factory = verifyFactory(createdBy, expectedEscrowFactory());
  if (!factory.ok) return { ok: false, stage: 'factory', detail: factory.detail };

  let onChain: OnChainTerms;
  try {
    onChain = await rpc.getEscrowTerms(address);
  } catch (error: any) {
    return {
      ok: false,
      stage: 'terms',
      detail:
        `Could not read the deal terms from ${address}: ${error?.message || error}. ` +
        `Refusing to proceed without verification.`,
    };
  }

  const terms: TermsVerdict = verifyEscrowTerms(expected, onChain);
  if (!terms.ok) return { ok: false, stage: 'terms', detail: terms.detail };

  return { ok: true };
}
