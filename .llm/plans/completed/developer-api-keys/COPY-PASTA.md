# Developer API keys — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run developer-api-keys`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run developer-api-keys --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase share no
file, and a prompt that shares its phase does not write the release scratchpad: it puts its entry
in its final message, and prompt 42 appends them. Running them one after the other is also
correct.

This set branches from `feature/combined`, and its PR targets `feature/combined`.

Before Phase 2, start Docker: plan 11 regenerates the linear baseline archives. Plan 11 takes app
migration `0031`, because the popularity anti-gaming branch owns `0027` through `0030` and merges
into `feature/combined` first. Any other set that adds an app migration collides on that number,
and whichever branch merges second renumbers and reruns `make db_regen_linear_baseline`.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10 | Cursor Grok 4.7 high |
| 2 | 11, 14 | Cursor Grok 4.7 extra high |
| 3 | 12 | Opus 5.5 high |
| 4 | 13 | Cursor Grok 4.7 extra high |
| 5 | 20, 30, 40, 50 | 20 and 50 Cursor Grok 4.7 extra high; 30 and 40 Cursor Grok 4.7 high |
| 6 | 21, 22, 23, 31, 41, 51 | 21, 23, 31 Cursor Grok 4.7 high; 22, 41, 51 Cursor Grok 4.7 extra high |
| 7 | 42 | Cursor Grok 4.7 extra high |

Why the expensive one: 12 is the auth branch every later API prompt builds on. It tells a key
from a session JWT, rejects keys while membership is expired, keeps routes closed to keys unless
they declare `apiKeyAccess`, and must never let a key do more than its owner. The extra high
Grok prompts carry persisted data (11), credentials and auth scope (13, 14, 20, 22), edits deep in
the 19.5k-line `openapi.yml` (50, 51), or a large navigator other prompts mount into (41, 42).
Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — Shared CRUD bitmask and API key model in @podverse/helpers**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/developer-api-keys/10-api-key-shared-model.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D2, D4, D5, D6, D10, D12, D37).
Every later prompt imports these names, so keep them exactly as the plan writes them:
API_KEY_SUPPORTED_ACTIONS and apiKeyResourceSupportsAction (eight unsupported cells),
API_KEY_MAX_PER_ACCOUNT 20, presets that store the full mask, and crudBitmask.ts, which the
management code switches to in plan 14.
Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 10-api-key-shared-model.md to .llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

Docker must be running: plan 11 regenerates the baseline archives.

- [x] **11 — account_api_key table, entity, and ORM service**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/11-api-key-table-and-orm.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D2, D3, D5, D7).
Store only the SHA-256 hash of the token; revoking deletes the row; the row cascades on account
delete. The migration is 0031_account_api_key.sql; 0027-0030 belong to the popularity
anti-gaming branch, so the gap after 0026_ is expected. If 0031_* already exists in
linear-migrations/app/, stop and report instead of renumbering. Run make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If
Docker is not available, finish the rest of the plan, leave the archives untouched, and report
BLOCKED asking the operator to start Docker.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 11-api-key-table-and-orm.md to .llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **14 — Management API and management web use the shared CRUD bitmask**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/14-management-shared-crud-bitmask.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D4, D12).
No behavior change and no management API keys: the management API answers a pvk_ Bearer token
with 401, even beside a valid admin cookie. Delete apps/management-api/src/lib/crud.test.ts as
the plan says; requireCrud.test.ts and admins-new-permissions-templates.spec.ts stay unchanged.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. The plan has no release scratchpad entry; do
not edit release-notes/scratchpad.md.
When the plan is done, move 14-management-shared-crud-bitmask.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [x] **12 — API key branch in API auth**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/developer-api-keys/12-api-key-auth-branch.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D4, D7, D8, D9, D11).
A key authenticates as its owner only and never does more than the owner can as a signed-in
user: same terms, membership, and requiredCapability checks, and only on routes that declare
apiKeyAccess. While the owner's membership is expired, keys are rejected on every route,
including skipMembershipStatus routes. Later prompts rely on req.user.api_key,
getAuthenticatedSessionIdText, the apiKeyAuth scheme, and x-api-key-permission on GET /auth/me.
The management API 401 test belongs to plan 14, which already ran.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 12-api-key-auth-branch.md to .llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [x] **13 — Create, list, and revoke key endpoints and request calls**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/13-api-key-endpoints-and-requests.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D3, D6, D9, D10).
The key endpoints accept a session only, never a key. An expired account can list and revoke but
not create. The 21st key, expired ones included, gets 409 api_key_limit_reached. Keys survive
password change, password reset, and admin sign-out. Keep plan 12's edits in apiKeyStore.ts and
openapi.yml.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 13-api-key-endpoints-and-requests.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

