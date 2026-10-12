# UI test plan — core payments

Run by Claude through dave's Chrome over CDP (port 9222). These are written to be followed by
hand or by an agent: each test says what to do in which tab, and what must be true afterwards.

## Before a run

- dave has already opened and signed in **two tabs** on the server under test:
  - **SELLER** — signed in as `testSupplier@stabledrop.me` (`SELLER_EMAIL`): requests and
    receives payments.
  - **BUYER** — signed in as `testcustomer@stabledrop.me` (`BUYER_EMAIL`): pays.
  - `fairperson@stabledrop.me` (`ARBITER_EMAIL`) — a third party used as a custom tiebreaker.
    Nobody signs in as them.
- Identify each tab by the signed-in email shown in its account menu or dashboard, read each
  tab's wallet address there, and use those wherever a test says `SELLER_WALLET` or
  `BUYER_WALLET`. Never sign in, sign out or switch accounts in either tab.
- Work on the origin the tabs are already on (`BASE`). Open extra pages in the same tab, or in a
  new tab that shares the same profile and session, never a fresh profile.

## Rules

- **Money:** the only amount ever paid on-chain is the free test amount, **0.001**. The test
  wallets hold under $1, so no amount above that is typed anywhere, and **nothing but 0.001 is
  ever entered on `/pay` or a checkout link**: pressing Continue there puts an escrow on file,
  and a larger one would sit on both dashboards as an unpayable pending payment.
- **Wallet prompts:** approve a signature or transaction only when the test step says to. If a
  prompt appears that the test doesn't expect, reject it and record a failure.
- **Evidence:** for every test, record PASS / FAIL / BLOCKED, a screenshot of the final state, and
  any console errors (`Runtime.consoleAPICalled` / `Runtime.exceptionThrown`) seen during it.
- **Stop conditions:** stop the run and report if a page asks to pay anything other than 0.001, if
  the "We couldn't confirm this payment with the escrow contract" message appears on a normal
  flow, or if an address shown for payment differs anywhere on the same screen.
- **Keep the app tab in front** (`Page.bringToFront`) before every load. Chrome throttles a tab it
  treats as backgrounded to about one timer a minute, and the app then takes minutes to start —
  that looks exactly like a hang and is not one.
- **Switching accounts** (one window, one account at a time): Logout is in the hamburger menu.
  Then sign in with "Advanced wallet connection" → MetaMask, and in MetaMask's connect prompt
  select only the account wanted (it may offer two). Approve Privy's sign-in message, then the
  Terms of Service message. Check `/api/auth/identity` names the right email before carrying on.
- **MetaMask clicks must be real mouse events** (`Input.dispatchMouseEvent`); a scripted
  `.click()` does not register on its buttons. Every payment currently shows a red Blockaid
  "High-risk approval" warning: press Confirm, tick "I have acknowledged the alerts", press the
  dialog's Confirm, then press **Confirm again**. Before approving, check the request's To is the
  escrow on screen and its Value is 1000 (0.001 USDC).
- **Free test payments are capped per buyer per day** (`TEST_PAYMENTS_PER_BUYER_PER_DAY` on
  ap2service, default 3, plus `TEST_PAYMENTS_PER_HOUR` across everyone). Every Continue on `/pay`
  or a checkout counts, even ones never paid. Raise it on the test environment before a full run.
- Tests are independent unless they say `Needs: <id>`. Things created by one test (requests,
  escrows) can be reused by later ones when noted.

Result log format (append to the run report, not to this file):

```
<ID>  PASS|FAIL|BLOCKED  <one line>  [screenshot path]  [console errors]
```

---

### Two accounts in one browser

Both tabs are on the same site in the same Chrome profile, so they share its cookies and local
storage: the app's session cookie and Privy's stored session belong to the site, not the tab.
Whichever account signed in last is the one both tabs are really using, even if the other tab
still shows its old account until it reloads. S-01 checks for this. If it fails, the two
accounts need separate storage: two Chrome profiles (each with its own debugging port), or one
account on a different origin (e.g. the test site and a localhost build pointed at it).

---

## 1. Smoke

**S-01 Both tabs are signed in, as different people.** In each tab open (or reload)
`BASE/dashboard`. Expect: the dashboard loads without a sign-in prompt; SELLER shows
`SELLER_EMAIL` and BUYER shows `BUYER_EMAIL`; the two wallet addresses differ. If, after the
reload, both tabs show the same account, stop the run as BLOCKED: the two sessions are sharing
one browser login (see "Two accounts in one browser" below).

