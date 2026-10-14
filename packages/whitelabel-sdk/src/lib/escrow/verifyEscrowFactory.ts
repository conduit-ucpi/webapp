/**
 * Verify that a deployed escrow was created by OUR factory.
 *
 * Bytecode verification (verifyEscrowClone.ts) proves an address runs our implementation. It
 * does not prove who initialized it: EscrowContract.initialize() accepts whatever its first
 * caller passes and records that caller as FACTORY. Our factory only ever initializes with a
 * partner split its FEE_SPLIT_SIGNER signed, and a fee at or above its own rule — but anyone can
 * deploy their own factory that clones the same implementation and initializes it with any
 * partner or fee. That clone passes the bytecode check.
 *
 * So the escrow's FACTORY() is compared with the factory this build trusts. Like the
 * implementation, that address is a BUILD-TIME constant (NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS)
 * and is never taken from /api/config: an API that supplied both the escrow and the factory to
 * check it against could hand back a matching pair.
 *
 * Fails closed: no pinned factory, or an unreadable FACTORY(), is a refusal.
 */

export type FactoryVerdict =
  | { ok: true }
  | { ok: false; reason: FactoryFailure; detail: string };

export type FactoryFailure =
  /** No factory address was baked into this build — cannot verify. */
  | 'no-expected-factory'
  /** FACTORY() could not be read. */
  | 'unreadable'
  /** Created by some other contract. */
  | 'wrong-factory';

const isAddress = (v: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(v);

/**
 * The build-time trust anchor. A function rather than a module-level const for the same
 * reason as expectedEscrowImplementation(): Next still inlines it at build time, but the
 * value does not freeze at import time under test.
 */
export function expectedEscrowFactory(): string {
  return process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS || '';
}

/** Compare an escrow's FACTORY() with the factory this build trusts. */
export function verifyFactory(
  actual: string | null | undefined,
  expectedFactory: string | null | undefined
): FactoryVerdict {
  if (!expectedFactory || !isAddress(expectedFactory)) {
    return {
      ok: false,
      reason: 'no-expected-factory',
      detail:
        'No known-good payment contract factory is baked into this build ' +
        '(NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS). Refusing to verify.',
    };
  }
  if (!actual || !isAddress(actual)) {
    return { ok: false, reason: 'unreadable', detail: 'Could not read which factory created this payment contract.' };
  }
  if (actual.toLowerCase() !== expectedFactory.toLowerCase()) {
    return {
      ok: false,
      reason: 'wrong-factory',
      detail:
        `This payment contract was created by ${actual.toLowerCase()}, not by our factory ` +
        `${expectedFactory.toLowerCase()}. It runs our code but its terms, fee and partner ` +
        'were set by someone else. Refusing to proceed.',
    };
  }
  return { ok: true };
}
