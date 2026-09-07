/**
 * The single check to run before letting a user sign against an API-supplied
 * escrow address. Both halves are required, and neither is sufficient alone:
 *
 *   1. bytecode — is this our contract? (verifyEscrowClone)
 *   2. terms    — is it our deal?       (verifyEscrowTerms)
 *
 * A compromised API defeats either one on its own. Pass only the bytecode check
 * and it can deploy a genuine clone with the seller swapped for its own address.
 * Pass only the terms check and it can point at a contract with the right terms
 * but arbitrary logic. Order matters too: bytecode first, because reading terms
 * from a contract we have not established is ours is meaningless.
 *
 * Fails closed throughout — a read error is a refusal, never a pass.
 */
import { verifyEscrowAddress, CloneVerdict, CodeReader } from './verifyEscrowClone';
import {
  verifyEscrowTerms,
  ExpectedTerms,
  OnChainTerms,
  TermsVerdict,
} from './verifyEscrowTerms';

export interface EscrowReader extends CodeReader {
  getEscrowTerms(address: string): Promise<OnChainTerms>;
}

export type EscrowVerdict =
  | { ok: true }
  | { ok: false; stage: 'bytecode' | 'terms'; detail: string };

export async function verifyEscrow(
  address: string,
  reader: EscrowReader,
  expected: ExpectedTerms
): Promise<EscrowVerdict> {
  const code: CloneVerdict = await verifyEscrowAddress(address, reader);
  if (!code.ok) return { ok: false, stage: 'bytecode', detail: code.detail };

  let onChain: OnChainTerms;
  try {
    onChain = await reader.getEscrowTerms(address);
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
