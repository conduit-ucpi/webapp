import {
  predictEscrowAddress,
  externalId,
  canonicalId,
  type EscrowTerms
} from '@/lib/counterfactualAddress';

/**
 * Pins the browser's predictor to the Solidity.
 *
 * The vector below is emitted by `PredictVectorTest` in the contracts repo, which asks the
 * real factory where an escrow with these terms would live. chainservice is pinned to the
 * same numbers in CounterfactualAddressTest.kt.
 *
 * If this fails, this file and the chain disagree about an address — and funds sent to the
 * one we show a buyer would sit somewhere the factory can never deploy to, unreachable by
 * anyone rather than merely misplaced.
 *
 * Regenerate with: forge test --match-contract PredictVectorTest -vv
 */
describe('counterfactual escrow address', () => {
  const factory = '0x2e234DAe75C793f67A35089C9d99245E1C58470b';
  const implementation = '0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f';

  const terms: EscrowTerms = {
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    buyer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    seller: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    amount: BigInt('1000000000'),
    expiryTimestamp: 1793500000,
    arbiter: '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C',
    contractserviceId: '507f1f77bcf86cd799439011'
  };

  const predict = (overrides: Partial<EscrowTerms> = {}) =>
    predictEscrowAddress(factory, implementation, { ...terms, ...overrides });

  it('matches the address the factory itself predicts', () => {
    expect(predict().toLowerCase()).toBe('0xc20858a932bb9a3ee46ea9b97476726c7f15bcaf');
  });

  it('derives externalId as keccak over the pending contract id', () => {
    expect(externalId(terms.contractserviceId)).toBe(
      '0x003c8aad7259f1acb10b8d4011e74b2fdd2fd7fe8b7604b84211d3b361e12d47'
    );
  });

  /**
   * Every initialize parameter is in the salt, so changing any one must move the address.
   * This is the property that makes publishing a predicted address safe: initialize() has no
   * caller restriction, so an attacker able to keep the address while altering a term would
   * get to choose that escrow's terms.
   */
  it.each([
    ['token', { tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7' }],
    ['buyer', { buyer: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' }],
    ['seller', { seller: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }],
    ['amount', { amount: BigInt('1000000001') }],
    ['expiry', { expiryTimestamp: 1793500001 }],
    ['arbiter', { arbiter: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }],
    ['externalId', { contractserviceId: '507f1f77bcf86cd799439012' }]
  ])('%s changes the address', (_term, override) => {
    expect(predict(override as Partial<EscrowTerms>)).not.toBe(predict());
  });

  it('is relative to the factory, not just the implementation', () => {
    expect(
      predictEscrowAddress('0x1111111111111111111111111111111111111111', implementation, terms)
    ).not.toBe(predict());
  });

  /**
   * The id is hashed as text, so its spelling decides the address. Spellings must converge,
   * or a caller that upper-cased one somewhere would be handed a different address with the
   * funds sent there unreachable.
   */
  it.each(['507F1F77BCF86CD799439011', '  507f1f77bcf86cd799439011  '])(
    'treats %p as the same id',
    (variant) => {
      expect(predict({ contractserviceId: variant })).toBe(predict());
    }
  );

  it('rejects a blank id rather than hashing nothing', () => {
    expect(() => canonicalId('   ')).toThrow(/blank/i);
  });
});
