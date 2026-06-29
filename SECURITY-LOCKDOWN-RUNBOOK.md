# Production lockdown runbook — onboarding a junior dev safely

Goal: a junior developer can push branches, open PRs, and deploy to **test**
environments, but **cannot deploy to the live site or change the guardrails.**

> **Status: APPLIED on 2026-06-29** by `charliepank` (org admin).
> Steps 1, 2, and 4 are live. Step 3 (adding the junior collaborator) was
> deliberately **not** run yet — do it when you have their GitHub username.
> This file now doubles as the **as-built reference**; re-running the commands
> is idempotent-ish but will error on "already exists" for the rulesets/policies.

## Background (how deploys actually work here)

`.github/workflows/build.yml` deploys **only on tag push** — never on a branch
push. The tag prefix selects the GitHub *environment* (and therefore which
secrets/VM get used):

| Tag pattern        | Environment     | Notes                                  |
|--------------------|-----------------|----------------------------------------|
| `cherry*`          | `cherry`        | **THE LIVE PRODUCTION INSTALLATION**   |
| `v*`               | `production`    | Second prod-style target (lock too)    |
| `test*`            | `test`          | Fine for junior to use                 |
| `farcaster-test*`  | `test_on_prod`  | Runs prod-ish config — NOT gated (see below) |
| anything else      | `test`          | —                                      |

### State BEFORE lockdown (verified 2026-06-29, pre-change)
- All four environments had **no protection rules** and `can_admins_bypass: true`.
- A ruleset `protect-main` (id `10513016`) locked the default branch against
  force-push / deletion / direct create+update, but had **no PR-review rule**.
- **No tag ruleset existed** — anyone with Write could create a `cherry*`/`v*`
  tag and ship straight to prod.

### State AFTER lockdown (as-built, what's live now)
- `cherry` env: required reviewer = `charliepank` (id `6232906`) + tag deploy
  policy `cherry*`. `prevent_self_review: false`.
- `production` env: required reviewer = `charliepank` + tag deploy policy `v*`.
- Ruleset `protect-release-tags` (id **`18236347`**, target `tag`): blocks
  creation/update/deletion of `refs/tags/cherry*` and `refs/tags/v*`.
- Ruleset `protect-main` (id `10513016`) now also requires **1 PR approval**
  (dismiss stale reviews on push) on top of the original four rules.
- `farcaster-test*` is **NOT** gated (decision: left open for now).

All commands below require an **admin** token for `conduit-ucpi/webapp`.

### Key facts / IDs for this repo
| Thing                          | Value                                  |
|--------------------------------|----------------------------------------|
| Owner                          | `conduit-ucpi` (Organization)          |
| Your reviewer user id          | `6232906` (`charliepank`)              |
| `protect-main` ruleset id      | `10513016`                             |
| `protect-release-tags` ruleset id | `18236347`                          |

> **Gotcha — the `OrganizationAdmin` bypass actor uses `actor_id: null`, not
> `1`.** The API accepts `actor_id: 1` for the `OrganizationAdmin` role but
> **normalizes it to `null`** (matching the pre-existing `protect-main`
> ruleset). When editing a ruleset via PUT, carry `null` through or you'll fight
> a phantom diff. The bypass is **org-wide** — *any* org admin can bypass these
> rules, not just you. This stops a *junior* (Write role), not a fellow admin.

---

## Step 0 — look up IDs you'll need

```bash
# Your own GitHub user id (becomes the required reviewer):
gh api users/<YOUR_GH_USERNAME> --jq .id      # -> REVIEWER_ID (6232906 for charliepank)

# Confirm you have admin on the repo:
gh api repos/conduit-ucpi/webapp --jq .permissions

# Confirm owner type + the valid bypass-actor shape from an existing ruleset:
gh api repos/conduit-ucpi/webapp --jq '.owner.type,.owner.login'
gh api repos/conduit-ucpi/webapp/rulesets/10513016 --jq '.bypass_actors'
```

---

## Step 1 — Require YOUR approval before any prod deploy (most important) — ✅ APPLIED

This makes a deploy *pause and wait for you* even if a release tag is pushed.
Repeat the block for both `cherry` and `production`.

```bash
# --- cherry (the live one) ---
gh api -X PUT repos/conduit-ucpi/webapp/environments/cherry --input - <<'JSON'
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [{"type": "User", "id": 6232906}],
  "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}
}
JSON

# Restrict which tags may deploy to cherry (defence in depth):
gh api -X POST repos/conduit-ucpi/webapp/environments/cherry/deployment-branch-policies \
  -f name='cherry*' -f type='tag'

# --- production (v*) ---
gh api -X PUT repos/conduit-ucpi/webapp/environments/production --input - <<'JSON'
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [{"type": "User", "id": 6232906}],
  "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}
}
JSON

gh api -X POST repos/conduit-ucpi/webapp/environments/production/deployment-branch-policies \
  -f name='v*' -f type='tag'
```