**S-02 Main pages render.** In BUYER open `/`, `/create`, `/pay`, `/dashboard` in turn. Expect:
each renders its main heading (`/create`: "Request a Payment"; `/pay`: "Make a payment"), no
blank skeleton after 10 s, and no uncaught console exceptions.

**S-03 Unknown request link.** Open `/contract-pay` with no `contractId`. Expect "Invalid Payment
Link" / "No payment request ID was provided." Then open
`/contract-pay?contractId=000000000000000000000000`. Expect "Payment Request Not Found".

---

## 2. Amount and fee guidance (no spending)

On `/create` (SELLER), where the guidance box sits under the amount field. `/pay` doesn't show
the box; its amount check is P-01.

**F-01 Empty state.** Clear the amount. Expect "Minimum $1.00 · the fee is shown as you type"
and a "Send a free test instead" link. No fee figure is shown.

**F-02 Below the minimum.** Type `0.5`. Expect "Payment requests start at $1.00." with the free
test link, and the form can't be submitted.

**F-03 Fee is quoted by the factory.** Type `5`. Expect the Fee line to show "…" briefly, then
a figure (the factory's minimum fee, currently −$0.30), and "You receive" equal to amount minus
fee ($4.70). Type `1`. Expect "You receive" $0.70. Record the figures shown, since the factory
sets them. (Typing here creates nothing.)

**F-04 Typing doesn't spam quotes.** With the Network domain enabled, type `1.25` one character
at a time. Expect at most one or two `/api/fee-quote` requests, not one per keystroke.

**F-05 Free test button.** Click "Send a free test instead". Expect the amount becomes `0.001`
and the box reads "Test payment — all fees waived".

**F-06 Fee service unavailable (optional).** Only if you can block `/api/fee-quote` with
`Network.setBlockedURLs`: type `5`. Expect the Fee line to read "shown when you confirm" and
"You receive" to show "…". No made-up figure.

---

## 3. Requesting a payment — `/create` (SELLER)

**C-01 Validation.** Try to continue with: an empty description; a description of 161
characters; amount `0.5`. Expect "Description must be 1-160 characters" and the amount warning,
and no move to the review step. A description of exactly 160 characters is accepted.

**C-02 Release date rules.** Under "When should funds be released?" pick a time in the past.
Expect "Payout time must be in the future". Pick a date more than a year ahead. Expect "Payout
time must be within 1 year". The hint "(Your timezone: …)" shows a timezone.

**C-03 Instant toggle.** Choose "Instantly". Expect the date picker to disappear and "Released
the moment the buyer pays" to show. Switch back to "On a date". Expect the previously picked
date is still there.

**C-04 Review and back.** Fill: amount `0.001`, description `UI test C-04`, release in about 10
minutes. (There is no buyer field: the request is shared afterwards by link, QR or message.) Continue. Expect
"Confirm Request Details" showing the amount, the description and the release time. Use "Back
to payment terms". Expect every field still filled.

**C-05 Create a held request.** From C-04, submit "Create Payment Request". Expect "Payment
request created!" and the "Now send this to your buyer" screen. Record the payment link
(`REQUEST_HELD`). Check that:
  - "Copy link only" puts a `/contract-pay?contractId=…` link on the clipboard (read it back
    with `Runtime.evaluate` `navigator.clipboard.readText()` if permitted, otherwise from the
    page);
  - "Download QR" and "Download PDF" each produce a file (the PDF button shows "Preparing…"
    first);
  - the Email / WhatsApp / Text links open with the link in their body (inspect the `href`; don't
    follow them);
  - "I've sent it" leaves the screen.

**C-06 Create an instant request.** As C-05 but choose "Instantly", description `UI test C-06`.
Record the link as `REQUEST_INSTANT`. Expect the review step to say the release is instant.

**C-07 Custom tiebreaker validation.** Open "Advanced Options", enter `not-an-address` as the
tiebreaker. Expect "Enter a wallet address or an email address for the tiebreaker". Clear it.

**C-08 Request with a custom tiebreaker.** Create a 0.001 request (description `UI test C-08`,
buyer `BUYER_EMAIL`) and, under "Advanced Options", set the tiebreaker to `ARBITER_EMAIL`.
Record as `REQUEST_ARBITER`. Expect the review to show the tiebreaker. An email tiebreaker is
resolved to that person's wallet, so in R-08 the confirm screen shows a wallet address (or the
email) for them, never `SELLER_WALLET` or `BUYER_WALLET`. Then try `SELLER_EMAIL` as the
tiebreaker on a new request: expect "Create Payment Request" to fail with a message that the
tiebreaker can't also be a party (contractservice refuses it before any address is quoted), and
no request to be created.

