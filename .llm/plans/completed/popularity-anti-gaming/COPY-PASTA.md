# Popularity anti-gaming — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and areas:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run popularity-anti-gaming`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run popularity-anti-gaming --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase share no
file, and none of them writes the release scratchpad: each puts its entry in its final message,
and a later prompt appends them. Running them one after the other is also correct.

Start Docker before Phase 3 and keep it running through Phase 8: plans 11, 14, 30, and 40
regenerate the linear baseline archives.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 20 | Opus 5.5 high |
| 2 | 10, 13 | 10 Opus 5.5 high; 13 Cursor Grok 4.7 medium |
| 3 | 11 | Opus 5.5 high |
| 4 | 12 | Cursor Grok 4.7 high |
| 5 | 14 | Opus 5.5 high |
| 6 | 30 | Opus 5.5 high |
| 7 | 31, 33 | 31 Cursor Grok 4.7 high; 33 Cursor Grok 4.7 medium |
| 8 | 32, 40, 42 | 32 Cursor Grok 4.7 high; 40 Opus 5.5 high; 42 Cursor Grok 4.7 medium |
| 9 | 41 | Opus 5.5 high |

Why the expensive ones: 20 is a rename with many callers across api, web, mobile, env, and legal
that every later plan builds on; 10 is the write path's per-listener lock and the new answer both
clients receive; 11, 14, 30, and 40 are schema migrations on the write path, and 14 changes what
opt-out deletes; 30 is the flagging design and the listener-id privacy boundary; 41 rewrites the
range job's SQL against events and the channel merge. Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **20 — Rename the opt-in from Popularity Tracking to Taste Profile**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/20-taste-profile-opt-in-rename.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md § Review of the first
planning pass (D37). No agreement or terms version bump.
Every later plan is written against the names in this plan's "Old and new names" table; use them
exactly. Keep the legal anchor sentences word for word except the one Greek anchor the plan names.
Run npm run i18n:compile after editing the originals, and run the plan's two rg self-checks.
Mobile is outside the root workspaces; reach it with npm --prefix apps/mobile.
You run alone in this phase. Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 20-taste-profile-opt-in-rename.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, the self-check results, any name that
differs from the plan's table, any blocker, and anything a later prompt needs.
```

## Phase 2

Prompt 10 owns the listen write path, the API config and env files, OpenAPI, the stats doc, and
the two API stats tests. Prompt 13 owns the eight legal Markdown files.

- [x] **10 — Minimum interval between new listens (`too_soon`)**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/10-listen-min-interval.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (flat 20-second floor,
answered as a 2xx too_soon; D1–D4). Plan 20 has run; use its names.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 11 appends it.
When the plan is done, move 10-listen-min-interval.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **13 — Legal copy for the listen interval, the two listen caps, and the open cap**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/popularity-anti-gaming/13-legal-copy-listen-and-open-limits.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md. Plan 20 has run: the
agreement files are in apps/api/legal/taste-profile-agreement/, and the feature is named Taste
Profile (Greek neuter). Do not change TASTE_PROFILE_AGREEMENT_VERSION or the terms version.
Another prompt runs at the same time; edit only the eight legal Markdown files your plan lists.
Do not run tests. Do not edit release-notes/scratchpad.md: put the plan's release scratchpad
entry in your final message under "Release notes entry". Prompt 11 appends it.
When the plan is done, move 13-legal-copy-listen-and-open-limits.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, any anchor sentence you could not find,
any blocker, and anything a later prompt needs.
```

## Phase 3

