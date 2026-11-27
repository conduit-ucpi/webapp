# /contract-create on top of /pay

Make `/contract-create` a thin checkout wrapper around the `/pay` flow (SDK `PayPage`), so store
checkouts and AI agents share one payment path. The route path, every URL parameter and every
postMessage event in `CONTRACT_CREATE_API.md` keep working; that document is the contract with
installed plugins (WordPress, Shopify, `public/conduit-checkout.js`).

Tick items as they land. On resuming, read this file first.

## Findings (settled before building)

- **Receipt covers the plugins.** `settle_escrow_payment` returns `receipt_claims["stabledrop.escrow"]`
  with `contract_id` (contractservice id), `escrow_account` (CAIP-10), and `funding_tx_hash` on the
  signed-wallet path. That is everything the webhook check, the Shopify order and the WordPress
  status URL need. No ap2service change expected; add fields there only if one turns out missing.
- **Transfer/QR path has no funding tx hash** (money arrived before settle). Same as today:
  contract-create only calls the webhook on the wallet path. Keep that parity.
- **All tokens support EIP-3009 signing** (user, 30 Sep 2026). No direct-transfer fallback needed.
- **Instant payments work**: ap2service takes `expiry_timestamp: 0` as "instant, deliberately".
- **`contract_created`** is only logged by conduit-checkout.js. `payment_completed` is verified by
  `data.contractId` — must be the contractservice id from the receipt.
- **/pay rewrites the URL** to `/pay?resume=…`; in checkout mode it must not, or `return`/`order_id`
  are lost and the path leaves `/contract-create` (Layout special-cases that path to drop our chrome).
- **Pre-sign-in screen changes**: contract-create asks "how will you pay" before connecting; /pay
  shows WalletChoiceCards. Accepting /pay's gate (both paths need a signed-in payer anyway).

## Design

`PayPage` takes an optional `checkout` prop:

```ts
checkout?: {
  terms: { seller; amount; description; expiryTimestamp; tokenSymbol? };  // locked
  onPaid(r: { contractId; escrowAddress; txHash? }): void;
  onFailed(message: string): void;
  onCancel(): void;
  compact?: boolean;          // iframe/popup padding and background
}
```

In checkout mode: the details form is skipped (prepare runs as soon as the payer is signed in),
terms are read-only on review, a Cancel button shows, the address bar is never rewritten, and the
add-funds return path is the current checkout URL plus `resume=<externalId>`. The done screen hands
off to `onPaid` instead of offering "another payment".

`ContractCreatePage` becomes the wrapper: parse and validate query params, default the expiry
(7 days; `0` = instant; invalid/past → default), detect iframe/popup, set the tab title, and
implement the hooks — postMessage, webhook verify, Shopify order, WordPress/return redirects,
cancel — reusing `utils/wordpressStatusUrl` and `safeRedirectUrl`.

## Steps

- [x] 1. Surface the receipt from settle in PayPage (`Settled` gains `receipt_claims`); a small
      helper that pulls `{ contractId, escrowAddress, txHash }` out of it (CAIP-10 → 0x address).
- [x] 2. PayPage `checkout` mode: locked terms, auto-prepare, no URL rewrite, checkout resume
      path, Cancel, hand-off on done/failure. Existing /pay behaviour unchanged without the prop.
- [x] 3. Tests for PayPage checkout mode (extend `__tests__/pages/pay.test.tsx`).
- [x] 4. Rewrite `ContractCreatePage` as the wrapper.
- [x] 5. Replace the `contract-create-*` tests: keep the behavioural ones (postmessage, webhook,
      token selection, expiry defaults) rewritten against the wrapper; delete the ones that test
      internals that no longer exist (deposit-token, expiry-source-invariants, auth-clear, …).
- [x] 6. Remove code only the old page used (check each for other callers first).
- [x] 7. Update `CONTRACT_CREATE_API.md` (event timing; `payment_completed` gains `contractAddress`;
      pre-sign-in screen).
- [x] 8. Typecheck, lint, full jest run.
- [ ] 9. BLOCKED (30 Sep): the 9222 browser's localhost tabs no longer start the app (bare shell,
      `router.isReady` never true, even on untouched /admin), and fresh tabs stop at the self-signed
      cert warning for https://localhost:3000. Needs the cert accepted in a fresh tab (or the
      browser restarted), then rerun. 9223/9224 were down. Browser is on testSupplier.
      Through the UI on the dev site: landing demo checkout (new tab), conduit-checkout.js in an
      iframe/popup, a WordPress-style `return` + `wordpress_source` URL, `epoch_expiry=0`, cancel,
      and the add-funds round trip. No direct RPC (see memory).