---

## 4. Paying a request — `/contract-pay` (BUYER)

**R-01 Request page shows the seller's terms.** Needs: C-05. In BUYER open `REQUEST_HELD`.
Expect the request intro with amount 0.001, the description "UI test C-05" and the release date.
The terms can't be edited.

**R-02 Address is confirmed before anything is shown.** Continue to the confirm step. Expect
"Confirm payment", no "We couldn't confirm this payment…" message, and the network panel to show
an `eth_call` to the factory's `getContractAddress` on the build's RPC before the confirm screen
appears. Record the escrow address shown (`ESCROW_HELD`).

**R-03 Every place the address appears agrees.** On the confirm screen, open "Or pay from another
wallet". Expect the address shown, the address encoded in the QR (decode it, or read the
`ethereum:` URI next to it), and `ESCROW_HELD` all to be the same. Don't send anything.

**R-04 Pay from this wallet.** Click "Pay 0.001 USDC from this wallet" (wording may vary
slightly). Approve the **signature** prompt in the wallet. Expect the steps "Approve in your
wallet…" → "Paying into escrow…" → "Paid into escrow", with text naming the release date. No
second prompt.

**R-05 Paid link can't be paid again.** Reload `REQUEST_HELD` in BUYER. Expect "This payment is
complete" / "The funds are already held in escrow for this request." with no pay button.

**R-06 Seller can't pay their own request.** In SELLER open `REQUEST_INSTANT`. Expect "You cannot
make a payment to yourself. …" and no address to pay.

**R-07 Pay an instant request.** Needs: C-06. In BUYER open `REQUEST_INSTANT`, continue, pay
0.001 from this wallet, approve the signature. Expect "Paid into escrow" with the instant wording
("… has been paid to …"), and no dispute window mentioned.

**R-08 Refresh on the confirm step.** Needs: C-08. In BUYER open `REQUEST_ARBITER`, continue to
"Confirm payment", note the address, reload the page. Expect to land back on the same request
with the same escrow address (and the tiebreaker shown). Don't pay unless dave asks; leave it
unpaid for C-09/D tests if useful.

---

## 5. Paying someone directly — `/pay` (BUYER)

**P-01 Validation.** On `/pay`, fill a description and press Continue each time.
"Who are you paying?" = `nonsense`: expect "Enter an email address or a wallet address."
`BUYER_WALLET` (yourself): expect "You cannot make a payment to yourself. …". A valid seller with
amount `0.5`: expect "Enter $1.00 or more, or exactly 0.001 for a free test" under the amount.
None of these reaches the confirm screen.

**P-02 Confirm screen, wallet seller (no spend).** Seller `SELLER_WALLET`, description `UI test
P-02`, amount `0.001`, release about 10 minutes ahead. Continue. Expect "Confirm payment" with
"Paying", "They receive" and "Platform fee" lines (fee 0 on the test amount), and no "couldn't
confirm" message. **Do not pay.** Use the back control, move the release time an hour later,
continue. Expect a **different** escrow address from the first one (the release time is one of
the terms the address depends on).

**P-03 Pay a wallet, held.** Seller `SELLER_WALLET`, description `UI test P-03`, amount `0.001`,
release about 10 minutes ahead. Continue, pay from this wallet, approve the signature. Expect
"Paid into escrow" naming the seller and the release date. Record the escrow as `ESCROW_P03`.
Click "View this payment". Expect the dashboard with that payment visible.

**P-04 Pay an email.** Seller = `SELLER_EMAIL`, amount `0.001`, release about 10 minutes ahead.
Expect the confirm screen to show the email and the payment to complete as in P-03. Record as
`ESCROW_P04`. The email resolves to the SELLER account's wallet, so in SELLER's dashboard the
payment appears against `SELLER_WALLET` (checked in D-01).

**P-05 Instant payment.** As P-03 but choose "Instantly". Expect the confirm screen's release to
read instant, the done screen to say it "has been paid to …", and no dispute option later (see
D-04).

**P-06 Make another payment.** From a done screen click "Make another payment". Expect an empty
form at `/pay`.