- [x] **11 — Two daily listen caps: popularity (100) and stored (300)**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/11-listen-popularity-and-stored-caps.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D5: STATS_LISTEN_DAILY_CAP
goes away; STATS_LISTEN_DAILY_STORED_CAP 300 and STATS_LISTEN_DAILY_POPULARITY_CAP 100).
List the app migrations directory first; the migration is 0027_ and must be the next free number.
Move the marker in both api.env and infra/k8s/base/ops/kustomization.yaml. Run
make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest of the plan, leave the archives untouched, and report BLOCKED asking
the operator to start Docker.
You run alone in this phase. Do not run tests.
Before your own entry, append to release-notes/scratchpad.md the "Release notes entry" from the
final messages of prompts 10 and 13 (.artifacts/plan-runner/popularity-anti-gaming/10.md and
13.md), in that order, unchanged. Skip one that already appears. Then append your own.
When the plan is done, move 11-listen-popularity-and-stored-caps.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed (including the migration file name),
self-check results, any blocker, and anything a later prompt needs.
```

## Phase 4

- [x] **12 — Daily cap on counted profile and playlist opens**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/12-open-daily-cap.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (10 counted opens per
listener per UTC day, profiles and playlists combined; D8). Plans 10 and 11 have run on the same
config, env files, OpenAPI, and tests; add beside their lines, do not rewrite them.
You run alone in this phase. Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 12-open-daily-cap.md to .llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

- [x] **14 — Opting out and back in resets no limits; popularity cooldown after an opt-out**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/14-opt-out-popularity-cooldown.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D33). Plans 10, 11, 12,
and 20 have run; use the code and names they leave.
List the app migrations directory first; the migration is 0028_ and must be the next free number.
Move the marker in both api.env and infra/k8s/base/ops/kustomization.yaml. Run
make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest of the plan, leave the archives untouched, and report BLOCKED asking
the operator to start Docker.
You run alone in this phase. Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 14-opt-out-popularity-cooldown.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed (including the migration file name and
the final names of readTrackingConsentForUpdate, isInOptOutCooldown, and readOptOutDayCarry),
self-check results, any blocker, and anything a later prompt needs.
```

## Phase 6

- [x] **30 — Auto-flag botted listeners and leave them out of popularity**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/30-listener-flagging-and-exclusion.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D10–D19, D34–D36). Flags
are keyed by listener_id only; follow .cursor/rules/popularity-listener-id-separation.mdc. Plans
10, 11, 12, 14, and 20 have run; use the code and names they leave.
List the app migrations directory first; the migration is 0029_ and must be the next free number.
Move the marker in both api.env and infra/k8s/base/ops/kustomization.yaml. Run
make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest of the plan, leave the archives untouched, and report BLOCKED asking
the operator to start Docker.
You run alone in this phase. Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 30-listener-flagging-and-exclusion.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed (including the migration file name and the
flag and signal table columns), self-check results, any blocker, and anything a later prompt needs.
```

## Phase 7

Prompt 31 owns the management API files, `packages/management-api-requests/src/stats.ts`, the
listener-id separation rule, and `docs/features/POPULARITY-AND-TASTE-PROFILE.md`. Prompt 33 owns the eight
legal Markdown files.

- [x] **31 — Management API: list flagged listeners and clear a flag**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/31-management-api-flagged-listeners.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D17, D19). Read the flag
tables plan 30 created as they are in the tree; no query may touch listener_identity or any
account table.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 41 appends it.
When the plan is done, move 31-management-api-flagged-listeners.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, the request helper names prompt 32 will
import, self-check results, any blocker, and anything a later prompt needs.
```

- [x] **33 — Legal copy: listening that looks automated**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/popularity-anti-gaming/33-legal-copy-automated-listening.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D20, D32). Plans 20 and
13 have run on these files; edit them as those plans left them. No version bump.
Another prompt runs at the same time; edit only the eight legal Markdown files your plan lists.
Do not run tests. Do not edit release-notes/scratchpad.md: put the plan's release scratchpad
entry in your final message under "Release notes entry". Prompt 41 appends it.
When the plan is done, move 33-legal-copy-automated-listening.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, any anchor sentence you could not find,
any blocker, and anything a later prompt needs.
```

## Phase 8

Prompt 32 owns the management-web files, the management i18n originals, and the two management
E2E specs. Prompt 40 owns migration `0030_`, the readiness marker, the baseline archives, the
stats entities, the listen and open write services, the channel merge, the API config, env, and
startup validation, `docs/features/POPULARITY-AND-TASTE-PROFILE.md`, and its three API tests. Prompt 42
owns the eight legal Markdown files.

- [x] **32 — Management web: Flagged Listeners page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/32-management-web-flagged-listeners-page.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D19). Use the request
helpers prompt 31 added in packages/management-api-requests/src/stats.ts; read prompt 31's final
message in .artifacts/plan-runner/popularity-anti-gaming/31.md for their names.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. In the management i18n originals, insert only your keys.
Do not run tests. Do not edit release-notes/scratchpad.md: put the plan's release scratchpad
entry in your final message under "Release notes entry". Prompt 41 appends it.
When the plan is done, move 32-management-web-flagged-listeners-page.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **40 — All-time totals count a listener once per entity per N days**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/40-all-time-once-per-recount-days.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D21–D24, D31: startup
fails when STATS_ALL_TIME_RECOUNT_DAYS is greater than STATS_TRACK_EVENT_RETENTION_DAYS, no
clamp). Plan 14 already added the STATS_ALL_TIME_RECOUNT_DAYS key and its plumbing; reuse it.
List the app migrations directory first; the migration is 0030_ and must be the next free number.
Move the marker in both api.env and infra/k8s/base/ops/kustomization.yaml. Run
make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest of the plan, leave the archives untouched, and report BLOCKED asking
the operator to start Docker.
Other prompts run at the same time; edit only the files your plan lists, and scope any
type-check, build, or formatter to them. Do not run tests. Do not edit
release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message under
"Release notes entry". Prompt 41 appends it.
When the plan is done, move 40-all-time-once-per-recount-days.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed (including the migration file name and
the new column names), self-check results, any blocker, and anything prompt 41 needs.
```

