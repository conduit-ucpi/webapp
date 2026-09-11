/**
 * What the wallet is currently asking the user to approve.
 *
 * The wallet's own prompt cannot be trusted to say this. AppKit renders it in a
 * cross-origin iframe, and that iframe puts "to prove you own this wallet and
 * to continue" above transactions that transfer value as well as above
 * signatures. We cannot edit their copy, so the app states the truth on the one
 * surface it controls — see components/auth/WalletSignaturePrompt.tsx.
 *
 * A module-level channel rather than React state because the callers are
 * outside React: Web3Service submits transactions, SimpleAuthProvider requests
 * re-auth signatures, and both need the same notice.
 */

export type WalletPrompt =
  | { kind: 'signature' }
  | { kind: 'transaction'; summary: string };

let current: WalletPrompt | null = null;
const listeners = new Set<(prompt: WalletPrompt | null) => void>();

/**
 * Nested prompts are counted rather than overwritten. A transaction flow can
 * trigger a re-auth signature partway through, and the inner one finishing
 * must not clear the notice while the outer request is still on screen.
 */
let depth = 0;

function emit() {
  listeners.forEach(listener => listener(current));
}

export function subscribeWalletPrompt(listener: (prompt: WalletPrompt | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWalletPrompt(): WalletPrompt | null {
  return current;
}

/**
 * Show the notice for as long as `request` is in flight.
 *
 * Always pass the wallet call itself, never a wider block of work — the notice
 * says "check your wallet", so it has to disappear when the wallet does.
 */
export async function withWalletPrompt<T>(prompt: WalletPrompt, request: () => Promise<T>): Promise<T> {
  depth++;
  current = prompt;
  emit();

  try {
    return await request();
  } finally {
    depth--;
    if (depth === 0) {
      current = null;
      emit();
    }
  }
}
