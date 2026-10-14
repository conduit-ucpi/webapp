/**
 * Before anyone pays: is the escrow address the API quoted the one OUR factory gives for the
 * terms this page is paying on?
 *
 * Escrow addresses are counterfactual — quoted before anything is deployed — so there is no
 * bytecode or FACTORY() to read yet (that is verifyEscrow.ts, for escrows that exist). What
 * there is, is the factory: its getContractAddress view answers, for any terms, the one address
 * it will ever deploy them at. This asks the factory this BUILD pins
 * (NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS), through the RPC this build pins (NEXT_PUBLIC_RPC_URL),
 * and refuses unless the quoted address matches. A compromised API, ap2service or chainservice
 * can then no longer swap in an address of its own: it would also have to compromise the
 * frontend build.
 *
 * The terms are the ones this page holds: what the payer typed or was shown, and the signed-in
 * wallet. Some come from the API by necessity — an email seller's wallet, the default arbiter,
 * a request's stored terms, and the externalId the factory was asked with. Taking those on trust
 * cannot redirect money: whatever they are, the factory's answer is an escrow whose buyer is
 * this payer and whose amount and token are these, and a wrong externalId only names a
 * different such escrow.
 *
 * Fails closed: no pinned factory or RPC, a missing term, or an unreadable answer is a refusal.
 */
import { getVerificationReader } from './verificationRpc';
import { expectedEscrowFactory } from './verifyEscrowFactory';

export interface QuotedTerms {
  token: string;
  buyer: string;
  seller: string;
  /** Token base units. */
  amount: bigint | string | number;
  /** Unix seconds; 0 for an instant transfer. */
  expiryTimestamp: number;
  arbiter: string;
  /** The externalId (bytes32) the factory was asked with, as prepare returned it. */
  externalId: string;
}

export interface FactoryReader {
  predictEscrowAddress(
    factory: string,
    terms: {
      token: string;
      buyer: string;
      seller: string;
      amount: bigint;
      expiryTimestamp: bigint;
      arbiter: string;
      externalId: string;
    }
  ): Promise<string>;
}

export type QuoteVerdict = { ok: true } | { ok: false; detail: string };

const isAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const isBytes32 = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function toBigInt(v: bigint | string | number): bigint | null {
  try {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? BigInt(v) : null;
    return /^\d+$/.test(v.trim()) ? BigInt(v.trim()) : null;
  } catch {
    return null;
  }
}

/**
 * `reader` and `factory` default to the build-time pins. Pass them only in tests: handing in the
 * application's RPC client, or a factory from /api/config, would make the check ask the API's
 * own answer of itself.
 */
export async function verifyQuotedEscrowAddress(
  quoted: string | null | undefined,
  terms: Partial<QuotedTerms>,
  reader: FactoryReader | null = getVerificationReader(),
  factory: string = expectedEscrowFactory()
): Promise<QuoteVerdict> {
  if (!isAddress(factory)) {
    return {
      ok: false,
      detail:
        'No known-good payment contract factory is baked into this build (NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS), ' +
        'so the payment address cannot be checked. Refusing to proceed.',
    };
  }
  if (!reader) {
    return {
      ok: false,
      detail:
        'No build-time RPC endpoint is configured (NEXT_PUBLIC_RPC_URL), so the payment address ' +
        'cannot be checked. Refusing to proceed.',
    };
  }
  if (!isAddress(quoted)) return { ok: false, detail: 'No valid payment address was quoted.' };

  const amount = terms.amount === undefined ? null : toBigInt(terms.amount);
  const expiry = terms.expiryTimestamp;
  if (
    !isAddress(terms.token) ||
    !isAddress(terms.buyer) ||
    !isAddress(terms.seller) ||
    !isAddress(terms.arbiter) ||
    !isBytes32(terms.externalId) ||
    amount === null ||
    typeof expiry !== 'number' ||
    !Number.isInteger(expiry) ||
    expiry < 0
  ) {
    return {
      ok: false,
      detail: 'Not every term of this payment is known, so its address cannot be checked. Refusing to proceed.',
    };
  }

  let answer: string;
  try {
    answer = await reader.predictEscrowAddress(factory, {
      token: terms.token,
      buyer: terms.buyer,
      seller: terms.seller,
      amount,
      expiryTimestamp: BigInt(expiry),
      arbiter: terms.arbiter,
      externalId: terms.externalId,
    });
  } catch (error: any) {
    return {
      ok: false,
      detail:
        `Could not ask the payment contract factory where this payment lives: ${error?.message || error}. ` +
        'Refusing to proceed without checking.',
    };
  }

  if (!isAddress(answer) || !same(answer, quoted)) {
    return {
      ok: false,
      detail:
        `The payment address we were given (${quoted}) is not where the payment contract factory puts a payment ` +
        `with these terms (${isAddress(answer) ? answer : 'no answer'}). Do not send funds to it.`,
    };
  }
  return { ok: true };
}

/**
 * The EIP-3009 authorization a payer is about to sign must pay THAT escrow, in this token, the
 * amount agreed, from this wallet. The typed data comes from the API, so a compromised API could
 * quote the right address and still hand over an authorization paying somebody else.
 */
export function verifyAuthorizationTarget(
  typedData: { domain: Record<string, unknown>; message: Record<string, unknown> } | undefined,
  expected: { escrow: string; token: string; amount: bigint | string | number; payer: string }
): QuoteVerdict {
  const amount = toBigInt(expected.amount);
  const message = typedData?.message ?? {};
  const domain = typedData?.domain ?? {};
  const value = toBigInt((message.value as any) ?? '');
  const problems: string[] = [];
  if (!isAddress(message.to) || !same(message.to, expected.escrow)) problems.push('it pays a different address');
  if (amount === null || value === null || value !== amount) problems.push('it is for a different amount');
  if (!isAddress(domain.verifyingContract) || !same(domain.verifyingContract, expected.token)) {
    problems.push('it is for a different token');
  }
  if (!isAddress(message.from) || !same(message.from, expected.payer)) problems.push('it is from a different wallet');
  if (problems.length) {
    return {
      ok: false,
      detail: `The authorization we were asked to have you sign does not match this payment: ${problems.join(', ')}. Nothing was signed.`,
    };
  }
  return { ok: true };
}
