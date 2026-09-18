import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { predictEscrowAddress, externalId } from '@/lib/counterfactualAddress';

/**
 * Every shared vector, reproduced by the browser's own derivation.
 *
 * ⚠️ FOUR IMPLEMENTATIONS OF THIS ARITHMETIC EXIST and the factory is the only authority:
 *    this file's subject, `CounterfactualAddress.kt` in chainservice, `address.py` in
 *    ap2service, and the Solidity itself. They do not fail loudly when they disagree — a buyer
 *    is shown an address the factory can never deploy to, and money sent there is unreachable
 *    by anyone rather than merely misplaced. This is one of the four places that makes a
 *    disagreement loud.
 *
 * ⚠️ WHY THIS EXISTS ALONGSIDE counterfactualAddress.test.ts, WHICH ALREADY PINS AN ADDRESS.
 *    That one reproduces a SINGLE case, typed in by hand. The vector file carries five, and the
 *    four it did not cover are the ones that catch a real divergence: expiry 0 (the instant
 *    branch), a differing external id, a differing arbiter, and an amount high in uint256 range
 *    where JavaScript's number type would have lost precision long before. An implementation
 *    can agree on the canonical case and disagree on every other one.
 *
 * Regenerate with `forge test --match-contract PredictVectorTest` in the contracts repo, then
 * copy the file to all four repos and update DIGEST here and in the others.
 */
const VECTORS_PATH = join(__dirname, '..', 'fixtures', 'counterfactual-vectors.json');
const RAW = readFileSync(VECTORS_PATH);
const vectors = JSON.parse(RAW.toString());

interface VectorCase {
  name: string;
  tokenAddress: string;
  buyer: string;
  seller: string;
  amount: string;
  expiryTimestamp: number;
  arbiter: string;
  contractserviceId: string;
  externalId: string;
  expectedAddress: string;
}

describe('the shared counterfactual vectors', () => {
  // ⚠️ TYPED AS A TUPLE ARRAY, not left to inference. `.map(c => [c.name, c])` widens to
  //    `any[][]`, which `it.each` cannot narrow back to a two-argument callback — it typechecks
  //    as "may have fewer elements" and fails the build while every test still passes. jest is
  //    perfectly happy; only tsc notices.
  const cases: [string, VectorCase][] = vectors.cases.map((c: VectorCase) => [c.name, c]);

  /**
   * ⚠️ A COPY IN FOUR REPOSITORIES IS A COPY THAT DRIFTS. Editing one to make a failing test
   *    pass is the obvious move when the numbers disagree, and it is exactly backwards — the
   *    test is the messenger. Changing the file breaks this too, which forces the change to be
   *    deliberate and to be made everywhere at once.
   */
  it('is the same file every other repo has', () => {
    expect(createHash('sha256').update(RAW).digest('hex')).toBe(
      '10c401f12ea1257a2a681ec29a88204ed9613284e4986bb161b67aa6cacffce3'
    );
  });

  it.each(cases)(
    'reproduces %s exactly',
    (_name: string, testCase: VectorCase) => {
      expect(
        predictEscrowAddress(vectors.factory, vectors.implementation, {
          tokenAddress: testCase.tokenAddress,
          buyer: testCase.buyer,
          seller: testCase.seller,
          amount: BigInt(testCase.amount),
          expiryTimestamp: testCase.expiryTimestamp,
          arbiter: testCase.arbiter,
          contractserviceId: testCase.contractserviceId
        }).toLowerCase()
      ).toBe(testCase.expectedAddress.toLowerCase());
    }
  );

  it.each(cases)(
    'derives the externalId for %s exactly',
    (_name: string, testCase: VectorCase) => {
      expect(externalId(testCase.contractserviceId).toLowerCase()).toBe(
        testCase.externalId.toLowerCase()
      );
    }
  );
});
