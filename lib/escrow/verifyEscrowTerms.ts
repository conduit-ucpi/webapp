/**
 * Verify that a deployed escrow holds the terms the user actually agreed to.
 *
 * Bytecode verification (verifyEscrowClone.ts) proves the contract runs OUR
 * logic. It says nothing about what is INSIDE this instance. A compromised API
 * could deploy a perfectly genuine clone — passing every bytecode check — with
 * the seller replaced by an address it controls, or the amount inflated. The
 * user would be signing against real code holding fake terms.
 *
 * So the two checks are complementary and both are required:
 *
 *   verifyEscrowClone  → is this our contract?
 *   verifyEscrowTerms  → is it OUR DEAL?
 *
 * Comparison is against what the user was shown in the UI, not against anything
 * the API echoes back, and on raw values — a formatted amount is exactly where a
 * discrepancy could be rounded out of sight.
 */

/** What the user agreed to, from the form they filled in. */
export interface ExpectedTerms {
  buyer: string;
  seller: string;
  /** Raw token base units, as submitted (e.g. micro-USDC). */
  amount: string | number | bigint;
  token: string;
}

/** What the chain says, from RpcClient.getEscrowTerms(). */
export interface OnChainTerms {
  buyer: string;
  seller: string;
  amount: bigint;
  token: string;
}

export type TermsField = 'buyer' | 'seller' | 'amount' | 'token';

export type TermsVerdict =
  | { ok: true }
  | { ok: false; mismatched: TermsField[]; detail: string };

const sameAddress = (a: string, b: string): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Coerce a submitted amount to bigint. Returns null when it is not a clean
 * integer — a value we cannot compare is a refusal, never a pass.
 */
function toBigInt(v: string | number | bigint): bigint | null {
  try {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number') return Number.isInteger(v) ? BigInt(v) : null;
    const t = v.trim();
    return /^\d+$/.test(t) ? BigInt(t) : null;
  } catch {
    return null;
  }
}

export function verifyEscrowTerms(
  expected: ExpectedTerms,
  actual: OnChainTerms
): TermsVerdict {
  const mismatched: TermsField[] = [];
  const notes: string[] = [];

  if (!sameAddress(expected.buyer, actual.buyer)) {
    mismatched.push('buyer');
    notes.push(`buyer: expected ${expected.buyer}, on-chain ${actual.buyer}`);
  }
  if (!sameAddress(expected.seller, actual.seller)) {
    mismatched.push('seller');
    notes.push(`seller: expected ${expected.seller}, on-chain ${actual.seller}`);
  }
  if (!sameAddress(expected.token, actual.token)) {
    mismatched.push('token');
    notes.push(`token: expected ${expected.token}, on-chain ${actual.token}`);
  }

  const expectedAmount = toBigInt(expected.amount);
  if (expectedAmount === null) {
    mismatched.push('amount');
    notes.push(`amount: could not interpret ${String(expected.amount)} as an integer`);
  } else if (expectedAmount !== actual.amount) {
    mismatched.push('amount');
    notes.push(`amount: expected ${expectedAmount}, on-chain ${actual.amount}`);
  }

  if (mismatched.length === 0) return { ok: true };

  return {
    ok: false,
    mismatched,
    detail:
      'The deployed contract does not match the deal you agreed to — ' +
      notes.join('; '),
  };
}