- [x] **42 — Legal copy: how each list counts, which counts stay, and the opt-out cooldown**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/popularity-anti-gaming/42-legal-copy-range-counts.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D28, D33). Plans 20, 13,
and 33 have run on these files; edit them as those plans left them. No version bump.
Other prompts run at the same time; edit only the eight legal Markdown files your plan lists.
Do not run tests. Do not edit release-notes/scratchpad.md: put the plan's release scratchpad
entry in your final message under "Release notes entry". Prompt 41 appends it.
When the plan is done, move 42-legal-copy-range-counts.md to
.llm/plans/completed/popularity-anti-gaming/.
End without a verification block: report what changed, any anchor sentence you could not find,
any blocker, and anything a later prompt needs.
```

## Phase 9

- [x] **41 — Day, week, and month counts are distinct listeners, from events; then archive the set**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/popularity-anti-gaming/41-range-windows-distinct-listeners.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D25–D30). Plans 11, 14,
30, and 40 have run; read the popularity_counted columns, stats_flagged_listener (cleared_at IS
NULL), and plan 40's all-time columns as they are in the tree. Read prompt 40's final message in
.artifacts/plan-runner/popularity-anti-gaming/40.md first.
You run alone in this phase. Do not run tests.

Before your own entry, append to release-notes/scratchpad.md every "Release notes entry" from the
final messages of prompts 31, 33, 32, 40, and 42 in .artifacts/plan-runner/popularity-anti-gaming/
(31.md, 33.md, …), in that order, unchanged. Skip one that already appears. Then append your own.

Then close the set. Confirm every other numbered plan is in
.llm/plans/completed/popularity-anti-gaming/. Move 41-range-windows-distinct-listeners.md,
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory. If any earlier prompt reported the linear baseline archives were not
regenerated, put make db_regen_linear_baseline first in the Root block.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Add any spec, Maestro flow,
or test file the set created that the list below misses (check git status). Tell the operator
that Docker, Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must be
running, and that Mobile E2E API must be restarted after make local_env_setup and the package
build, because the API now requires renamed Taste Profile agreement keys and new STATS_* limits.
Do not put leave-running commands in the blocks. Say whether any plan added a dependency (none
was planned, so no lockfile update is expected). Name the operator steps the release entries
carry, including: rename POPULARITY_TRACKING_AGREEMENT_VERSION and POPULARITY_TRACKING_CONTENT_DIR
in the home legal.env overrides before make local_env_setup (plan 20); STATS_LISTEN_DAILY_CAP is
gone (plan 11); keep STATS_ALL_TIME_RECOUNT_DAYS at or below STATS_TRACK_EVENT_RETENTION_DAYS
(plan 40); workers reject STATS_TRACK_EVENT_RETENTION_DAYS below 31 (plan 41).

Root:
make local_env_setup
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run type-check:mobile
npm run test:unit
npm --prefix apps/mobile run test
make db_verify_linear_baseline
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/web
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
make e2e_test_report_scoped WEB_SPEC=e2e/taste-profile-consent.spec.ts,e2e/settings-taste-profile.spec.ts,e2e/terms-version-acceptance.spec.ts,e2e/sign-up-legal-consent.spec.ts,e2e/media-player-foundation.spec.ts,e2e/seo-profile-sharable-status.spec.ts MGMT_SPEC=e2e/stats-page.spec.ts,e2e/stats-flagged-listeners.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- taste-profile-consent,terms-taste-profile-consent,taste-profile,terms-account-access
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
