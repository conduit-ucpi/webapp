import React from 'react';
import type { WalletPrompt } from '@/lib/auth/walletPromptChannel';

/**
 * Shown while the wallet has a prompt open.
 *
 * The wallet's own prompt cannot carry this where anyone will read it. AppKit
 * renders the request inside a cross-origin iframe, and inside it EIP-4361
 * fixes the message order as domain, then address, then our statement — so our
 * words land below a two-line address, in the part of the message box that is
 * collapsed behind a chevron and faded out. See lib/auth/siwe-statement.ts.
 *
 * Worse, that iframe puts "to prove you own this wallet and to continue" above
 * transactions that move funds, not just above signatures. So this notice has
 * to distinguish the two cases the wallet refuses to.
 *
 * pointer-events-none because it is purely informational: the wallet prompt
 * behind it is what the user needs to click, and this must never sit in front
 * of it.
 *
 * z-index has to clear 999999, which is what AppKit assigns its secure iframe
 * (node_modules/@reown/appkit-wallet/.../W3mFrame.js). Anything below that
 * renders behind the wallet prompt and is never seen.
 */
export default function WalletSignaturePrompt({ prompt }: { prompt: WalletPrompt }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-4 z-[1000000] flex justify-center px-4 pointer-events-none"
    >
      <div className="max-w-sm rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-4 py-3 shadow-lg">
        <p className="text-sm font-medium text-secondary-900 dark:text-white">
          Check your wallet.
        </p>
        {prompt.kind === 'signature' ? (
          <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
            Approve the signature to stay signed in. No funds move and no payments are
            approved.
          </p>
        ) : (
          <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
            <span className="font-medium text-secondary-900 dark:text-white">
              This one moves funds.
            </span>{' '}
            You are {prompt.summary}. Approving is final.
          </p>
        )}
      </div>
    </div>
  );
}
