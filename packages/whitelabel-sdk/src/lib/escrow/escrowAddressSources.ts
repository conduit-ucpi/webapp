/**
 * Where the three addresses an escrow's location depends on are allowed to come from.
 *
 * A counterfactual address is computed from the factory, the implementation, the arbiter and
 * the deal's own terms. Whoever controls those first three controls where the buyer's money
 * goes: substitute a factory and implementation you own and the browser will cheerfully
 * compute an address you can deploy anything to, including an escrow naming you as seller.
 *
 * The API is therefore not an acceptable sole source. This mirrors the reasoning already
 * applied to verifyEscrowClone, which pins the implementation at build time for exactly this
 * reason — with the difference that a counterfactual address cannot be checked against
 * deployed bytecode, because nothing is deployed when the buyer is told where to pay. The
 * defence has to be structural instead: derive the address from values the API cannot reach.
 *
 * Build-time values win. When both exist and disagree, that is either a compromised API or a
 * frontend built against a superseded deployment — the second is the likelier and the more
 * dangerous, because it is silent. Both fail closed.
 */

export interface EscrowAddressSources {
  factoryAddress: string;
  implementationAddress: string;
  defaultArbiterAddress: string;
}

/** Inlined at build time by Next, and unreachable by the API. */
function buildTime(): Partial<EscrowAddressSources> {
  return {
    factoryAddress: process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS || undefined,
    implementationAddress: process.env.NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS || undefined,
    defaultArbiterAddress: process.env.NEXT_PUBLIC_DEFAULT_ARBITER_ADDRESS || undefined
  };
}

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Resolve the three addresses, preferring build-time constants and refusing a disagreement.
 *
 * Throws rather than returning a best guess: every outcome here decides where funds are sent,
 * and there is no recovering from sending them to an address nothing can deploy to.
 */
export function resolveEscrowAddressSources(
  fromApi: Partial<EscrowAddressSources>
): EscrowAddressSources {
  const pinned = buildTime();
  const resolved: Partial<EscrowAddressSources> = {};

  (Object.keys(pinned) as (keyof EscrowAddressSources)[]).forEach((key) => {
    const pin = pinned[key];
    const api = fromApi[key];

    if (pin && api && !same(pin, api)) {
      throw new Error(
        `Refusing to compute an escrow address: this build pins ${key} to ${pin} but the API ` +
          `reports ${api}. Either the frontend is built against a superseded deployment, or the ` +
          `API is not to be trusted. Funds sent to an address derived from the wrong value ` +
          `cannot be recovered.`
      );
    }

    const value = pin || api;
    if (!value) {
      throw new Error(
        `Cannot compute an escrow address: ${key} is not available from this build or the API.`
      );
    }
    resolved[key] = value;
  });

  if (!pinned.factoryAddress || !pinned.implementationAddress) {
    // Worth saying out loud. It is not a failure — plenty of environments have never set
    // these — but it does mean the address depends on what the API said it should be.
    console.warn(
      'Escrow address derived from API-supplied factory/implementation. Set ' +
        'NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS and NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS to ' +
        'pin them at build time.'
    );
  }

  return resolved as EscrowAddressSources;
}