Each prompt below owns only the files its plan lists; 00-EXECUTION-ORDER.md § Phase 5 names them.
Plan 20's edit to packages/helpers/src/lib/apiKey.ts is a comment only.

- [x] **20 — Shared route-access groundwork and never-allowed routes**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/20-api-key-route-access-shared.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D13–D22, D37).
Edit no controller (plans 21–23 label them) and not openapi.yml. /stats/listen and /stats/open
stay closed to keys. The route-to-permission table in your plan is the source plans 21–23 and 51
copy; do not change it. In apiKey.ts, edit only the doc comment above API_KEY_RESOURCES.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. The plan has no release scratchpad entry; do
not edit release-notes/scratchpad.md.
When the plan is done, move 20-api-key-route-access-shared.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **30 — Web Settings Developer tab: list and revoke**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/developer-api-keys/30-web-developer-tab-list-revoke.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D23–D29, D37, D38).
The tab is /settings?tab=developer, signed-in only, after Advanced and before Keyboard. Link to
{api base}/docs and {api base}/docs.yaml. Add every settings.developer.* key with targeted
insertions in the consumer originals; plan 31 and mobile plan 41 reuse them. You are the only
prompt in this phase that runs npm run i18n:compile.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 30-web-developer-tab-list-revoke.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **40 — Mobile API key helpers and docs URLs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/developer-api-keys/40-mobile-api-key-helpers.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D29–D32, D37).
Helpers only, no screen. Build both docs URLs from the API base the app is using. Plans 41 and 42
call fetchAccountApiKeys, createAccountApiKey, revokeAccountApiKey, toApiKeyListRows,
apiKeyCreateAccess, apiDocsUrl, apiDocsYamlUrl, and API_KEY_EXPIRATION_CHOICES. Mobile reads
built packages, so plans 10 and 13's exports come from dist.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. The plan has no release scratchpad entry; do
not edit release-notes/scratchpad.md.
When the plan is done, move 40-mobile-api-key-helpers.md to .llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **50 — OpenAPI route parity, public process routes, and required page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/50-openapi-route-parity.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D33–D35).
Document /, /health, /health/ready, /meta, /docs, and /docs.yaml with security: []. Mark page
required wherever the validator requires it. openapi.yml is large: Grep by path and component
name, and keep plans 12 and 13's apiKeyAuth scheme and key endpoints. Do not add apiKeyAuth to
any operation; plan 51 does that.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 50-openapi-route-parity.md to .llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

Each prompt below owns only the files its plan lists; 00-EXECUTION-ORDER.md § Phase 6 names them.

