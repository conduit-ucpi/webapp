# Frontend Migration: Server-Hosted → Static, Decoupled from Node API

**Goal:** Remove the ability for anyone with SSH/server access to change what frontend code is served to users, and close the related gap where a compromised Node API could hand the frontend a malicious contract address. Backend (Node API, Kotlin services) is unaffected in its logic — only where the frontend is hosted, and how it verifies what the API tells it, change.

**Current decision:** host the static frontend via GitHub-integrated deploy (GitHub Pages, or Cloudflare Pages/Vercel/Netlify pointed at the repo), gated on manual approval. This closes the "server-editable frontend" problem with much less operational overhead than the IPFS/ENS alternative. The trade-off, made deliberately: the single point of trust becomes the GitHub account/approval flow rather than a multisig-protected key. IPFS/ENS is documented at the end as a future upgrade if that trust level ever stops being sufficient.

---

## Phase 1 — Audit and decouple

1. **Inventory server-dependent code in the Next.js app.**
   Grep for and catalog: API routes (`pages/api/*` or `app/api/*`), `getServerSideProps`, middleware, server actions, anything reading server-only env vars at request time. Anything found here needs to become an explicit client-side call to the Node API instead.

2. **Confirm the Node API is a clean, standalone service.**
   It should not depend on being co-located with the frontend (no shared filesystem state, no assumption it's called server-to-server from Next). If the frontend currently calls the Node API server-side (SSR), change those calls to client-side `fetch`s with CORS enabled on the API.

3. **Identify which contract-related values can be hardcoded and which can't.**
   Factory address and implementation contract address are fixed — hardcode both at build time in the static bundle. Per-transaction clone addresses are generated server-side per deal and *must* come from the API at runtime — these can't be hardcoded, and are handled instead by the verification logic in Phase 3.

4. **Switch the build to static export.**
   Configure `next export` (or migrate off Next's server features to Vite/CRA if SSR dependencies run deep). Confirm the app builds to a self-contained folder of static HTML/JS/CSS with no server process required to run it.

5. **Smoke-test the static build against the live Node API**, served locally from a plain static file server (e.g. `npx serve`), before touching any deploy infrastructure.

---

## Phase 2 — GitHub-hosted static deploy

6. **Confirm PR-gating is actually watertight before relying on it.** "PRs need my approval" gates merges, not necessarily CI execution. Specifically check:
   - No workflow uses `pull_request_target` with access to secrets (this triggers on PR open/sync, before any approval, and runs in the base branch's trust context — a known bypass for exactly this kind of gate)
   - "Require approval for first-time/outside contributors to run workflows" is enabled (Settings → Actions)
   - Any `GITHUB_TOKEN`/PAT used in the deploy workflow is scoped to least privilege, not full write/admin

7. **Secure the GitHub account/org that controls approval and deploy.** Hardware security key (FIDO2/WebAuthn) for 2FA, not SMS. Review org admin membership — anyone else with equivalent merge/deploy rights is an equivalent single point of failure. Review and minimize who holds deploy-platform (Pages/Vercel/etc.) account access separately from repo access.

8. **Wire up the deploy as a parallel run, not a hard cutover.** Extend the existing CI pipeline to deploy to GitHub Pages *in addition to* the current path — don't touch the live serving path yet. This gives you a fully working GitHub Pages deployment, reachable at its own default URL, side by side with the existing production site.

9. **Validate GitHub Pages independently before any DNS change.** Exercise the full flow against it — including the Phase 3 client-side verification logic once that's in place — using its default URL (or a staging subdomain pointed at it) while the current setup keeps serving real users unaffected.

10. **Only once fully validated, migrate the Cloudflare DNS entry** for the production domain (stabledrop.me) to point at GitHub Pages. Keep the old deployment path live and ready to revert to (i.e. just flip DNS back) until GitHub Pages has run in production for a full release cycle.

11. **Verify** the deployed site matches the approved build after each deploy (spot-check, not just trust the pipeline).

---

## Phase 3 — Client-side verification of API-supplied contract addresses

Per-transaction contract addresses are generated server-side (factory + EIP-1167 clone pattern) and can't be hardcoded — the frontend has to receive them from the Node API. Hardcoding the API's URL only guarantees the frontend is talking to the right server; it does **not** guarantee the server is telling the truth, especially if that server is ever compromised. This step closes that gap independently of trusting the API.

12. **Confirm the clone pattern is EIP-1167 minimal proxies** from a known, fixed implementation contract (confirm with whoever wrote the factory). This is what makes the check below possible.

13. **Hardcode the known-good implementation contract address** in the static frontend bundle (alongside the factory address from Phase 1, step 3).

14. **On receiving a contract address from the API, verify it client-side before allowing any signature**, using the client's own RPC provider (Alchemy/Infura/etc.) — **never the Node API** for this check, since that would be circular:
    - Fetch the bytecode at the returned address directly from the RPC provider
    - Confirm it matches the exact EIP-1167 minimal-proxy template
    - Extract the implementation address embedded in that bytecode
    - Confirm it equals the hardcoded known-good implementation address from step 13
    - Refuse to proceed (no signature prompt) on any mismatch

15. **Also verify contract *state*, not just code.** A correct implementation address only proves the contract is running genuine logic — it says nothing about whether the specific deal terms (counterparty, amount, recipient) inside this instance are the ones the user actually agreed to in the UI. A compromised API could still hand back a genuine clone deployed with the wrong terms. So: after step 14 passes, read the clone's own state (`buyer()`, `seller()`, `amount()`, or equivalent view functions) directly via the client's RPC provider, and confirm those values match what the user was shown and agreed to — re-run this check immediately before every signature prompt, not just once when the address is first received.

---

## Phase 4 — Cut over

16. **Decommission the old static-hosting path** on the production box only after the GitHub-hosted deploy has been live and verified for a full release cycle. Keep the Node API on that box (or wherever it lives) — nothing there needs to change.

17. **Update incident-response notes**: if a bad build is ever deployed, remediation is "revert via git and redeploy the last known-good commit" — document who has authority to do that and how fast they can act.

---

## Future upgrade path: IPFS/ENS (not required now, revisit later)

If the single-account (GitHub) trust model above ever stops being sufficient — e.g. as transaction value grows, or if there's ever doubt about the org's GitHub account security — the stronger design is IPFS + ENS, and it slots in without requiring changes to Phase 1 or Phase 3:

- Acquire/confirm an ENS name for the frontend (e.g. `app.stabledrop.eth`)
- Set up the controlling wallet as a multisig (e.g. Gnosis Safe), 2-of-3 or similar, hardware-wallet signers, held separately from anyone with SSH/CI/GitHub deploy access
- Add a CI step to pin the static build to IPFS (Pinata/web3.storage/Fleek) and output the CID
- Set the ENS `contenthash` record to that CID, signed by the multisig — kept as a manual/multisig-gated step, never automated by CI
- Point the human-facing domain at an ENS gateway (`.eth.limo` or equivalent)

---

## Non-negotiables to flag to the team

- Factory address and implementation contract address: **build-time constants, never runtime-fetched.**
- Every API-supplied per-transaction contract address must pass client-side bytecode + implementation-address verification (Phase 3, steps 14–15) **immediately before any signature prompt is shown** — via the client's own RPC provider, never routed through the Node API.
- Contract *state* (counterparty, amount, recipient), not just contract *code*, must be independently verified client-side against what the user was shown — code verification alone does not catch a genuine clone deployed with the wrong terms.
- GitHub account/org controlling approval and deploy: hardware-key 2FA, least-privilege tokens, no `pull_request_target` bypass.
- The Node API remains a real attack surface for anything not covered by the client-side checks above (e.g. what's displayed to the user pre-signature, off-chain messaging/matching logic). Phase 3 closes address- and terms-spoofing specifically; it is not a substitute for a full review of everything the API returns.

---

# Appendix A — Phase 1 step 1 audit (completed 2026-09-04)

Inventory of server-dependent code in this app, against Next 16 / pages router.

## Not blockers

- **`getStaticProps` — 15 pages** (`index`, `landing1-7`, `how-it-works`, `merchant`,
  `b2b`, `sell`, `arbitration-policy`, `p2p`, `faq`, `index-original`). Runs at build
  time; fully compatible with static export. No change needed.
- **`getInitialProps` in `pages/_document.tsx`** — standard Next boilerplate, fine.
- **No `middleware.ts`, no server actions (`'use server'`).**
- **`pages/api/*` (~60 routes)** — these *are* the Node API and stay on the box per
  Phase 4 step 16. `X_API_KEY` remains server-side; not affected by this migration.

## The 8 `getServerSideProps` blockers

| Page(s) | What it does | Static equivalent |
|---|---|---|
| `email-verification`, `verify-email` | `emailVerificationPageGate` → 404 unless `EMAIL_VERIFICATION_LIVE==='true'` | delete — see below |
| `projects/index`, `projects/create`, `projects/[groupId]` | `projectsPageGate` → 404 unless `isProjectsLive()` | delete — see below |
| `sitemap.xml` | writes XML at request time | generate at build |
| `wordpress` | 301 → wordpress.org | hosting redirect config |
| `shopify/quick-checkout` | reads `context.query` (shop, product_id, price, …) | `useRouter().query` client-side |

**5 of the 8 can simply be deleted.** `pages/api/config.ts:198-200` already returns
`projectsLive` and `emailVerificationLive` to the client, and real enforcement is at
the API layer (`blockedByProjectsFlag` / `blockedByEmailVerificationFlag` guard every
`/api/projects/*` and `/api/email-verification/*` handler). The page-level
`getServerSideProps` gates are UX duplication, not a security boundary.

## Two decisions needed

1. **`pages/projects/[groupId].tsx` is a dynamic route with no `getStaticPaths`.**
   Group IDs are runtime values and cannot be enumerated at build. Needs SPA-style
   client routing with a fallback shell (on GitHub Pages, the `404.html` trick).

2. **`next.config.js` `headers()` sets `frame-ancestors` for Warpcast/Farcaster
   iframe embedding — GitHub Pages cannot set custom response headers at all.**
   Same problem for its `rewrites()` (`.well-known/farcaster.json` → dynamic API
   route) and `redirects()`. Cloudflare Pages / Vercel / Netlify all support a
   `_headers` file. Given DNS is already on Cloudflare, **Cloudflare Pages is the
   better default than GitHub Pages** for step 10.

## DEFERRED to Phase 3 — do not lose this

`pages/api/config.ts:131` currently fetches `factoryAddress` and
`implementationAddress` live from chainservice and serves them to the client:

    const contractAddresses = await getContractAddresses(process.env.CHAIN_SERVICE_URL);

This directly contradicts the plan's non-negotiable ("build-time constants, never
runtime-fetched") and would make the Phase 3 check circular: if the known-good
implementation address arrives from the same API that supplies the clone address, a
compromised API returns a malicious pair and bytecode verification passes against the
attacker's own answer.

When Phase 3 starts: move `factoryAddress` / `implementationAddress` out of
`/api/config` and into build-time constants baked in by CI. Everything else in that
endpoint (flags, gas settings, network params, token metadata) is fine to keep serving
at runtime — worst case on compromise is a degraded UI, not a spoofed signature.

---

# Appendix B — Phase 2 validation result (2026-09-07)

`https://pages.stabledrop.me` (GitHub Pages, static export) verified working
against `https://api.stabledrop.me` (the box, via Caddy), end to end:

- static assets, routing, SPA fallback for dynamic routes
- CORS preflight and credentialed cross-origin calls
- SIWE nonce → verify → AUTH-TOKEN cookie set by api.stabledrop.me
- authenticated API calls from the Pages origin

## Bugs this shook out

1. **basePath.** `PAGES_BASE_PATH=/webapp` was still set when the custom domain
   went live; the deployed HTML asked for `/webapp/_next/...` from a site served
   at the root. Also: Next rejects `basePath: '/'`, which is the only way to say
   "no prefix" in a GitHub Actions variable (empty values are refused), so
   next.config.js normalises `/`, `null`, `NULL` and trailing slashes.
2. **Reown CSP.** `secure.walletconnect.org` sends `frame-ancestors` built from
   the project's domain allowlist. A new origin has to be added there and takes
   time to propagate.
3. **Relative fetch, two shapes.** Literal `fetch('/api/...')` (54 sites), and —
   the one that actually bit — helpers taking a caller-supplied path and issuing
   `fetch(url)`. The latter made `/api/auth/identity` 404 instead of 401, so the
   "JWT expired, request a fresh signature" branch never ran and SIWE silently
   never happened. Enforced now by
   `__tests__/architecture/api-fetch-chokepoint.test.ts`.
4. **Version reporting.** The drawer showed only the API's version, so a current
   Pages build looked weeks stale. Client and API are now reported separately.

## Known-not-working, and why it does not block cutover

**Social login** (`secure.walletconnect.org` OAuth popup) times out on
pages.stabledrop.me — the origin is not registered for Reown's OAuth callback.
`stabledrop.me` has been allowlisted there for nine months, so this leg returns
to a known-good origin at cutover. Wallet connection ("Advanced wallet
connection") works on Pages and is what validated the API chain above.

## Still to do before cutover

- `api.stabledrop.me` proxies `webapp-prod`; `farcaster-test-*` tags deploy
  `webapp-test`. Deploy the box with `cherry-v*`/`v*` so the API is current, or
  repoint the Caddy block while testing.
- Merge and deploy the caddy `api-stabledrop-me` branch (not yet on main).
- Phase 3: factoryAddress/implementationAddress still come from /api/config
  (see Appendix A) — the bytecode check is circular until they are build-time
  constants.
