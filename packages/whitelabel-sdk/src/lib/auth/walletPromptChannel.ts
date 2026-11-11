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
  | {
      kind: 'transaction';
      summary: string;
      /**
       * A full sentence for the wallet's OWN prompt, where the wallet lets us set one (Privy's
       * embedded wallet does; see withTransactionPrompt in PrivyHost). Without it the wallet
       * writes its own, which for an approval is "…permission for 0x… to spend tokens on your
       * behalf": true, and no use to someone deciding whether to press the button.
       */
      walletDescription?: string;
      /**
       * False for a transaction that moves nothing, such as opening a dispute: the notice then
       * does not say "This one moves funds" or "Approving is final", neither of which is true.
       * Unsaid, it is taken to move funds, which is the safe thing to be wrong about.
       */
      movesFunds?: boolean;
      /**
       * The wallet's own screen is saying `walletDescription`, so our notice has nothing to add
       * and is not shown. Set by the wallet integration that put it there (walletSaysIt), never
       * by a caller: only that integration knows the sentence really reached the wallet's screen.
       */
      saidByWallet?: boolean;
    };

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

/**
 * The open transaction's description is now on the wallet's own screen: stop showing ours.
 *
 * ⚠️ ONLY WHERE THE WALLET LETS US WRITE ITS SCREEN (Privy's embedded wallet). MetaMask and every
 *    other external wallet word their own prompt and we cannot change it, so for them the notice
 *    is still the only place the truth is said, and stays.
 */
export function walletSaysIt(): void {
  if (current?.kind !== 'transaction' || !current.walletDescription || current.saidByWallet) return;
  current = { ...current, saidByWallet: true };
  emit();
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