Notes:
- `prevent_self_review: false` lets *you* cut a tag and approve your own deploy.
  Set it to `true` only once you have a second trusted approver.
- `wait_timer` is minutes of forced delay; leave at 0.
- Re-running the `deployment-branch-policies` POST will error if the policy
  already exists — that's expected on a re-run.

---

## Step 2 — Stop the junior from creating release tags at all — ✅ APPLIED (id `18236347`)

A tag ruleset so only org admins can create/update/delete `cherry*` and `v*`
tags. (To also gate `test_on_prod`, add `refs/tags/farcaster-test*` to the
include list — currently **not** done.)

> Already created as id `18236347`. To re-create from scratch, delete it first
> (see Rollback) — a second POST with the same name will 422. To **edit** the
> existing one (e.g. add `farcaster-test*`), use `PUT .../rulesets/18236347`
> with the full body and `bypass_actors` of `actor_id: null`.

```bash
gh api -X POST repos/conduit-ucpi/webapp/rulesets --input - <<'JSON'
{
  "name": "protect-release-tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": {"include": ["refs/tags/cherry*", "refs/tags/v*"], "exclude": []}
  },
  "rules": [
    {"type": "creation"},
    {"type": "update"},
    {"type": "deletion"}
  ],
  "bypass_actors": [
    {"actor_id": null, "actor_type": "OrganizationAdmin", "bypass_mode": "always"}
  ]
}
JSON
```

After this: a Write-role junior pushing `cherry-1.2.3` gets rejected by the
server. Org admins (you) still cut releases normally.

---

## Step 3 — Give the junior the WRITE role (not Admin/Maintain) — ⏳ NOT YET DONE

Write lets them push branches + open PRs, but **cannot** read or edit secrets,
environments, rulesets, or workflow files' protections. Run this when you have
the junior's GitHub username.

```bash
gh api -X PUT repos/conduit-ucpi/webapp/collaborators/<JUNIOR_GH_USERNAME> \
  -f permission=push      # "push" == Write
```

---

## Step 4 — Require a PR review to land on `main` — ✅ APPLIED

Updates the existing `protect-main` ruleset, preserving its current rules and
adding a 1-approval requirement. (PUT replaces the ruleset, so the full rule
list **and** `bypass_actors` are included — note `actor_id: null`.)

```bash
gh api -X PUT repos/conduit-ucpi/webapp/rulesets/10513016 --input - <<'JSON'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
  "bypass_actors": [{"actor_id": null, "actor_type": "OrganizationAdmin", "bypass_mode": "always"}],
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "creation"},
    {"type": "update"},
    {"type": "pull_request", "parameters": {
      "required_approving_review_count": 1,
      "dismiss_stale_reviews_on_push": true,
      "require_code_owner_review": false,
      "require_last_push_approval": false,
      "required_review_thread_resolution": false
    }}
  ]
}
JSON
```

---

## Verify

```bash
gh api repos/conduit-ucpi/webapp/environments/cherry      --jq '.protection_rules'
gh api repos/conduit-ucpi/webapp/environments/production  --jq '.protection_rules'
gh api repos/conduit-ucpi/webapp/rulesets --jq '.[].name'
gh api repos/conduit-ucpi/webapp/collaborators/<JUNIOR_GH_USERNAME>/permission --jq .permission
```

Expect (as-built):
- non-empty `protection_rules` on both prod envs (`required_reviewers` + `branch_policy`);
- `rulesets` lists both `protect-main` and `protect-release-tags`;
- (once Step 3 is run) junior permission == `write`.

Verified live on 2026-06-29: both prod envs returned 2 protection rules each;
both rulesets present and `active`.

---

## Rollback

```bash
# Remove the release-tag ruleset
gh api -X DELETE repos/conduit-ucpi/webapp/rulesets/18236347

# Strip the PR-review rule from protect-main (re-PUT without the pull_request rule) —
# safest to re-PUT the original 4-rule body rather than DELETE the whole ruleset.

# Clear required reviewers + tag policy on an environment
gh api -X PUT repos/conduit-ucpi/webapp/environments/cherry --input - <<'JSON'
{"reviewers": [], "deployment_branch_policy": null}
JSON
gh api -X PUT repos/conduit-ucpi/webapp/environments/production --input - <<'JSON'
{"reviewers": [], "deployment_branch_policy": null}
JSON
```
