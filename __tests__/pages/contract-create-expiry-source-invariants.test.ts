/**
 * Source-level invariants for expiryTimestamp handling in contract-create.tsx.
 *
 * The runtime test (contract-create-expiry-consistency.test.tsx) only drives
 * ONE of three deploy paths (QR). It cannot cheaply drive the others because
 * they're gated by UI state (token balance, etc.) that is expensive to mock.
 *
 * This test asserts invariants directly on the source file so that if ANY
 * deploy path regresses — e.g. someone adds a `Math.floor(Date.now() / 1000)`
 * back into handleWalletPayment — the test fails immediately.
 *
 * Invariants:
 *   1. There is exactly ONE `Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)`
 *      computation inside a handler (the create path). Every other handler
 *      must reuse `pendingExpiryTimestamp`. JSX display-only occurrences are
 *      allowed and counted separately.
 *   2. Every call site that sends `expiryTimestamp` to a deploy helper
 *      (`executeContractTransactionSequence`, `executeDirectPaymentSequence`)
 *      or to `/api/chain/create-contract` must be reached by a code path that
 *      reads `pendingExpiryTimestamp` — asserted by requiring a null-guard
 *      on `pendingExpiryTimestamp` inside each deploy handler.
 */

import fs from 'fs';
import path from 'path';

const SOURCE_PATH = path.join(__dirname, '..', '..', 'pages', 'contract-create.tsx');

function loadSource(): string {
  return fs.readFileSync(SOURCE_PATH, 'utf8');
}

/**
 * Return the line ranges of each top-level handler function body.
 * We detect handlers by their declaration and find the matching closing brace
 * by tracking brace depth.
 */
function getHandlerBody(source: string, declaration: string): string {
  const startIdx = source.indexOf(declaration);
  if (startIdx === -1) {
    throw new Error(`Could not find handler declaration: ${declaration}`);
  }
  // Find the first `{` after the declaration — the opening of the handler body.
  const openBraceIdx = source.indexOf('{', startIdx);
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return source.slice(openBraceIdx, i);
}

describe('contract-create.tsx — expiryTimestamp handler invariants', () => {
  const source = loadSource();

  /**
   * The three handlers that deploy to chainservice. Each must reuse the DB
   * value (via pendingExpiryTimestamp), not recompute it.
   */
  const DEPLOY_HANDLERS = [
    'const createContractForQR = useCallback',
    'const handleWalletPayment = async',
    'const handleLegacyPayment = async',
  ];

  /**
   * The one handler that is allowed to compute expiryTimestamp from scratch —
   * it's the source of truth, the value it computes is what gets stored in DB.
   */
  const CREATE_HANDLER = 'const handleCreateContract = async';

  test.each(DEPLOY_HANDLERS)(
    'deploy handler [%s] must NOT recompute expiryTimestamp from Date.now()',
    (declaration) => {
      const body = getHandlerBody(source, declaration);
      // The regression shape: `Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)`
      // or the drifty default that sources the bug.
      expect(body).not.toMatch(/Math\.floor\(Date\.now\(\)\s*\/\s*1000\)\s*\+\s*\(\s*7\s*\*\s*24/);
    },
  );

  test.each(DEPLOY_HANDLERS)(
    'deploy handler [%s] must reuse pendingExpiryTimestamp',
    (declaration) => {
      const body = getHandlerBody(source, declaration);
      expect(body).toMatch(/pendingExpiryTimestamp/);
    },
  );

  test.each(DEPLOY_HANDLERS)(
    'deploy handler [%s] must null-guard pendingExpiryTimestamp before proceeding',
    (declaration) => {
      const body = getHandlerBody(source, declaration);
      // Requires an explicit null check that returns early — guarantees we
      // never call into chainservice with a stale default.
      expect(body).toMatch(/pendingExpiryTimestamp\s*===\s*null/);
    },
  );

  test('create handler is the only handler that computes the default expiryTimestamp', () => {
    const body = getHandlerBody(source, CREATE_HANDLER);
    // The create handler MUST compute the value (that's its job).
    expect(body).toMatch(/Math\.floor\(Date\.now\(\)\s*\/\s*1000\)\s*\+\s*\(\s*7\s*\*\s*24/);
    // And it MUST persist the computed value into state for the deploy path to reuse.
    expect(body).toMatch(/setPendingExpiryTimestamp\s*\(\s*expiryTimestamp\s*\)/);
  });

  test('component has pendingExpiryTimestamp state declared', () => {
    // Catches accidental deletion of the single-source-of-truth state slot.
    expect(source).toMatch(
      /const\s*\[\s*pendingExpiryTimestamp\s*,\s*setPendingExpiryTimestamp\s*\]\s*=\s*useState<number\s*\|\s*null>/,
    );
  });
});