**P-07 Refresh on the confirm step.** Fill a 0.001 payment to `SELLER_WALLET`, continue to
"Confirm payment", note the address and the `?resume=` in the URL, reload. Expect the same
confirm screen with the same address. Don't pay.

**P-08 Pay from another wallet panel (no spend).** On any confirm screen open "Or pay from
another wallet". Expect the QR, the address, a copy button, and "I have paid". The address
equals the confirm screen's. Click "I have paid" without sending anything. Expect a "checking"
state that finds no payment and says so, without marking anything as paid.

---

## 6. Merchant checkout link — `/contract-create` (BUYER)

**K-01 Checkout prepares with no form.** Open
`/contract-create?seller=<SELLER_WALLET>&amount=0.001&description=UI%20test%20K-01&order_id=UI-K01&return=https%3A%2F%2Fexample.com%2Fdone`.
(`description` is required: without it the link silently redirects to `/pay`.)
Expect "Setting up your payment…" then a confirm screen with no editable terms and no back
control. No "couldn't confirm" message.

**K-02 Cancel returns to the merchant.** On the K-01 screen click Cancel. Expect navigation to
exactly the return URL (`https://example.com/done`); only WordPress links (`wordpress_source=true`)
get a `payment_status` parameter. Don't pay.

**K-03 Pay a checkout.** Open the K-01 link again (`description=UI%20test%20K-03`, `order_id=UI-K03`), pay from this wallet,
approve the signature. Expect a redirect to the return URL. Then in SELLER's dashboard the
payment appears with description "UI test K-03".

---

## 7. Dashboard

**D-01 Both sides see the payments.** Needs: R-04, P-03. In SELLER and BUYER open `/dashboard`.
Expect both to list the R-04 and P-03 escrows with amount 0.001 and the right counterparty, and
the filters "All", "Active", "Action Needed", "Completed", "Disputed" each show a sensible subset
(held payments under Active, instant ones under Completed).

**D-02 Details.** Open the P-03 escrow's details. Expect the escrow address `ESCROW_P03`, the
release time, the description and the state. The address links to the block explorer for the
right chain.

**D-03 Raise a dispute (buyer).** Needs: P-03, before its release time. In BUYER, raise a
dispute on `ESCROW_P03` with reason text `UI test dispute — please ignore` and a refund
percentage of 100. Note the "Don't include names, addresses or contact details" guidance.
This is a buyer **transaction** paying a small Base gas fee (under $0.01 in ETH) — check the
buyer has some ETH. Expect "Raising dispute..." to finish, and the escrow to show as Disputed in
BUYER and SELLER; the dashboards can take several minutes to catch up with the chain, so check
`isDisputed()` on-chain too.

**D-04 Instant payments can't be disputed.** Needs: P-05 or R-07. Open the instant escrow's
details in BUYER. Expect no dispute action.

**D-05 Claim after release (seller, long-running).** Needs: P-04 (not disputed). After its
release time has passed, in SELLER open the dashboard. Expect the escrow under "Action Needed"
with a claim action (or already released automatically). Claim it if offered and approve any
prompt. Expect it to move to Completed and the 0.001 (less any fee, which is zero on the test
amount) to arrive in the seller's wallet.

**D-06 Seller sees disputed.** Needs: D-03. In SELLER, the P-03 escrow shows Disputed, with a way
to respond or see the dispute.

---

## 8. Layout

**L-01 Phone width.** With `Emulation.setDeviceMetricsOverride` at 390×844 (mobile), take a
screenshot (and wait ~300 ms after it, before measuring) of `/create`, `/pay`, a confirm screen
and `/dashboard`. Expect no horizontal scroll (`document.documentElement.scrollWidth <=
innerWidth`), readable text and tappable buttons. Reset the override afterwards.

**L-02 Dark mode.** The app follows `localStorage.theme` before the system setting; if it is
`light`, set it to `dark` for the test and restore it afterwards (or use `setEmulatedMedia`
`prefers-color-scheme: dark` when no theme is stored). Screenshot the same pages. Expect no unreadable text (dark on dark) or invisible inputs. Reset afterwards.

---

## Not covered here

- Disputes beyond raising one (voting, arbiter resolution, the dispute service).
- Marketplace (selling early) and Projects.
- Landing pages, white-label looks and the Spanish locale.
- Anything that needs an amount other than 0.001 to go on-chain.