- [x] **21 — Key access on playlist, queue, and clip routes**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/developer-api-keys/21-api-key-route-access-playlists-queue-clips.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D13–D15).
Copy plan 20's route table for your routes exactly; plan 20 is in
.llm/plans/completed/developer-api-keys/. Use plan 20's apiKeyTestAccounts.ts helper; do not
edit it. Edit only the playlist, queue, and clip controllers.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 21-api-key-route-access-playlists-queue-clips.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **22 — Key access on account, subscription, and Add by RSS routes**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/22-api-key-route-access-account-subscriptions-add-by-rss.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D16–D18, D20).
Copy plan 20's route table for your routes exactly (plan 20 is in
.llm/plans/completed/developer-api-keys/); wrappers and handlers must agree. Password,
email, account delete, and data export stay closed to keys. Keep plan 12's edits in
controllers/account/account.ts. Use plan 20's apiKeyTestAccounts.ts helper; do not edit it.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 22-api-key-route-access-account-subscriptions-add-by-rss.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **23 — Key access on settings, notification, and history routes**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/developer-api-keys/23-api-key-route-access-settings-notifications-history.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D19, D21, D22).
Copy plan 20's route table for your routes exactly (plan 20 is in
.llm/plans/completed/developer-api-keys/). Do not edit stats/statsListen.ts,
stats/statsOpen.ts, or statsTrackRateLimit; the listen-stats consent route stays closed. Use plan
20's apiKeyTestAccounts.ts helper; do not edit it.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 23-api-key-route-access-settings-notifications-history.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **31 — Web Developer tab: create a key**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/developer-api-keys/31-web-developer-create-key.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D26–D29, D37).
The form opens on Read Only and 90 days; unsupported cells render a dash; the secret shows once.
An expired account keeps the expired copy; an account that never had a membership sees API Keys
Require a Membership with Buy Membership. Use plan 30's settings.developer.* keys; edit no
catalog and do not run npm run i18n:compile. Keep plan 30's edits in SettingsDeveloper.tsx and
settings-developer.spec.ts, and append your tests to that spec.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 31-web-developer-create-key.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **41 — Mobile More → Settings → Developer list screen**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/41-mobile-developer-list-screen.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D29–D32, D38).
Reuse plan 30's consumer settings.developer.* keys. Add only the three mobile-only leaves
(menu_subtitle, docs_unavailable, spec_copy_hint) to the mobile originals with targeted
insertions; there is no settings.account.api_keys set. One row opens {api base}/docs in the
system browser; a second copies the {api base}/docs.yaml URL. navigation/index.tsx is large:
anchor on MoreSettingsSessions, and do not import the create screen; plan 42 does. You are the
only prompt in this phase that runs npm run i18n:compile.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 41-mobile-developer-list-screen.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **51 — OpenAPI key security and permission on each operation**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/51-openapi-api-key-permissions.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D36, D37).
Read plan 20's route table from .llm/plans/completed/developer-api-keys/ (prompt 20 moved it
there), not from the controllers plans 21–23 are editing. The expansion is
161 operations; if it is not, stop and report the section that does not match. Keep
apiKeyAuth out of the document-level security block, and keep plans 12, 13, and 50's edits in
openapi.yml.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 42
appends it.
When the plan is done, move 51-openapi-api-key-permissions.md to
.llm/plans/completed/developer-api-keys/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

- [x] **42 — Mobile create key screen; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/developer-api-keys/42-mobile-developer-create-screen.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D29, D31, D37, D38).
A new key starts as Read Only and 90 days; unsupported cells render a dash; the secret shows
once with Copy. Use plan 30's and 41's catalog keys and edit no catalog. Keep plan 41's edits in
navigation/index.tsx. Register settings-developer in flow_needs_e2e_api in
scripts/mobile/e2e-test.sh.
Do not run tests. Append the plan's release scratchpad entry.

Before your own entry, append to release-notes/scratchpad.md every "Release notes entry" from
the final messages of prompts 11, 30, 50, 21, 22, 23, 31, 41, and 51 in
.artifacts/plan-runner/developer-api-keys/ (11.md, 30.md, …), in that order, unchanged. Skip one
that already appears in the scratchpad. Prompts 10, 14, 20, and 40 have no entry; 12 and 13
appended their own.

Then close the set. Move 42-mobile-developer-create-screen.md to
.llm/plans/completed/developer-api-keys/ and confirm every other numbered plan is there. Move
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory. If prompt 11 reported the linear baseline archives were not regenerated,
put make db_regen_linear_baseline first in the Root block.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that
Docker, Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must be
running, and that Mobile E2E API must be restarted after make test_deps and the package build so
it serves the key routes. Do not put leave-running commands in the blocks. Note that no plan adds
a dependency, so there is no lockfile step.

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run openapi:check
npm run test:unit
npm --prefix apps/mobile run test
make db_verify_linear_baseline
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
make e2e_test_report_scoped WEB_SPEC=e2e/settings-developer.spec.ts,e2e/settings-account-sessions.spec.ts MGMT_SPEC=e2e/admins-new-permissions-templates.spec.ts,e2e/admins-list.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- settings-developer,auth-sessions
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
