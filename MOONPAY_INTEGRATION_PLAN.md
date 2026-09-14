# MoonPay integration plan

Fiat on-ramp that funds an escrow directly, so a buyer with no crypto can pay a
payment request with a card or a bank transfer.

Nothing is built yet. `@moonpay/moonpay-js@^0.7.3` is in `dependencies` but is
imported nowhere; `MOONPAY_API_KEY` is the placeholder string in both
`.env.example` and `.env.local`, and the live `api.stabledrop.me/api/config`
returns `moonPayApiKey: ""`. `README.md` is accurate when it says
"MoonPay SDK (coming soon)".

## Decisions taken

**Hosted widget, not headless.** MoonPay Ramps does offer a headless API —
sessions, quotes, transactions, KYC via the Customer API, with card entry and
identity in single-use frames — but headless capabilities are enabled per
partner and the hosted widget is what carries bank transfers. Bank transfer
coverage is the reason to add MoonPay next to Coinbase at all, so the widget
wins. Revisit only if headless gains the same payment methods.

**The crypto amount is authoritative; fiat is derived.** Pass
`quoteCurrencyAmount` (exact USDC) and let the widget quote the customer their
local currency. Do not pass `baseCurrencyAmount`.

This is forced by the contract, not a preference. `EscrowContract.deposit`
reverts with `TransferAmountMismatch` unless exactly `AMOUNT` arrives — it
compares the balance delta against `AMOUNT` precisely so fee-on-transfer tokens
cannot half-fund an escrow. Any design that fixes the fiat side and lets the
USDC float produces underfunded escrows as a matter of routine.

Side effect: `lockAmount` is useless here. It locks `baseCurrencyAmount` only
and is skipped when that is absent, so the prefilled USDC figure stays editable
by the buyer. An edited figure means `deposit` reverts. Reconciliation on
arrival is required regardless — see below, which handles it for free.

**Deliver straight to the escrow address.** `walletAddress` is the escrow
contract, not the buyer's wallet. This needs no new on-chain work because it is
exactly how the QR path already funds escrows — from `useQrPayment.ts`: "money
arrives by direct transfer, and a permissionless call then observes the balance
and flips the state." `checkAndActivate` reads the escrow's token balance and
calls `/api/chain/check-and-activate`.

So MoonPay becomes a third funding route beside connected-wallet and QR,
sharing the same confirmation mechanism. The escrow must exist first, which
`createContract` already guarantees before the QR is shown.

**Confirm asynchronously. Do not reuse the polling screen.** `useQrPayment`
runs `COUNTDOWN_SECONDS = 240` with `POLL_INTERVAL_MS = 10_000` — a four-minute
live-waiting screen. That is right for a wallet transfer and wrong for every
on-ramp timing:

| method | time to arrive |
| --- | --- |
| open banking (UK/EEA) | minutes |
| manual bank transfer, GBP Faster Payments | MoonPay say "up to 2 working days" |
| card | minutes, plus first-time KYC |

Best case already overruns 240s once KYC is in the path; worst case on the same
method is two working days. Release the buyer from the page and confirm by
MoonPay webhook plus email, with the balance-observing `checkAndActivate` as
the thing that flips state whenever the money lands. That path is correct at
two minutes and at two days, so there is no per-country timing assumption to
get wrong — which matters because the target market is Venezuela via COBRO,
where none of the UK timings apply.

**Guard the payout window.** An escrow whose release date passes before funding
is a reachable state: `deposit` does not check the clock. A seller setting
release 24h out, with a buyer paying by a method that settles in 48h, produces
an escrow funded after its own release time. Either enforce a minimum release
window or warn the seller at creation. Not yet decided which.

## Key handling

Two keys, named to match what MoonPay's dashboard calls them:

- `MOONPAY_API_KEY` — the PUBLISHABLE key (`pk_…`). Belongs in `/api/config`,
  public, fine. It travels in the widget URL and is visible in any browser's
  network tab by design; hiding it is not a goal and is not achievable. Its
  presence is also the client-side feature flag.
- `MOONPAY_API_SECRET_KEY` — the SECRET key (`sk_…`). Read only inside the
  signing endpoint on the box. Never added to the config blob.

The publishable key keeps the plain `MOONPAY_API_KEY` name rather than being
renamed to something explicit. That is a deliberate choice, but it is the same
ambiguity that put a Neynar secret in the public config blob (below), so the
guard is the `pk_`/`sk_` prefixes: anything starting `sk_` must never be in a
variable that `/api/config` reads.

What protects the integration is the URL signature and domain allowlisting, not
secrecy of the publishable key. MoonPay require `signature` whenever `email` or
`walletAddress` is passed, or the widget refuses to load.

### The signing endpoint must not be a signing oracle

`signature = HMAC(secret, query_string)` is computed server-side and only the
digest reaches the browser; the secret never leaves the box. The signature
covers a **specific parameter set**, which is what stops someone with the
publishable key pointing the widget at their own address.

That property is lost if the endpoint signs what it is handed. It must derive
the parameters itself:

```
POST /api/moonpay/sign  { contractId }
  -> load the contract, read its chain address and AMOUNT
  -> build the query string from those, never from the request body
  -> return { url, signature }
```

Accepting `walletAddress` or `quoteCurrencyAmount` from the body would let
anyone have our server authorise a payout to any address — a valid signature,
issued by us, without the secret ever leaking.

This is the same mistake shape as `pages/api/admin/contracts/[id]/resolve.ts`,
which takes `chainAddress` from the body and acts on it while ignoring the
`[id]` in the path. There the damage is bounded by the chainservice admin
check; behind a signing endpoint there would be nothing.

## Open questions — confirm with MoonPay before building

Headless capability enablement and these all go through the same commercial
conversation (`team@moonpay.com`), so ask together.

- **Can a quote be driven by the destination amount?** The widget supports
  `quoteCurrencyAmount` as an input and states it takes precedence over
  `baseCurrencyAmount`. Whether the Quotes API accepts it as an input rather
  than only returning it was not confirmed from public docs. The whole
  "exact USDC in, local fiat quoted" design hinges on this.
- **Is USDC-on-Base a supported destination asset in the target markets?**
  `currencyCode` must name the Base variant. Wrong chain means funds gone.
- **Per-country payment methods**, especially Venezuela. Card and bank
  transfer breadth is the entire argument for MoonPay over Coinbase; if the
  local methods are not there for COBRO's market, there is no reason to build
  this.
- **Minimums.** MoonPay minimums are typically ~$20–30. The `0.001` test amount
  and small requests cannot be funded this way at all, so the on-ramp option
  has to hide itself below the threshold.

## Neynar key — fixed

`pages/api/config.ts` published `NEYNAR_API_KEY` to unauthenticated browsers.
It is a billed server credential, and the only client use was
`BuyerInput.tsx` testing it for presence. It now publishes
`hasNeynarSearch: !!process.env.NEYNAR_API_KEY` — a capability flag — and the
real calls stay server-side in `pages/api/users/search.ts` and
`pages/api/users/fid/[fid].ts`.

⚠️ **The key still needs rotating.** It was publicly readable for as long as it
was in that response, so it must be treated as compromised regardless of the
code fix.

`__tests__/architecture/secrets-stay-server-side.test.ts` now enforces the rule
that let this happen: no secret-shaped env var may be read in bundled code or
returned by `/api/config`. Because `NEYNAR_API_KEY` does not *look* like a
secret — it is `*_API_KEY`, exactly like the publishable `MOONPAY_API_KEY` that
belongs there — it is listed explicitly in that test's `KNOWN_SECRETS`. Add to
that list whenever a credential arrives whose name does not announce itself.
