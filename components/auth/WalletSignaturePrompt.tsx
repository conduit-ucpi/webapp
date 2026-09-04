import React from 'react';

/**
 * Shown while the wallet is being asked for a re-auth signature.
 *
 * The wallet's own prompt cannot carry this reassurance where anyone will read
 * it. AppKit renders the request inside a cross-origin iframe, and inside it
 * EIP-4361 fixes the message order as domain, then address, then our statement
 * — so our words land below a two-line address, in the part of the message box
 * that is collapsed behind a chevron and faded out. See lib/auth/siwe-statement.ts.
 *
 * This is the one surface we control, so it says the thing the wallet cannot.
 *
 * pointer-events-none because it is purely informational: the wallet prompt
 * that follows is what the user needs to click, and this must never sit in
 * front of it.
 */
export default function WalletSignaturePrompt() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-4 z-[9999] flex justify-center px-4 pointer-events-none"
    >
      <div className="max-w-sm rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-4 py-3 shadow-lg">
        <p className="text-sm font-medium text-secondary-900 dark:text-white">
          Check your wallet.
        </p>
        <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
          Approve the signature to stay signed in. No funds move and no payments are
          approved.
        </p>
      </div>
    </div>
  );
}
