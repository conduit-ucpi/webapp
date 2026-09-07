/**
 * Client-side verification that an API-supplied escrow address is a genuine
 * ERC-1167 clone of OUR implementation.
 *
 * Per-deal escrow addresses are deployed by the factory and must come from the
 * API at runtime — they cannot be known at build time. Hardcoding the API's URL
 * only proves the frontend is talking to the right server; it says nothing about
 * whether that server is telling the truth. A compromised API could return an
 * address it controls and the user would sign against it.
 *
 * So the address is checked against the chain, not against the API:
 *
 *   1. fetch the runtime bytecode at the address from the client's OWN RPC
 *   2. compare it, byte for byte, against the ERC-1167 runtime that OpenZeppelin
 *      Clones emits for our known-good implementation
 *
 * A single exact comparison settles both questions at once — that it is a
 * minimal proxy at all, and that it delegates to our implementation. There is
 * nothing to parse and no partial match to get subtly wrong.
 *
 * This mirrors what OfferVaultFactory already enforces on-chain:
 *
 *   EXPECTED_ESCROW_CODEHASH = keccak256(abi.encodePacked(
 *     hex"363d3d373d3d3d363d73", trustedImplementation,
 *     hex"5af43d82803e903d91602b57fd5bf3"))
 *
 * CRITICAL: the implementation address must be a BUILD-TIME constant. If it were
 * fetched from the same API that supplies the clone address, a compromised API
 * would return a matching pair and this check would compare the attacker's
 * answer against the attacker's answer. See STATIC_FRONTEND_MIGRATION_PLAN.md.
 */

/** ERC-1167 runtime, as emitted by OpenZeppelin Clones. */
const CLONE_PREFIX = '363d3d373d3d3d363d73';
const CLONE_SUFFIX = '5af43d82803e903d91602b57fd5bf3';

/** 10 + 20 + 15 bytes. */
export const CLONE_RUNTIME_BYTES = 45;

export type CloneVerdict =
  | { ok: true; implementation: string }
  | { ok: false; reason: CloneFailure; detail: string };

export type CloneFailure =
  /** No implementation address was baked into this build — cannot verify. */
  | 'no-expected-implementation'
  /** The supplied address is not a well-formed 20-byte address. */
  | 'malformed-address'
  /** Nothing deployed at the address, or an EOA. */
  | 'not-a-contract'
  /** Deployed, but not an ERC-1167 minimal proxy. */
  | 'not-a-minimal-proxy'
  /** A minimal proxy, but delegating somewhere other than our implementation. */
  | 'wrong-implementation';

const isAddress = (v: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(v);

const normaliseHex = (v: string): string => v.trim().toLowerCase().replace(/^0x/, '');

/**
 * The exact runtime bytecode an ERC-1167 clone of `implementation` must have.
 * Lowercase, 0x-prefixed.
 */
export function expectedCloneRuntime(implementation: string): string {
  if (!isAddress(implementation)) {
    throw new Error(`expectedCloneRuntime: not an address: ${implementation}`);
  }
  return `0x${CLONE_PREFIX}${normaliseHex(implementation)}${CLONE_SUFFIX}`;
}

/**
 * Compare fetched bytecode against the expected clone runtime.
 *
 * `code` is what eth_getCode returned for the address; `expectedImplementation`
 * is the build-time constant. Returns a verdict rather than throwing so callers
 * can surface a specific refusal to the user.
 */
export function verifyCloneBytecode(
  code: string | null | undefined,
  expectedImplementation: string | null | undefined
): CloneVerdict {
  if (!expectedImplementation || !isAddress(expectedImplementation)) {
    return {
      ok: false,
      reason: 'no-expected-implementation',
      detail:
        'No known-good escrow implementation is baked into this build ' +
        '(NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS). Refusing to verify.',
    };
  }

  const actual = normaliseHex(code || '');

  // eth_getCode returns '0x' for an EOA or an address with nothing deployed.
  if (actual === '') {
    return {
      ok: false,
      reason: 'not-a-contract',
      detail: 'No contract code at that address.',
    };
  }

  const expected = normaliseHex(expectedCloneRuntime(expectedImplementation));
  if (actual === expected) {
    return { ok: true, implementation: expectedImplementation.toLowerCase() };
  }

  // Distinguish "not a proxy at all" from "a proxy pointing elsewhere" — the
  // second is the interesting one and deserves a different message.
  const looksLikeClone =
    actual.length === CLONE_RUNTIME_BYTES * 2 &&
    actual.startsWith(CLONE_PREFIX) &&
    actual.endsWith(CLONE_SUFFIX);

  if (!looksLikeClone) {
    return {
      ok: false,
      reason: 'not-a-minimal-proxy',
      detail:
        'The code at that address is not an ERC-1167 minimal proxy. ' +
        'It may be an unrelated contract.',
    };
  }

  const embedded = `0x${actual.slice(CLONE_PREFIX.length, CLONE_PREFIX.length + 40)}`;
  return {
    ok: false,
    reason: 'wrong-implementation',
    detail:
      `That address is a minimal proxy delegating to ${embedded}, ` +
      `not the expected implementation ${expectedImplementation.toLowerCase()}.`,
  };
}

/** Address supplied to the check must at least be well formed. */
export function assertVerifiableAddress(address: string): CloneVerdict | null {
  if (!isAddress(address)) {
    return {
      ok: false,
      reason: 'malformed-address',
      detail: `Not a valid contract address: ${address}`,
    };
  }
  return null;
}

/** Build-time constant. Deliberately NOT read from /api/config — see header. */
export const EXPECTED_ESCROW_IMPLEMENTATION =
  process.env.NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS || '';

/** Minimal surface needed for verification, so tests need no real provider. */
export interface CodeReader {
  getCode(address: string): Promise<string>;
}

/**
 * Fetch the bytecode at `address` from the chain and verify it is a clone of
 * our implementation. Fails closed: an RPC error is a refusal, never a pass.
 */
export async function verifyEscrowAddress(
  address: string,
  rpc: CodeReader,
  expectedImplementation: string = EXPECTED_ESCROW_IMPLEMENTATION
): Promise<CloneVerdict> {
  const malformed = assertVerifiableAddress(address);
  if (malformed) return malformed;

  let code: string;
  try {
    code = await rpc.getCode(address);
  } catch (error: any) {
    return {
      ok: false,
      reason: 'not-a-contract',
      detail:
        `Could not read contract code for ${address}: ${error?.message || error}. ` +
        `Refusing to proceed without verification.`,
    };
  }

  return verifyCloneBytecode(code, expectedImplementation);
}
