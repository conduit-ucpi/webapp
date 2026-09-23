import { keccak256, solidityPacked, getAddress, getCreate2Address, toUtf8Bytes } from 'ethers';

/**
 * Where an escrow lives, computed rather than discovered.
 *
 * EscrowContractFactory clones its implementation with CREATE2 over a salt built from the
 * escrow's terms, so the address is a pure function of those terms and is knowable before
 * anything exists on-chain. That is what lets us show a buyer where to send funds without
 * first paying for a deployment and waiting two minutes for it to confirm.
 *
 * ⚠️ THIS MUST AGREE WITH THE CHAIN, EXACTLY. chainservice computes the same value in
 *    CounterfactualAddress.kt, and both are pinned to a vector emitted from the Solidity
 *    itself (`PredictVectorTest`). If this file encodes the salt even slightly differently,
 *    the address we show a buyer is one the factory can never deploy to — and money sent
 *    there is unreachable, not merely misplaced. Nobody can move it: not the buyer, not the
 *    seller, not us.
 *
 * No RPC. No await. Deliberately a pure function of its arguments.
 */

/**
 * ERC-1167 minimal proxy creation code, split around the implementation address embedded in
 * its body. Byte-for-byte OpenZeppelin's Clones library — the predicted address depends on
 * it, so it cannot drift.
 */
const PROXY_PREFIX = '3d602d80600a3d3981f3363d3d373d3d3d363d73';
const PROXY_SUFFIX = '5af43d82803e903d91602b57fd5bf3';

export interface EscrowTerms {
  tokenAddress: string;
  buyer: string;
  seller: string;
  /** Token minor units — microUSDC for USDC. */
  amount: bigint | number | string;
  /** Unix seconds. 0 means an instant transfer with no dispute window. */
  expiryTimestamp: bigint | number;
  arbiter: string;
  /** The pending contract's id. See canonicalId for why its spelling matters. */
  contractserviceId: string;
}

/**
 * The one spelling of an id that gets hashed.
 *
 * externalId is keccak over the id's text, so "507F1F..." and "507f1f..." name different
 * escrows. contractservice stores Mongo's ObjectId as a String, canonically 24 lowercase hex
 * characters, but nothing on the wire enforces that — so both sides normalise instead, and a
 * caller that upper-cased somewhere converges on the same address rather than quietly getting
 * a different one.
 *
 * Kept in step with CounterfactualAddress.canonicalId in chainservice.
 */
export function canonicalId(contractserviceId: string): string {
  const canonical = contractserviceId.trim().toLowerCase();
  if (!canonical) {
    throw new Error('contractserviceId is blank; it seeds the escrow address');
  }
  return canonical;
}

/** What keeps two otherwise identical escrows apart, now that the salt has no timestamp in it. */
export function externalId(contractserviceId: string): string {
  return keccak256(toUtf8Bytes(canonicalId(contractserviceId)));
}

/**
 * The factory's salt: abi.encodePacked over the terms.
 *
 * Every parameter `initialize()` consumes is in here, arbiter included. That is what makes a
 * predictable address safe — `initialize()` has no caller restriction, so whoever deploys an
 * address first would otherwise choose that escrow's terms. Changing any one of them
 * necessarily changes the address, so front-running can only build the escrow that was asked
 * for, at the attacker's own expense.
 */
export function escrowSalt(terms: EscrowTerms): string {
  return keccak256(
    solidityPacked(
      ['address', 'address', 'address', 'uint256', 'uint256', 'address', 'bytes32'],
      [
        getAddress(terms.tokenAddress),
        getAddress(terms.buyer),
        getAddress(terms.seller),
        BigInt(terms.amount),
        BigInt(terms.expiryTimestamp),
        getAddress(terms.arbiter),
        externalId(terms.contractserviceId)
      ]
    )
  );
}

/** The address Clones.cloneDeterministic produces for this implementation, salt and factory. */
export function cloneAddress(implementation: string, salt: string, factory: string): string {
  const initCode = `0x${PROXY_PREFIX}${getAddress(implementation).slice(2).toLowerCase()}${PROXY_SUFFIX}`;
  return getCreate2Address(getAddress(factory), salt, keccak256(initCode));
}

/**
 * Where an escrow with these terms will live, whether or not it exists yet.
 *
 * `factory` and `implementation` are the pair the address is relative to. Each contracts
 * release deploys a new pair, and an address is only reachable from the factory that
 * predicted it — so whatever is recorded against a quote must be used to deploy it later,
 * not whatever happens to be configured by then.
 */
export function predictEscrowAddress(
  factory: string,
  implementation: string,
  terms: EscrowTerms
): string {
  return cloneAddress(implementation, escrowSalt(terms), factory);
}
