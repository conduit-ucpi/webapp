# Production lockdown runbook — onboarding a junior dev safely

Goal: a junior developer can push branches, open PRs, and deploy to **test**
environments, but **cannot deploy to the live site or change the guardrails.**

## Background (how deploys actually work here)

`.github/workflows/build.yml` deploys **only on tag push** — never on a branch
push. The tag prefix selects the GitHub *environment* (and therefore which
secrets/VM get used):

| Tag pattern        | Environment     | Notes                                  |
|--------------------|-----------------|----------------------------------------|
| `cherry*`          | `cherry`        | **THE LIVE PRODUCTION INSTALLATION**   |
| `v*`               | `production`    | Second prod-style target (lock too)    |
| `test*`            | `test`          | Fine for junior to use                 |
| `farcaster-test*`  | `test_on_prod`  | Runs prod-ish config — consider gating |
| anything else      | `test`          | —                                      |

Current state (verified 2026-06-29):
- All four environments have **no protection rules** and `can_admins_bypass: true`.
- A ruleset `protect-main` (id `10513016`) locks the default branch against
  force-push / deletion / direct create+update, but has **no PR-review rule**.
- **No tag ruleset exists** — anyone with Write can create a `cherry*`/`v*` tag
  and ship straight to prod.

All commands below require an **admin** token for `conduit-ucpi/webapp`.
(The `gh` login used during analysis was read-only and cannot apply these.)

---

## Step 0 — look up IDs you'll need

```bash
# Your own GitHub user id (becomes the required reviewer):
gh api users/<YOUR_GH_USERNAME> --jq .id      # -> REVIEWER_ID

# Confirm you have admin on the repo:
gh api repos/conduit-ucpi/webapp --jq .permissions
```

---

## Step 1 — Require YOUR approval before any prod deploy (most important)

This makes a deploy *pause and wait for you* even if a release tag is pushed.
Repeat the block for both `cherry` and `production`.

```bash
# --- cherry (the live one) ---
gh api -X PUT repos/conduit-ucpi/webapp/environments/cherry --input - <<'JSON'
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [{"type": "User", "id": REVIEWER_ID}],
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
  "reviewers": [{"type": "User", "id": REVIEWER_ID}],
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

---

## Step 2 — Stop the junior from creating release tags at all

A tag ruleset so only org admins can create/update/delete `cherry*` and `v*`
tags. (Optionally add `refs/tags/farcaster-test*` to the include list.)

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
    {"actor_id": 1, "actor_type": "OrganizationAdmin", "bypass_mode": "always"}
  ]
}
JSON
```

After this: a Write-role junior pushing `cherry-1.2.3` gets rejected by the
server. Org admins (you) still cut releases normally.

---

## Step 3 — Give the junior the WRITE role (not Admin/Maintain)

Write lets them push branches + open PRs, but **cannot** read or edit secrets,
environments, rulesets, or workflow files' protections.

```bash
gh api -X PUT repos/conduit-ucpi/webapp/collaborators/<JUNIOR_GH_USERNAME> \
  -f permission=push      # "push" == Write
```

---

## Step 4 — Require a PR review to land on `main` (optional but recommended)

Updates the existing `protect-main` ruleset, preserving its current rules and
adding a 1-approval requirement. (PUT replaces the ruleset, so the full rule
list is included.)

```bash
gh api -X PUT repos/conduit-ucpi/webapp/rulesets/10513016 --input - <<'JSON'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
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

Expect: non-empty `protection_rules` on both prod envs; a `protect-release-tags`
ruleset listed; junior permission == `write`.

---

## Rollback

```bash
# Remove a ruleset (use the id from the list command)
gh api -X DELETE repos/conduit-ucpi/webapp/rulesets/<ID>

# Clear required reviewers on an environment
gh api -X PUT repos/conduit-ucpi/webapp/environments/cherry --input - <<'JSON'
{"reviewers": [], "deployment_branch_policy": null}
JSON
```
